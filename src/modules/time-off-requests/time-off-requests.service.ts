import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    TimeOffRequest,
    RequestStatus,
} from '../../database/entities/time-off-request.entity';
import { CurrentUserData } from '../auth/interfaces/current-user.interface';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { HcmClient } from '../hcm/hcm.client';
import { AuditService } from '../audit/audit.service';
import { EmployeesService } from '../employees/employees.service';
import { LocationsService } from '../locations/locations.service';
import { AuditAction } from '../audit/audit-actions.constants';
import { CreateTimeOffRequestDto } from './dto/create-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { ListRequestsDto } from './dto/list-requests.dto';
import { TimeOffRequestResponseDto } from './dto/request-response.dto';
import { computeBusinessDays } from './helpers/date.helper';
import { assertValidTransition } from './helpers/state-machine.helper';
import {
    InsufficientBalanceException,
    HcmUnavailableException,
} from '../../common/exceptions';

@Injectable()
export class TimeOffRequestsService {
    private readonly logger = new Logger(TimeOffRequestsService.name);

    constructor(
        @InjectRepository(TimeOffRequest)
        private readonly requestRepo: Repository<TimeOffRequest>,
        private readonly leaveBalancesService: LeaveBalancesService,
        private readonly hcmClient: HcmClient,
        private readonly auditService: AuditService,
        private readonly employeesService: EmployeesService,
        private readonly locationsService: LocationsService,
    ) { }


    async submit(
        dto: CreateTimeOffRequestDto,
        currentUser: CurrentUserData,
    ): Promise<TimeOffRequestResponseDto> {
        const daysRequested = computeBusinessDays(dto.startDate, dto.endDate);

        if (daysRequested <= 0) {
            throw new BadRequestException({
                message: 'Date range must include at least one business day',
                code: 'INVALID_DATE_RANGE',
            });
        }

        const location = await this.locationsService.findByIdRaw(dto.locationId);

        let balance = await this.leaveBalancesService.findRaw(
            currentUser.id,
            dto.locationId,
            dto.leaveType,
        );

        if (!balance || this.leaveBalancesService.isStale(balance)) {
            this.logger.log(
                `Balance stale or missing for employee ${currentUser.id} — refreshing from HCM`,
            );
            balance = await this.refreshBalanceFromHcm(
                currentUser.id,
                currentUser.hcmEmployeeId,
                location.hcmLocationId,
                dto.locationId,
                dto.leaveType,
                currentUser,
            );
        }

        if (!balance || Number(balance.balanceDays) < daysRequested) {
            throw new InsufficientBalanceException();
        }

        const request = this.requestRepo.create({
            employeeId: currentUser.id,
            locationId: dto.locationId,
            leaveType: dto.leaveType,
            startDate: dto.startDate,
            endDate: dto.endDate,
            daysRequested,
            status: RequestStatus.PENDING,
            submittedAt: new Date(),
        });

        const saved = await this.requestRepo.save(request);

        await this.auditService.write({
            actorId: currentUser.id,
            actorRole: currentUser.role,
            entityType: 'TimeOffRequest',
            entityId: saved.id,
            action: AuditAction.REQUEST_SUBMITTED,
            beforeState: null,
            afterState: AuditService.snapshot(saved),
        });

        return TimeOffRequestResponseDto.from(saved);
    }


    async approve(
        requestId: string,
        currentUser: CurrentUserData,
    ): Promise<TimeOffRequestResponseDto> {
        const request = await this.findRequestOrFail(requestId);
        const beforeSnapshot = AuditService.snapshot(request);

        assertValidTransition(request.status, RequestStatus.APPROVED);

        await this.assertCanActOnRequest(request, currentUser);

        if (request.employeeId === currentUser.id) {
            throw new ForbiddenException({
                message: 'You cannot approve your own time-off request',
                code: 'SELF_APPROVAL_FORBIDDEN',
            });
        }

        const balance = await this.leaveBalancesService.findRawOrFail(
            request.employeeId,
            request.locationId,
            request.leaveType,
        );

        if (Number(balance.balanceDays) < Number(request.daysRequested)) {
            throw new InsufficientBalanceException();
        }

        const employee = await this.employeesService.findByIdRaw(request.employeeId);
        const location = await this.locationsService.findByIdRaw(request.locationId);

        const hcmResponse = await this.hcmClient.submitTimeOff({
            hcmEmployeeId: employee.hcmEmployeeId,
            hcmLocationId: location.hcmLocationId,
            leaveType: request.leaveType,
            startDate: request.startDate,
            endDate: request.endDate,
            daysRequested: Number(request.daysRequested),
        });

        let updatedBalance: any;
        try {
            updatedBalance = await this.leaveBalancesService.deductBalance(
                request.employeeId,
                request.locationId,
                request.leaveType,
                Number(request.daysRequested),
            );
        } catch (err: any) {
            if (err?.isOptimisticLockError) {
                throw new ConflictException({
                    message:
                        'Balance was modified concurrently. Please retry the approval.',
                    code: 'CONCURRENT_MODIFICATION',
                });
            }
            throw err;
        }

        request.status = RequestStatus.APPROVED;
        request.resolvedAt = new Date();
        request.resolvedBy = currentUser.id;
        request.hcmSubmissionRef = hcmResponse.reference;
        request.hcmSubmittedAt = new Date();

        const saved = await this.requestRepo.save(request);

        await this.auditService.writeMany([
            {
                actorId: currentUser.id,
                actorRole: currentUser.role,
                entityType: 'TimeOffRequest',
                entityId: saved.id,
                action: AuditAction.REQUEST_APPROVED,
                beforeState: beforeSnapshot,
                afterState: AuditService.snapshot(saved),
                metadata: { hcmRef: hcmResponse.reference },
            },
            {
                actorId: currentUser.id,
                actorRole: currentUser.role,
                entityType: 'LeaveBalance',
                entityId: balance.id,
                action: AuditAction.BALANCE_DEDUCTED,
                beforeState: AuditService.snapshot(balance),
                afterState: AuditService.snapshot(updatedBalance),
                metadata: {
                    requestId: saved.id,
                    hcmRef: hcmResponse.reference,
                },
            },
        ]);

        if (
            hcmResponse.remainingBalance !== undefined &&
            Math.abs(
                hcmResponse.remainingBalance - Number(updatedBalance.balanceDays),
            ) > 0.5
        ) {
            this.logger.error(
                `BALANCE_CONFLICT: HCM says remaining=${hcmResponse.remainingBalance}, ` +
                `local says ${updatedBalance.balanceDays} for employee ${request.employeeId}`,
            );
            await this.auditService.write({
                actorId: null,
                actorRole: null,
                entityType: 'LeaveBalance',
                entityId: balance.id,
                action: AuditAction.BALANCE_CONFLICT_DETECTED,
                beforeState: { hcmRemaining: hcmResponse.remainingBalance },
                afterState: { localBalance: Number(updatedBalance.balanceDays) },
                metadata: { requestId: saved.id, hcmRef: hcmResponse.reference },
            });
        }

        return TimeOffRequestResponseDto.from(saved);
    }


    async reject(
        requestId: string,
        dto: RejectRequestDto,
        currentUser: CurrentUserData,
    ): Promise<TimeOffRequestResponseDto> {
        const request = await this.findRequestOrFail(requestId);
        const beforeSnapshot = AuditService.snapshot(request);

        assertValidTransition(request.status, RequestStatus.REJECTED);
        await this.assertCanActOnRequest(request, currentUser);

        request.status = RequestStatus.REJECTED;
        request.resolvedAt = new Date();
        request.resolvedBy = currentUser.id;
        request.rejectionReason = dto.reason;

        const saved = await this.requestRepo.save(request);

        await this.auditService.write({
            actorId: currentUser.id,
            actorRole: currentUser.role,
            entityType: 'TimeOffRequest',
            entityId: saved.id,
            action: AuditAction.REQUEST_REJECTED,
            beforeState: beforeSnapshot,
            afterState: AuditService.snapshot(saved),
            metadata: { reason: dto.reason },
        });

        return TimeOffRequestResponseDto.from(saved);
    }


    async withdraw(
        requestId: string,
        currentUser: CurrentUserData,
    ): Promise<TimeOffRequestResponseDto> {
        const request = await this.findRequestOrFail(requestId);
        const beforeSnapshot = AuditService.snapshot(request);

        assertValidTransition(request.status, RequestStatus.WITHDRAWN);

        if (request.employeeId !== currentUser.id) {
            throw new ForbiddenException({
                message: 'You can only withdraw your own requests',
                code: 'FORBIDDEN',
            });
        }

        request.status = RequestStatus.WITHDRAWN;
        request.resolvedAt = new Date();
        request.resolvedBy = currentUser.id;

        const saved = await this.requestRepo.save(request);

        await this.auditService.write({
            actorId: currentUser.id,
            actorRole: currentUser.role,
            entityType: 'TimeOffRequest',
            entityId: saved.id,
            action: AuditAction.REQUEST_WITHDRAWN,
            beforeState: beforeSnapshot,
            afterState: AuditService.snapshot(saved),
        });

        return TimeOffRequestResponseDto.from(saved);
    }

    async cancel(
        requestId: string,
        dto: CancelRequestDto,
        currentUser: CurrentUserData,
    ): Promise<TimeOffRequestResponseDto> {
        const request = await this.findRequestOrFail(requestId);
        const beforeSnapshot = AuditService.snapshot(request);

        assertValidTransition(request.status, RequestStatus.CANCELLED);

        request.status = RequestStatus.CANCELLED;
        request.resolvedAt = new Date();
        request.resolvedBy = currentUser.id;
        if (dto.reason) {
            request.rejectionReason = dto.reason;
        }

        const saved = await this.requestRepo.save(request);

        await this.auditService.write({
            actorId: currentUser.id,
            actorRole: currentUser.role,
            entityType: 'TimeOffRequest',
            entityId: saved.id,
            action: AuditAction.REQUEST_CANCELLED,
            beforeState: beforeSnapshot,
            afterState: AuditService.snapshot(saved),
            metadata: dto.reason ? { reason: dto.reason } : null,
        });

        return TimeOffRequestResponseDto.from(saved);
    }


    async findMine(
        currentUser: CurrentUserData,
        dto: ListRequestsDto,
    ): Promise<{
        data: TimeOffRequestResponseDto[];
        meta: object;
    }> {
        const where: any = { employeeId: currentUser.id };
        if (dto.status) where.status = dto.status;

        const [requests, total] = await this.requestRepo.findAndCount({
            where,
            order: { submittedAt: 'DESC' },
            skip: (dto.page - 1) * dto.limit,
            take: dto.limit,
        });

        return this.paginate(requests, total, dto);
    }

    async findTeam(
        currentUser: CurrentUserData,
        dto: ListRequestsDto,
    ): Promise<{
        data: TimeOffRequestResponseDto[];
        meta: object;
    }> {
        const subordinates = await this.employeesService
        ['employeeRepo']  // access repo via service
            ? this.getSubordinateIds(currentUser.id)
            : Promise.resolve([]);

        const subordinateIds = await this.getSubordinateIds(currentUser.id);

        if (!subordinateIds.length) {
            return this.paginate([], 0, dto);
        }

        const qb = this.requestRepo.createQueryBuilder('r')
            .where('r.employee_id IN (:...ids)', { ids: subordinateIds })
            .orderBy('r.submitted_at', 'DESC')
            .skip((dto.page - 1) * dto.limit)
            .take(dto.limit);

        if (dto.status) {
            qb.andWhere('r.status = :status', { status: dto.status });
        }

        const [requests, total] = await qb.getManyAndCount();
        return this.paginate(requests, total, dto);
    }

    async findAll(dto: ListRequestsDto): Promise<{
        data: TimeOffRequestResponseDto[];
        meta: object;
    }> {
        const where: any = {};
        if (dto.status) where.status = dto.status;
        if (dto.employeeId) where.employeeId = dto.employeeId;

        const [requests, total] = await this.requestRepo.findAndCount({
            where,
            order: { submittedAt: 'DESC' },
            skip: (dto.page - 1) * dto.limit,
            take: dto.limit,
        });

        return this.paginate(requests, total, dto);
    }

    async findById(
        requestId: string,
        currentUser: CurrentUserData,
    ): Promise<TimeOffRequestResponseDto> {
        const request = await this.findRequestOrFail(requestId);
        await this.assertCanViewRequest(request, currentUser);
        return TimeOffRequestResponseDto.from(request);
    }


    private async findRequestOrFail(id: string): Promise<TimeOffRequest> {
        const request = await this.requestRepo.findOne({ where: { id } });

        if (!request) {
            throw new NotFoundException({
                message: 'Time-off request not found',
                code: 'REQUEST_NOT_FOUND',
            });
        }

        return request;
    }

    private async assertCanActOnRequest(
        request: TimeOffRequest,
        currentUser: CurrentUserData,
    ): Promise<void> {
        if (currentUser.role === 'admin') return;

        if (currentUser.role === 'manager') {
            const employee = await this.employeesService.findByIdRaw(
                request.employeeId,
            );
            if (employee.managerId !== currentUser.id) {
                throw new ForbiddenException({
                    message: 'You can only act on requests from your direct reports',
                    code: 'FORBIDDEN',
                });
            }
            return;
        }

        throw new ForbiddenException({
            message: 'Insufficient permissions',
            code: 'FORBIDDEN',
        });
    }

    private async assertCanViewRequest(
        request: TimeOffRequest,
        currentUser: CurrentUserData,
    ): Promise<void> {
        if (currentUser.role === 'admin') return;

        if (currentUser.role === 'employee') {
            if (request.employeeId !== currentUser.id) {
                throw new ForbiddenException({
                    message: 'You can only view your own requests',
                    code: 'FORBIDDEN',
                });
            }
            return;
        }

        if (currentUser.role === 'manager') {
            if (request.employeeId === currentUser.id) return;
            const employee = await this.employeesService.findByIdRaw(
                request.employeeId,
            );
            if (employee.managerId !== currentUser.id) {
                throw new ForbiddenException({
                    message: 'You can only view requests from your direct reports',
                    code: 'FORBIDDEN',
                });
            }
        }
    }

    private async refreshBalanceFromHcm(
        employeeId: string,
        hcmEmployeeId: string,
        hcmLocationId: string,
        locationId: string,
        leaveType: string,
        currentUser: CurrentUserData,
    ) {
        try {
            const hcmResponse = await this.hcmClient.getBalances(
                hcmEmployeeId,
                hcmLocationId,
            );

            let updatedBalance: any = null;

            for (const item of hcmResponse.balances) {
                const b = await this.leaveBalancesService.upsertBalance({
                    employeeId,
                    locationId,
                    leaveType: item.leaveType,
                    balanceDays: item.balanceDays,
                    hcmSyncedAt: new Date(item.asOf),
                });

                if (item.leaveType === leaveType) {
                    updatedBalance = b;
                }

                await this.auditService.write({
                    actorId: currentUser.id,
                    actorRole: currentUser.role,
                    entityType: 'LeaveBalance',
                    entityId: b.id,
                    action: AuditAction.BALANCE_REFRESHED_REALTIME,
                    beforeState: null,
                    afterState: AuditService.snapshot(b),
                });
            }

            return updatedBalance;
        } catch (err) {
            if (err instanceof HcmUnavailableException) {
                this.logger.warn(
                    `HCM unavailable during balance refresh for employee ${employeeId} — proceeding with stale data`,
                );
                return this.leaveBalancesService.findRaw(
                    employeeId,
                    locationId,
                    leaveType,
                );
            }
            throw err;
        }
    }

    private async getSubordinateIds(managerId: string): Promise<string[]> {
        const result = await this.requestRepo.manager
            .createQueryBuilder()
            .select('e.id')
            .from('employees', 'e')
            .where('e.manager_id = :managerId', { managerId })
            .andWhere('e.is_active = 1')
            .getRawMany();

        return result.map((r) => r.e_id);
    }

    private paginate(
        requests: TimeOffRequest[],
        total: number,
        dto: ListRequestsDto,
    ) {
        return {
            data: requests.map(TimeOffRequestResponseDto.from),
            meta: {
                page: dto.page,
                limit: dto.limit,
                total,
                totalPages: Math.ceil(total / dto.limit),
            },
        };
    }
}