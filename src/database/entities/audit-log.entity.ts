import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('audit_log')
@Index(['entityType', 'entityId'])
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    // null = system-triggered (batch sync, scheduler)
    @Column({ name: 'actor_id', type: 'varchar', nullable: true })
    actorId!: string | null;

    @Column({ name: 'actor_role', type: 'varchar', length: 50, nullable: true })
    actorRole!: string | null;

    @Column({ name: 'entity_type', type: 'varchar', length: 100 })
    entityType!: string;

    @Column({ name: 'entity_id', type: 'varchar' })
    entityId!: string;

    @Column({ type: 'varchar', length: 100 })
    action!: string;

    // JSON snapshot of state before the action
    @Column({ name: 'before_state', type: 'simple-json', nullable: true })
    beforeState!: Record<string, unknown> | null;

    // JSON snapshot of state after the action
    @Column({ name: 'after_state', type: 'simple-json', nullable: true })
    afterState!: Record<string, unknown> | null;

    // Extra context: HCM ref, sync log id, etc.
    @Column({ type: 'simple-json', nullable: true })
    metadata!: Record<string, unknown> | null;

    @CreateDateColumn({ name: 'occurred_at' })
    occurredAt!: Date;
}