import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { LeaveBalancesService } from '../../src/modules/leave-balances/leave-balances.service';
import { HcmClient } from '../../src/modules/hcm/hcm.client';
import { AuditService } from '../../src/modules/audit/audit.service';
import { EmployeesService } from '../../src/modules/employees/employees.service';
import { LocationsService } from '../../src/modules/locations/locations.service';
import { TimeOffRequestsService } from '../../src/modules/time-off-requests/time-off-requests.service';
import {
    TimeOffRequest,
    RequestStatus,
} from '../../src/database/entities/time-off-request.entity';
import { InsufficientBalanceException } from '../../src/common/exceptions';

const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { createQueryBuilder: jest.fn() },
});

const mockLeaveBalancesService = () => ({
    findRaw: jest.fn(),
    findRawOrFail: jest.fn(),
    isStale: jest.fn().mockReturnValue(false),
    upsertBalance: jest.fn(),
    deductBalance: jest.fn(),
});

const mockHcmClient = () => ({
    getBalances: jest.fn(),
    submitTimeOff: jest.fn(),
});

const mockAuditService = () => ({
    write: jest.fn().mockResolvedValue(undefined),
    writeMany: jest.fn().mockResolvedValue(undefined),
    snapshot: jest.fn((x) => x),
});

const mockEmployeesService = () => ({
    findByIdRaw: jest.fn(),
    findByHcmId: jest.fn(),
});

const mockLocationsService = () => ({
    findByIdRaw: jest.fn(),
    findByHcmId: jest.fn(),
});

const employee = { id: 'emp-1', hcmEmployeeId: 'HCM-EMP-001', managerId: 'mgr-1' };
const location = { id: 'loc-1', hcmLocationId: 'LOC-NY-001' };

const currentEmployee = {
    id: 'emp-1',
    email: 'a@b.com',
    role: 'employee',
    hcmEmployeeId: 'HCM-EMP-001',
};

const currentManager = {
    id: 'mgr-1',
    email: 'm@b.com',
    role: 'manager',
    hcmEmployeeId: 'HCM-MGR-001',
};

const currentAdmin = {
    id: 'admin-1',
    email: 'admin@b.com',
    role: 'admin',
    hcmEmployeeId: 'HCM-ADMIN-001',
};

describe('TimeOffRequestsService', () => {
    let service: TimeOffRequestsService;
    let requestRepo: ReturnType<typeof mockRepo>;
    let leaveBalancesService: ReturnType<typeof mockLeaveBalancesService>;
    let hcmClient: ReturnType<typeof mockHcmClient>;
    let auditService: ReturnType<typeof mockAuditService>;
    let employeesService: ReturnType<typeof mockEmployeesService>;
    let locationsService: ReturnType<typeof mockLocationsService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TimeOffRequestsService,
                { provide: getRepositoryToken(TimeOffRequest), useFactory: mockRepo },
                { provide: LeaveBalancesService, useFactory: mockLeaveBalancesService },
                { provide: HcmClient, useFactory: mockHcmClient },
                { provide: AuditService, useFactory: mockAuditService },
                { provide: EmployeesService, useFactory: mockEmployeesService },
                { provide: LocationsService, useFactory: mockLocationsService },
            ],
        }).compile();

        service = module.get(TimeOffRequestsService);
        requestRepo = module.get(getRepositoryToken(TimeOffRequest));
        leaveBalancesService = module.get(LeaveBalancesService);
        hcmClient = module.get(HcmClient);
        auditService = module.get(AuditService);
        employeesService = module.get(EmployeesService);
        locationsService = module.get(LocationsService);
    });

    afterEach(() => jest.clearAllMocks());

    // ─── Submit ───────────────────────────────────────────────────────────────

    describe('submit', () => {
        const dto = {
            locationId: 'loc-1',
            leaveType: 'annual',
            startDate: '2024-02-05',
            endDate: '2024-02-07',
        };

        beforeEach(() => {
            locationsService.findByIdRaw.mockResolvedValue(location);
            leaveBalancesService.findRaw.mockResolvedValue({
                id: 'bal-1',
                balanceDays: 10,
                hcmSyncedAt: new Date(),
            });
            leaveBalancesService.isStale.mockReturnValue(false);
        });

        it('creates a pending request when balance is sufficient', async () => {
            const created = { id: 'req-1', status: RequestStatus.PENDING, daysRequested: 3 };
            requestRepo.create.mockReturnValue(created);
            requestRepo.save.mockResolvedValue(created);

            const result = await service.submit(dto, currentEmployee);

            expect(result.status).toBe(RequestStatus.PENDING);
            expect(requestRepo.save).toHaveBeenCalled();
            expect(auditService.write).toHaveBeenCalled();
        });

        it('throws InsufficientBalanceException when balance is too low', async () => {
            leaveBalancesService.findRaw.mockResolvedValue({
                id: 'bal-1',
                balanceDays: 1,
                hcmSyncedAt: new Date(),
            });

            await expect(service.submit(dto, currentEmployee)).rejects.toThrow(
                InsufficientBalanceException,
            );
            expect(requestRepo.save).not.toHaveBeenCalled();
        });

        it('throws BadRequestException for date range with no business days', async () => {
            await expect(
                service.submit(
                    { ...dto, startDate: '2024-02-03', endDate: '2024-02-04' },
                    currentEmployee,
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('refreshes balance from HCM when local balance is stale', async () => {
            leaveBalancesService.isStale.mockReturnValue(true);
            hcmClient.getBalances.mockResolvedValue({
                hcmEmployeeId: 'HCM-EMP-001',
                hcmLocationId: 'LOC-NY-001',
                balances: [{ leaveType: 'annual', balanceDays: 10, asOf: new Date().toISOString() }],
            });
            leaveBalancesService.upsertBalance.mockResolvedValue({ id: 'bal-1', balanceDays: 10 });

            const created = { id: 'req-1', status: RequestStatus.PENDING };
            requestRepo.create.mockReturnValue(created);
            requestRepo.save.mockResolvedValue(created);

            await service.submit(dto, currentEmployee);

            expect(hcmClient.getBalances).toHaveBeenCalled();
        });

        it('does not deduct balance at submission time', async () => {
            const created = { id: 'req-1', status: RequestStatus.PENDING };
            requestRepo.create.mockReturnValue(created);
            requestRepo.save.mockResolvedValue(created);

            await service.submit(dto, currentEmployee);

            expect(leaveBalancesService.deductBalance).not.toHaveBeenCalled();
        });
    });

    // ─── Approve ──────────────────────────────────────────────────────────────

    describe('approve', () => {
        const pendingRequest = {
            id: 'req-1',
            employeeId: 'emp-1',
            locationId: 'loc-1',
            leaveType: 'annual',
            daysRequested: 3,
            status: RequestStatus.PENDING,
        } as TimeOffRequest;

        beforeEach(() => {
            requestRepo.findOne.mockResolvedValue(pendingRequest);
            employeesService.findByIdRaw.mockResolvedValue(employee);
            locationsService.findByIdRaw.mockResolvedValue(location);
            leaveBalancesService.findRawOrFail.mockResolvedValue({ id: 'bal-1', balanceDays: 10 });
            hcmClient.submitTimeOff.mockResolvedValue({
                reference: 'HCM-REF-123',
                status: 'accepted',
                remainingBalance: 7,
            });
            leaveBalancesService.deductBalance.mockResolvedValue({ id: 'bal-1', balanceDays: 7 });
            requestRepo.save.mockResolvedValue({ ...pendingRequest, status: RequestStatus.APPROVED });
        });

        it('approves request and deducts balance', async () => {
            const result = await service.approve('req-1', currentManager);

            expect(result.status).toBe(RequestStatus.APPROVED);
            expect(hcmClient.submitTimeOff).toHaveBeenCalled();
            expect(leaveBalancesService.deductBalance).toHaveBeenCalled();
            expect(auditService.writeMany).toHaveBeenCalled();
        });

        it('throws ForbiddenException when manager tries to approve own request', async () => {
            requestRepo.findOne.mockResolvedValue({
                ...pendingRequest,
                status: RequestStatus.PENDING,
                employeeId: 'mgr-1',
            });

            await expect(service.approve('req-1', currentManager)).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('throws ForbiddenException when manager approves non-direct-report', async () => {
            requestRepo.findOne.mockResolvedValue({
                ...pendingRequest,
                status: RequestStatus.PENDING,
            });
            employeesService.findByIdRaw.mockResolvedValue({
                ...employee,
                managerId: 'other-manager',
            });

            await expect(service.approve('req-1', currentManager)).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('throws when balance is insufficient at approval time', async () => {
            requestRepo.findOne.mockResolvedValue({
                ...pendingRequest,
                status: RequestStatus.PENDING,
            });
            leaveBalancesService.findRawOrFail.mockResolvedValue({ id: 'bal-1', balanceDays: 1 });

            await expect(service.approve('req-1', currentManager)).rejects.toThrow(
                InsufficientBalanceException,
            );
            expect(hcmClient.submitTimeOff).not.toHaveBeenCalled();
        });

        it('throws when request is already approved', async () => {
            requestRepo.findOne.mockResolvedValue({
                ...pendingRequest,
                status: RequestStatus.APPROVED,
            });

            await expect(service.approve('req-1', currentManager)).rejects.toThrow();
        });

        it('throws NotFoundException when request does not exist', async () => {
            requestRepo.findOne.mockResolvedValue(null);
            await expect(service.approve('bad-id', currentManager)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ─── Reject ───────────────────────────────────────────────────────────────

    describe('reject', () => {
        const pendingRequest = {
            id: 'req-1',
            employeeId: 'emp-1',
            locationId: 'loc-1',
            leaveType: 'annual',
            daysRequested: 3,
            status: RequestStatus.PENDING,
        } as TimeOffRequest;

        it('rejects request without touching balance', async () => {
            requestRepo.findOne.mockResolvedValue(pendingRequest);
            employeesService.findByIdRaw.mockResolvedValue(employee);
            requestRepo.save.mockResolvedValue({ ...pendingRequest, status: RequestStatus.REJECTED });

            const result = await service.reject('req-1', { reason: 'Team too busy' }, currentManager);

            expect(result.status).toBe(RequestStatus.REJECTED);
            expect(leaveBalancesService.deductBalance).not.toHaveBeenCalled();
            expect(hcmClient.submitTimeOff).not.toHaveBeenCalled();
        });

        it('throws for already rejected request', async () => {
            requestRepo.findOne.mockResolvedValue({ ...pendingRequest, status: RequestStatus.REJECTED });

            await expect(
                service.reject('req-1', { reason: 'reason' }, currentManager),
            ).rejects.toThrow();
        });
    });

    // ─── Withdraw ─────────────────────────────────────────────────────────────

    describe('withdraw', () => {
        it('allows employee to withdraw own pending request', async () => {
            const request = { id: 'req-1', employeeId: 'emp-1', status: RequestStatus.PENDING } as TimeOffRequest;
            requestRepo.findOne.mockResolvedValue(request);
            requestRepo.save.mockResolvedValue({ ...request, status: RequestStatus.WITHDRAWN });

            const result = await service.withdraw('req-1', currentEmployee);
            expect(result.status).toBe(RequestStatus.WITHDRAWN);
        });

        it('throws ForbiddenException when employee withdraws someone elses request', async () => {
            requestRepo.findOne.mockResolvedValue({
                id: 'req-1',
                employeeId: 'other-emp',
                status: RequestStatus.PENDING,
            } as TimeOffRequest);

            await expect(service.withdraw('req-1', currentEmployee)).rejects.toThrow(ForbiddenException);
        });

        it('throws when trying to withdraw an approved request', async () => {
            requestRepo.findOne.mockResolvedValue({
                id: 'req-1',
                employeeId: 'emp-1',
                status: RequestStatus.APPROVED,
            } as TimeOffRequest);

            await expect(service.withdraw('req-1', currentEmployee)).rejects.toThrow();
        });
    });

    // ─── Cancel ───────────────────────────────────────────────────────────────

    describe('cancel', () => {
        it('admin can cancel an approved request', async () => {
            const request = { id: 'req-1', employeeId: 'emp-1', status: RequestStatus.APPROVED } as TimeOffRequest;
            requestRepo.findOne.mockResolvedValue(request);
            requestRepo.save.mockResolvedValue({ ...request, status: RequestStatus.CANCELLED });

            const result = await service.cancel('req-1', {}, currentAdmin);
            expect(result.status).toBe(RequestStatus.CANCELLED);
        });

        it('throws when trying to cancel a pending request', async () => {
            requestRepo.findOne.mockResolvedValue({
                id: 'req-1',
                employeeId: 'emp-1',
                status: RequestStatus.PENDING,
            } as TimeOffRequest);

            await expect(service.cancel('req-1', {}, currentAdmin)).rejects.toThrow();
        });
    });
});