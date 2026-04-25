import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity';

export enum SyncType {
    BATCH = 'batch',
    REALTIME = 'realtime',
}

export enum SyncStatus {
    STARTED = 'started',
    COMPLETED = 'completed',
    FAILED = 'failed',
    PARTIAL = 'partial',
}

@Entity('hcm_sync_log')
export class HcmSyncLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'sync_type', type: 'simple-enum', enum: SyncType })
    syncType!: SyncType;

    @Column({ name: 'triggered_by', type: 'varchar', nullable: true })
    triggeredBy!: string | null;

    @ManyToOne(() => Employee, { nullable: true })
    @JoinColumn({ name: 'triggered_by' })
    triggeredByEmployee!: Employee;

    @Column({ type: 'simple-enum', enum: SyncStatus, default: SyncStatus.STARTED })
    status!: SyncStatus;

    @Column({ name: 'records_received', type: 'integer', nullable: true })
    recordsReceived!: number | null;

    @Column({ name: 'records_applied', type: 'integer', nullable: true })
    recordsApplied!: number | null;

    @Column({ name: 'records_failed', type: 'integer', nullable: true })
    recordsFailed!: number | null;

    @Column({ name: 'error_summary', type: 'text', nullable: true })
    errorSummary!: string | null;

    @CreateDateColumn({ name: 'started_at' })
    startedAt!: Date;

    @Column({ name: 'completed_at', type: 'datetime', nullable: true })
    completedAt!: Date | null;
}