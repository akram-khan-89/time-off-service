import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ConflictException } from '@nestjs/common';
import { SyncService } from '../../src/modules/sync/sync.service';
import { HcmSyncLog, SyncStatus, SyncType } from '../../src/database/entities/hcm-sync-log.entity';
import { QUEUE_NAMES } from '../../src/modules/queue/queue.constants';
import { LeaveBalancesService } from 'src/modules/leave-balances/leave-balances.service';
import { HcmClient } from 'src/modules/hcm/hcm.client';
import { AuditService } from 'src/modules/audit/audit.service';
import { LocationsService } from 'src/modules/locations/locations.service';
import { EmployeesService } from 'src/modules/employees/employees.service';

const mockRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
});

const mockQueue = () => ({
    add: jest.fn(),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getWaitingCount: jest.fn().mockResolvedValue(0),
});

const mockLeaveBalancesService = () => ({
    findRaw: jest.fn(),
    upsertBalance: jest.fn(),
});

const mockEmployeesService = () => ({
    findByHcmId: jest.fn(),
});

const mockLocationsService = () => ({
    findByHcmId: jest.fn(),
});

const mockAuditService = () => ({
    write: jest.fn().mockResolvedValue(undefined),
    writeMany: jest.fn().mockResolvedValue(undefined),
});

const mockHcmClient = () => ({
    getBalances: jest.fn(),
});

describe('SyncService', () => {
    let service: SyncService;
    let repo: ReturnType<typeof mockRepo>;
    let queue: ReturnType<typeof mockQueue>;
    let leaveBalancesService: ReturnType<typeof mockLeaveBalancesService>;
    let employeesService: ReturnType<typeof mockEmployeesService>;
    let locationsService: ReturnType<typeof mockLocationsService>;
    let auditService: ReturnType<typeof mockAuditService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SyncService,
                { provide: getRepositoryToken(HcmSyncLog), useFactory: mockRepo },
                { provide: getQueueToken(QUEUE_NAMES.BATCH_SYNC), useFactory: mockQueue },
                { provide: LeaveBalancesService, useFactory: mockLeaveBalancesService },
                { provide: EmployeesService, useFactory: mockEmployeesService },
                { provide: LocationsService, useFactory: mockLocationsService },
                { provide: AuditService, useFactory: mockAuditService },
                { provide: HcmClient, useFactory: mockHcmClient },
            ],
        }).compile();

        service = module.get(SyncService);
        repo = module.get(getRepositoryToken(HcmSyncLog));
        queue = module.get(getQueueToken(QUEUE_NAMES.BATCH_SYNC));
        leaveBalancesService = module.get(LeaveBalancesService);
        employeesService = module.get(EmployeesService);
        locationsService = module.get(LocationsService);
        auditService = module.get(AuditService);
    });

    afterEach(() => jest.clearAllMocks());

    describe('enqueueBatchIngest', () => {
        const dto = {
            records: [
                {
                    hcmEmployeeId: 'HCM-EMP-001',
                    hcmLocationId: 'LOC-NY-001',
                    leaveType: 'annual',
                    balanceDays: 10,
                    asOf: '2024-01-01T00:00:00Z',
                },
            ],
        };

        it('creates sync log and enqueues job', async () => {
            const syncLog = { id: 'sync-1', status: SyncStatus.STARTED };
            repo.create.mockReturnValue(syncLog);
            repo.save.mockResolvedValue(syncLog);
            queue.add.mockResolvedValue({});

            const result = await service.enqueueBatchIngest(dto, null);

            expect(repo.save).toHaveBeenCalled();
            expect(queue.add).toHaveBeenCalled();
            expect(result.status).toBe('started');
            expect(result.recordsQueued).toBe(1);
        });

        it('throws ConflictException when a sync is already running', async () => {
            queue.getActiveCount.mockResolvedValue(1);

            await expect(service.enqueueBatchIngest(dto, null)).rejects.toThrow(
                ConflictException,
            );
            expect(queue.add).not.toHaveBeenCalled();
        });
    });

    describe('processBatch — reconciliation logic', () => {
        const makeRecord = (overrides = {}) => ({
            hcmEmployeeId: 'HCM-EMP-001',
            hcmLocationId: 'LOC-NY-001',
            leaveType: 'annual',
            balanceDays: 10,
            asOf: new Date().toISOString(),
            ...overrides,
        });

        const employee = { id: 'emp-1', hcmEmployeeId: 'HCM-EMP-001' };
        const location = { id: 'loc-1', hcmLocationId: 'LOC-NY-001' };

        beforeEach(() => {
            (service as any).employeesService = {
                findByHcmId: jest.fn().mockResolvedValue(employee),
            };
            (service as any).locationsService = {
                findByHcmId: jest.fn().mockResolvedValue(location),
            };
            (service as any).leaveBalancesService = {
                findRaw: jest.fn(),
                upsertBalance: jest.fn().mockResolvedValue({ id: 'bal-1', balanceDays: 10 }),
            };
            (service as any).auditService = {
                write: jest.fn().mockResolvedValue(undefined),
            };
            repo.update = jest.fn().mockResolvedValue({});
        });

        it('applies record when balance does not exist yet', async () => {
            (service as any).leaveBalancesService.findRaw.mockResolvedValue(null);

            await service.processBatch({
                syncLogId: 'sync-1',
                records: [makeRecord()],
                triggeredBy: null,
            });

            expect((service as any).leaveBalancesService.upsertBalance).toHaveBeenCalled();
            expect(repo.update).toHaveBeenCalledWith(
                'sync-1',
                expect.objectContaining({ status: SyncStatus.COMPLETED, recordsApplied: 1 }),
            );
        });

        it('skips stale batch record when local data is newer', async () => {
            const newerDate = new Date();
            const olderDate = new Date(Date.now() - 10000);

            leaveBalancesService.findRaw.mockResolvedValue({
                id: 'bal-1',
                balanceDays: 8,
                hcmSyncedAt: newerDate,
            });

            (service as any).employeesService = {
                findByHcmId: jest.fn().mockResolvedValue({ id: 'emp-1', hcmEmployeeId: 'HCM-EMP-001' }),
            };
            (service as any).locationsService = {
                findByHcmId: jest.fn().mockResolvedValue({ id: 'loc-1', hcmLocationId: 'LOC-NY-001' }),
            };

            await service.processBatch({
                syncLogId: 'sync-1',
                records: [makeRecord({ asOf: olderDate.toISOString() })],
                triggeredBy: null,
            });

            expect(leaveBalancesService.upsertBalance).not.toHaveBeenCalled();
            expect(repo.update).toHaveBeenCalledWith(
                'sync-1',
                expect.objectContaining({ recordsApplied: 0 }),
            );
        });

        it('writes BALANCE_RECONCILED_BATCH audit when balance changes', async () => {
            (service as any).leaveBalancesService.findRaw.mockResolvedValue({
                id: 'bal-1',
                balanceDays: 5, // different from incoming 10
                hcmSyncedAt: new Date(Date.now() - 10000),
            });

            await service.processBatch({
                syncLogId: 'sync-1',
                records: [makeRecord({ balanceDays: 10 })],
                triggeredBy: null,
            });

            expect((service as any).auditService.write).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'BALANCE_RECONCILED_BATCH' }),
            );
        });

        it('sets status to partial when some records fail', async () => {
            (service as any).employeesService = {
                findByHcmId: jest.fn()
                    .mockResolvedValueOnce(employee)
                    .mockResolvedValueOnce(null),
            };
            (service as any).leaveBalancesService.findRaw.mockResolvedValue(null);

            await service.processBatch({
                syncLogId: 'sync-1',
                records: [makeRecord(), makeRecord({ hcmEmployeeId: 'UNKNOWN' })],
                triggeredBy: null,
            });

            expect(repo.update).toHaveBeenCalledWith(
                'sync-1',
                expect.objectContaining({ status: SyncStatus.PARTIAL }),
            );
        });

        it('sets status to failed when all records fail', async () => {
            (service as any).employeesService = {
                findByHcmId: jest.fn().mockResolvedValue(null),
            };

            await service.processBatch({
                syncLogId: 'sync-1',
                records: [makeRecord()],
                triggeredBy: null,
            });

            expect(repo.update).toHaveBeenCalledWith(
                'sync-1',
                expect.objectContaining({ status: SyncStatus.FAILED }),
            );
        });

        it('HCM wins when batch balance differs from local', async () => {
            (service as any).leaveBalancesService.findRaw.mockResolvedValue({
                id: 'bal-1',
                balanceDays: 3,
                hcmSyncedAt: new Date(Date.now() - 10000),
            });

            await service.processBatch({
                syncLogId: 'sync-1',
                records: [makeRecord({ balanceDays: 10 })],
                triggeredBy: null,
            });

            expect((service as any).leaveBalancesService.upsertBalance).toHaveBeenCalledWith(
                expect.objectContaining({ balanceDays: 10 }),
            );
        });
    });
});