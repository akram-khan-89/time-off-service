import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../../src/modules/audit/audit.service';
import { AuditLog } from '../../src/database/entities/audit-log.entity';
import { AuditAction } from '../../src/modules/audit/audit-actions.constants';

const mockRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
});

describe('AuditService', () => {
    let service: AuditService;
    let repo: ReturnType<typeof mockRepo>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditService,
                { provide: getRepositoryToken(AuditLog), useFactory: mockRepo },
            ],
        }).compile();

        service = module.get(AuditService);
        repo = module.get(getRepositoryToken(AuditLog));
    });

    afterEach(() => jest.clearAllMocks());

    describe('write', () => {
        const entry = {
            actorId: 'emp-1',
            actorRole: 'employee',
            entityType: 'TimeOffRequest',
            entityId: 'req-1',
            action: AuditAction.REQUEST_SUBMITTED,
            beforeState: null,
            afterState: { id: 'req-1', status: 'pending' },
        };

        it('creates and saves an audit log entry', async () => {
            const created = { id: 'log-1', ...entry };
            repo.create.mockReturnValue(created);
            repo.save.mockResolvedValue(created);

            await service.write(entry);

            expect(repo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: 'emp-1',
                    entityType: 'TimeOffRequest',
                    action: AuditAction.REQUEST_SUBMITTED,
                }),
            );
            expect(repo.save).toHaveBeenCalled();
        });

        it('does not throw when save fails — audit must not break main flow', async () => {
            repo.create.mockReturnValue({});
            repo.save.mockRejectedValue(new Error('DB write failed'));

            await expect(service.write(entry)).resolves.not.toThrow();
        });

        it('handles null actorId for system-triggered actions', async () => {
            repo.create.mockReturnValue({});
            repo.save.mockResolvedValue({});

            await service.write({
                ...entry,
                actorId: null,
                actorRole: null,
            });

            expect(repo.create).toHaveBeenCalledWith(
                expect.objectContaining({ actorId: null, actorRole: null }),
            );
        });
    });

    describe('writeMany', () => {
        it('writes all entries independently', async () => {
            repo.create.mockReturnValue({});
            repo.save.mockResolvedValue({});

            await service.writeMany([
                {
                    actorId: 'emp-1',
                    actorRole: 'manager',
                    entityType: 'TimeOffRequest',
                    entityId: 'req-1',
                    action: AuditAction.REQUEST_APPROVED,
                },
                {
                    actorId: 'emp-1',
                    actorRole: 'manager',
                    entityType: 'LeaveBalance',
                    entityId: 'bal-1',
                    action: AuditAction.BALANCE_DEDUCTED,
                },
            ]);

            expect(repo.save).toHaveBeenCalledTimes(2);
        });

        it('continues writing remaining entries if one fails', async () => {
            repo.create.mockReturnValue({});
            repo.save
                .mockRejectedValueOnce(new Error('first fails'))
                .mockResolvedValueOnce({});

            await expect(
                service.writeMany([
                    {
                        actorId: 'emp-1',
                        actorRole: 'employee',
                        entityType: 'TimeOffRequest',
                        entityId: 'req-1',
                        action: AuditAction.REQUEST_SUBMITTED,
                    },
                    {
                        actorId: 'emp-1',
                        actorRole: 'manager',
                        entityType: 'LeaveBalance',
                        entityId: 'bal-1',
                        action: AuditAction.BALANCE_DEDUCTED,
                    },
                ]),
            ).resolves.not.toThrow();

            expect(repo.save).toHaveBeenCalledTimes(2);
        });
    });

    describe('snapshot', () => {
        it('creates a plain JSON snapshot of an entity', () => {
            const entity = { id: '1', balanceDays: 10, nested: { value: 'x' } };
            const snap = AuditService.snapshot(entity);
            expect(snap).toEqual({ id: '1', balanceDays: 10, nested: { value: 'x' } });
        });

        it('returns error object when entity is not serializable', () => {
            const circular: any = {};
            circular.self = circular;
            const snap = AuditService.snapshot(circular);
            expect(snap).toHaveProperty('error');
        });
    });

    describe('findAll', () => {
        it('returns paginated results', async () => {
            const logs = [{ id: 'log-1' }, { id: 'log-2' }];
            repo.findAndCount.mockResolvedValue([logs, 2]);

            const result = await service.findAll(1, 20);

            expect(result.data).toHaveLength(2);
            expect(result.meta.total).toBe(2);
            expect(result.meta.totalPages).toBe(1);
        });
    });
});