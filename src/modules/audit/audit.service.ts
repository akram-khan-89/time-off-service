import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { AuditEntryData } from './interfaces/audit-entry.interface';

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(
        @InjectRepository(AuditLog)
        private readonly auditLogRepo: Repository<AuditLog>,
    ) { }

    async write(entry: AuditEntryData): Promise<void> {
        try {
            const log = this.auditLogRepo.create({
                actorId: entry.actorId,
                actorRole: entry.actorRole,
                entityType: entry.entityType,
                entityId: entry.entityId,
                action: entry.action,
                beforeState: entry.beforeState ?? null,
                afterState: entry.afterState ?? null,
                metadata: entry.metadata ?? null,
            });

            await this.auditLogRepo.save(log);
        } catch (err) {
            this.logger.error(
                `Failed to write audit log — action: ${entry.action}, ` +
                `entity: ${entry.entityType}:${entry.entityId}`,
                err instanceof Error ? err.stack : String(err),
            );
        }
    }

    async writeMany(entries: AuditEntryData[]): Promise<void> {
        for (const entry of entries) {
            await this.write(entry);
        }
    }

    async findByEntity(
        entityType: string,
        entityId: string,
    ): Promise<AuditLog[]> {
        return this.auditLogRepo.find({
            where: { entityType, entityId },
            order: { occurredAt: 'DESC' },
        });
    }

    async findByActor(actorId: string): Promise<AuditLog[]> {
        return this.auditLogRepo.find({
            where: { actorId },
            order: { occurredAt: 'DESC' },
            take: 100,
        });
    }

    async findAll(page: number = 1, limit: number = 20): Promise<{
        data: AuditLog[];
        meta: { page: number; limit: number; total: number; totalPages: number };
    }> {
        const [data, total] = await this.auditLogRepo.findAndCount({
            order: { occurredAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    static snapshot(entity: unknown): Record<string, unknown> {
        try {
            return JSON.parse(JSON.stringify(entity));
        } catch {
            return { error: 'could not serialize entity' };
        }
    }
}