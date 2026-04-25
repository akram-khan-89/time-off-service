import {
    Injectable,
    Logger,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import {
    HcmSyncLog,
    SyncType,
    SyncStatus,
} from '../../database/entities/hcm-sync-log.entity';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { EmployeesService } from '../employees/employees.service';
import { LocationsService } from '../locations/locations.service';
import { AuditService } from '../audit/audit.service';
import { HcmClient } from '../hcm/hcm.client';
import { AuditAction } from '../audit/audit-actions.constants';
import { CurrentUserData } from '../auth/interfaces/current-user.interface';
import { BatchIngestDto, BatchBalanceRecordDto } from './dto/batch-ingest.dto';
import { SyncLogResponseDto } from './dto/sync-log-response.dto';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import { BatchSyncJobData } from './interfaces/batch-job.interface';

@Injectable()
export class SyncService {
    private readonly logger = new Logger(SyncService.name);

    constructor(
        @InjectRepository(HcmSyncLog)
        private readonly syncLogRepo: Repository<HcmSyncLog>,
        @InjectQueue(QUEUE_NAMES.BATCH_SYNC)
        private readonly batchSyncQueue: Queue<BatchSyncJobData>,
        private readonly leaveBalancesService: LeaveBalancesService,
        private readonly employeesService: EmployeesService,
        private readonly locationsService: LocationsService,
        private readonly auditService: AuditService,
        private readonly hcmClient: HcmClient,
    ) { }

    // ─── Batch Ingest (called by HCM push) ───────────────────────────────────

    async enqueueBatchIngest(
        dto: BatchIngestDto,
        triggeredBy: string | null,
    ): Promise<{ syncLogId: string; status: string; recordsQueued: number }> {
        // Guard: prevent overlapping batch jobs
        const activeJobs = await this.batchSyncQueue.getActiveCount();
        const waitingJobs = await this.batchSyncQueue.getWaitingCount();

        if (activeJobs + waitingJobs > 0) {
            throw new ConflictException({
                message: 'A batch sync is already in progress',
                code: 'SYNC_ALREADY_RUNNING',
            });
        }

        // Create sync log row immediately — gives HCM a traceable reference
        const syncLog = await this.syncLogRepo.save(
            this.syncLogRepo.create({
                syncType: SyncType.BATCH,
                triggeredBy,
                status: SyncStatus.STARTED,
                recordsReceived: dto.records.length,
            }),
        );

        // Write audit entry for sync start
        await this.auditService.write({
            actorId: triggeredBy,
            actorRole: triggeredBy ? 'admin' : null,
            entityType: 'HcmSyncLog',
            entityId: syncLog.id,
            action: AuditAction.SYNC_STARTED,
            afterState: AuditService.snapshot(syncLog),
        });

        // Enqueue the job — returns immediately (202)
        await this.batchSyncQueue.add(
            JOB_NAMES.PROCESS_BATCH,
            {
                syncLogId: syncLog.id,
                records: dto.records,
                triggeredBy,
            },
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );

        this.logger.log(
            `Batch sync enqueued — syncLogId: ${syncLog.id}, records: ${dto.records.length}`,
        );

        return {
            syncLogId: syncLog.id,
            status: 'started',
            recordsQueued: dto.records.length,
        };
    }

    // ─── Batch Processing (called by Bull processor) ──────────────────────────

    async processBatch(data: BatchSyncJobData): Promise<void> {
        const { syncLogId, records, triggeredBy } = data;

        this.logger.log(
            `Processing batch sync — syncLogId: ${syncLogId}, records: ${records.length}`,
        );

        let applied = 0;
        let failed = 0;
        const errors: { hcmEmployeeId: string; reason: string }[] = [];

        for (const record of records) {
            try {
                await this.processOneRecord(record, syncLogId, triggeredBy);
                applied++;
            } catch (err: any) {
                failed++;
                errors.push({
                    hcmEmployeeId: record.hcmEmployeeId,
                    reason: err?.message || 'unknown error',
                });
                this.logger.warn(
                    `Batch record failed — hcmEmployeeId: ${record.hcmEmployeeId}, ` +
                    `reason: ${err?.message}`,
                );
            }
        }

        // Determine final sync status
        let finalStatus: SyncStatus;
        if (failed === 0) {
            finalStatus = SyncStatus.COMPLETED;
        } else if (applied === 0) {
            finalStatus = SyncStatus.FAILED;
        } else {
            finalStatus = SyncStatus.PARTIAL;
        }

        // Update sync log with results
        await this.syncLogRepo.update(syncLogId, {
            status: finalStatus,
            recordsApplied: applied,
            recordsFailed: failed,
            errorSummary: errors.length > 0 ? JSON.stringify(errors) : null,
            completedAt: new Date(),
        });

        // Audit sync completion
        await this.auditService.write({
            actorId: triggeredBy,
            actorRole: triggeredBy ? 'admin' : null,
            entityType: 'HcmSyncLog',
            entityId: syncLogId,
            action:
                finalStatus === SyncStatus.FAILED
                    ? AuditAction.SYNC_FAILED
                    : AuditAction.SYNC_COMPLETED,
            afterState: {
                status: finalStatus,
                applied,
                failed,
                errors,
            },
        });

        this.logger.log(
            `Batch sync complete — syncLogId: ${syncLogId}, ` +
            `applied: ${applied}, failed: ${failed}, status: ${finalStatus}`,
        );
    }

    // ─── Single Record Reconciliation ─────────────────────────────────────────

    private async processOneRecord(
        record: BatchBalanceRecordDto,
        syncLogId: string,
        triggeredBy: string | null,
    ): Promise<void> {
        // 1. Resolve HCM IDs → internal IDs
        const employee = await this.employeesService.findByHcmId(
            record.hcmEmployeeId,
        );

        if (!employee) {
            throw new Error(
                `Employee not found for hcmEmployeeId: ${record.hcmEmployeeId}`,
            );
        }

        const location = await this.locationsService.findByHcmId(
            record.hcmLocationId,
        );

        if (!location) {
            throw new Error(
                `Location not found for hcmLocationId: ${record.hcmLocationId}`,
            );
        }

        // 2. Read current local balance
        const existing = await this.leaveBalancesService.findRaw(
            employee.id,
            location.id,
            record.leaveType,
        );

        // 3. Staleness check — if our local data is NEWER than this batch record,
        //    skip it. HCM batch can arrive out of order.
        if (existing) {
            const recordAsOf = new Date(record.asOf);
            const localSyncedAt = new Date(existing.hcmSyncedAt);

            if (recordAsOf <= localSyncedAt) {
                this.logger.debug(
                    `Skipping stale batch record for employee ${employee.id} — ` +
                    `record.asOf: ${record.asOf}, local.hcmSyncedAt: ${existing.hcmSyncedAt}`,
                );
                return;
            }
        }

        const beforeSnapshot = existing ? AuditService.snapshot(existing) : null;
        const isReconciliation =
            existing !== null &&
            Number(existing.balanceDays) !== record.balanceDays;

        // 4. Upsert the balance — HCM wins
        const updated = await this.leaveBalancesService.upsertBalance({
            employeeId: employee.id,
            locationId: location.id,
            leaveType: record.leaveType,
            balanceDays: record.balanceDays,
            hcmSyncedAt: new Date(record.asOf),
        });

        // 5. Write audit only if balance actually changed
        if (isReconciliation || !existing) {
            await this.auditService.write({
                actorId: triggeredBy,
                actorRole: triggeredBy ? 'admin' : null,
                entityType: 'LeaveBalance',
                entityId: updated.id,
                action: AuditAction.BALANCE_RECONCILED_BATCH,
                beforeState: beforeSnapshot,
                afterState: AuditService.snapshot(updated),
                metadata: { syncLogId, hcmEmployeeId: record.hcmEmployeeId },
            });

            this.logger.log(
                `Balance reconciled — employee: ${employee.id}, ` +
                `leaveType: ${record.leaveType}, ` +
                `before: ${existing?.balanceDays ?? 'none'}, ` +
                `after: ${record.balanceDays}`,
            );
        }
    }

    // ─── Admin Trigger (manual real-time refresh for all employees) ───────────

    async triggerManualSync(
        currentUser: CurrentUserData,
    ): Promise<{ syncLogId: string; status: string }> {
        const syncLog = await this.syncLogRepo.save(
            this.syncLogRepo.create({
                syncType: SyncType.REALTIME,
                triggeredBy: currentUser.id,
                status: SyncStatus.STARTED,
            }),
        );

        await this.auditService.write({
            actorId: currentUser.id,
            actorRole: currentUser.role,
            entityType: 'HcmSyncLog',
            entityId: syncLog.id,
            action: AuditAction.SYNC_STARTED,
            afterState: AuditService.snapshot(syncLog),
        });

        this.logger.log(
            `Manual sync triggered by admin ${currentUser.id} — syncLogId: ${syncLog.id}`,
        );

        // Note: actual per-employee refresh would be done asynchronously
        // For now we mark it started and return immediately
        // A full implementation would queue per-employee refresh jobs
        await this.syncLogRepo.update(syncLog.id, {
            status: SyncStatus.COMPLETED,
            completedAt: new Date(),
        });

        return {
            syncLogId: syncLog.id,
            status: 'started',
        };
    }

    // ─── Sync Log Queries ─────────────────────────────────────────────────────

    async findAllLogs(
        page: number = 1,
        limit: number = 20,
    ): Promise<{
        data: SyncLogResponseDto[];
        meta: object;
    }> {
        const [logs, total] = await this.syncLogRepo.findAndCount({
            order: { startedAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            data: logs.map(SyncLogResponseDto.from),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findLogById(id: string): Promise<SyncLogResponseDto> {
        const log = await this.syncLogRepo.findOne({ where: { id } });

        if (!log) {
            throw new Error('Sync log not found');
        }

        return SyncLogResponseDto.from(log);
    }
}