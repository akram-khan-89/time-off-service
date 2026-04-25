import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { LeaveBalancesService } from '../../src/modules/leave-balances/leave-balances.service';
import { LeaveBalance } from '../../src/database/entities/leave-balance.entity';

const mockRepo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
});

const mockConfigService = () => ({
    get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'hcm.staleThresholdHours') return 4;
        return defaultVal;
    }),
});

describe('LeaveBalancesService', () => {
    let service: LeaveBalancesService;
    let repo: ReturnType<typeof mockRepo>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LeaveBalancesService,
                { provide: getRepositoryToken(LeaveBalance), useFactory: mockRepo },
                { provide: ConfigService, useFactory: mockConfigService },
            ],
        }).compile();

        service = module.get(LeaveBalancesService);
        repo = module.get(getRepositoryToken(LeaveBalance));
    });

    afterEach(() => jest.clearAllMocks());


    describe('isStale', () => {
        it('returns false when balance was synced recently', () => {
            const balance = { hcmSyncedAt: new Date() } as LeaveBalance;
            expect(service.isStale(balance)).toBe(false);
        });

        it('returns true when balance is older than threshold', () => {
            const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
            const balance = { hcmSyncedAt: fiveHoursAgo } as LeaveBalance;
            expect(service.isStale(balance)).toBe(true);
        });

        it('returns false when balance is exactly at threshold boundary', () => {
            const justUnder = new Date(Date.now() - 3.9 * 60 * 60 * 1000);
            const balance = { hcmSyncedAt: justUnder } as LeaveBalance;
            expect(service.isStale(balance)).toBe(false);
        });
    });


    describe('findRaw', () => {
        it('returns balance when found', async () => {
            const balance = { id: 'bal-1', balanceDays: 10 } as LeaveBalance;
            repo.findOne.mockResolvedValue(balance);

            const result = await service.findRaw('emp-1', 'loc-1', 'annual');
            expect(result).toEqual(balance);
            expect(repo.findOne).toHaveBeenCalledWith({
                where: { employeeId: 'emp-1', locationId: 'loc-1', leaveType: 'annual' },
            });
        });

        it('returns null when not found', async () => {
            repo.findOne.mockResolvedValue(null);
            const result = await service.findRaw('emp-1', 'loc-1', 'annual');
            expect(result).toBeNull();
        });
    });


    describe('findRawOrFail', () => {
        it('returns balance when found', async () => {
            const balance = { id: 'bal-1' } as LeaveBalance;
            repo.findOne.mockResolvedValue(balance);
            const result = await service.findRawOrFail('emp-1', 'loc-1', 'annual');
            expect(result).toEqual(balance);
        });

        it('throws NotFoundException when not found', async () => {
            repo.findOne.mockResolvedValue(null);
            await expect(
                service.findRawOrFail('emp-1', 'loc-1', 'annual'),
            ).rejects.toThrow(NotFoundException);
        });
    });


    describe('upsertBalance', () => {
        const upsertData = {
            employeeId: 'emp-1',
            locationId: 'loc-1',
            leaveType: 'annual',
            balanceDays: 10,
            hcmSyncedAt: new Date(),
        };

        it('creates new balance when none exists', async () => {
            repo.findOne.mockResolvedValue(null);
            const created = { id: 'new-bal', ...upsertData };
            repo.create.mockReturnValue(created);
            repo.save.mockResolvedValue(created);

            const result = await service.upsertBalance(upsertData);

            expect(repo.create).toHaveBeenCalled();
            expect(repo.save).toHaveBeenCalled();
            expect(result).toEqual(created);
        });

        it('updates existing balance when found', async () => {
            const existing = {
                id: 'existing-bal',
                balanceDays: 5,
                hcmSyncedAt: new Date(),
            } as LeaveBalance;
            repo.findOne.mockResolvedValue(existing);
            repo.save.mockResolvedValue({ ...existing, balanceDays: 10 });

            const result = await service.upsertBalance(upsertData);

            expect(repo.create).not.toHaveBeenCalled();
            expect(repo.save).toHaveBeenCalled();
            expect(result.balanceDays).toBe(10);
        });
    });


    describe('deductBalance', () => {
        it('deducts balance successfully', async () => {
            const balance = {
                id: 'bal-1',
                balanceDays: 10,
                hcmSyncedAt: new Date(),
                version: 0,
            } as LeaveBalance;
            repo.findOne.mockResolvedValue(balance);
            repo.save.mockResolvedValue({ ...balance, balanceDays: 8 });

            const result = await service.deductBalance('emp-1', 'loc-1', 'annual', 2);
            expect(result.balanceDays).toBe(8);
        });

        it('throws when balance is insufficient', async () => {
            const balance = {
                id: 'bal-1',
                balanceDays: 1,
                version: 0,
            } as LeaveBalance;
            repo.findOne.mockResolvedValue(balance);

            await expect(
                service.deductBalance('emp-1', 'loc-1', 'annual', 5),
            ).rejects.toThrow(NotFoundException);
        });

        it('throws when balance not found', async () => {
            repo.findOne.mockResolvedValue(null);
            await expect(
                service.deductBalance('emp-1', 'loc-1', 'annual', 2),
            ).rejects.toThrow(NotFoundException);
        });

        it('surfaces optimistic lock conflict as identifiable error', async () => {
            const balance = {
                id: 'bal-1',
                balanceDays: 10,
                version: 0,
            } as LeaveBalance;
            repo.findOne.mockResolvedValue(balance);
            repo.save.mockRejectedValue({
                name: 'OptimisticLockVersionMismatchError',
                message: 'optimistic lock',
            });

            await expect(
                service.deductBalance('emp-1', 'loc-1', 'annual', 2),
            ).rejects.toMatchObject({ isOptimisticLockError: true });
        });
    });


    describe('getMyBalances', () => {
        it('returns balances for current user', async () => {
            const balances = [
                { id: 'b1', balanceDays: 10, leaveType: 'annual' },
                { id: 'b2', balanceDays: 5, leaveType: 'sick' },
            ] as LeaveBalance[];

            repo.find.mockResolvedValue(balances);

            const result = await service.getMyBalances({
                id: 'emp-1',
                email: 'a@b.com',
                role: 'employee',
                hcmEmployeeId: 'HCM-EMP-001',
            });

            expect(result).toHaveLength(2);
            expect(result[0].leaveType).toBe('annual');
        });
    });


    describe('getBalancesByEmployeeId', () => {
        it('throws ForbiddenException when employee tries to view others balances', async () => {
            await expect(
                service.getBalancesByEmployeeId('other-emp-id', {
                    id: 'emp-1',
                    email: 'a@b.com',
                    role: 'employee',
                    hcmEmployeeId: 'HCM-EMP-001',
                }),
            ).rejects.toThrow(ForbiddenException);
        });

        it('allows employee to view their own balances', async () => {
            repo.find.mockResolvedValue([]);
            const result = await service.getBalancesByEmployeeId('emp-1', {
                id: 'emp-1',
                email: 'a@b.com',
                role: 'employee',
                hcmEmployeeId: 'HCM-EMP-001',
            });
            expect(result).toEqual([]);
        });

        it('allows manager to view any employee balances', async () => {
            repo.find.mockResolvedValue([{ id: 'b1', balanceDays: 5 }]);
            const result = await service.getBalancesByEmployeeId('emp-1', {
                id: 'manager-id',
                email: 'm@b.com',
                role: 'manager',
                hcmEmployeeId: 'HCM-MGR-001',
            });
            expect(result).toHaveLength(1);
        });
    });
});