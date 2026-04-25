import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Check,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Location } from './location.entity';

export enum RequestStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    CANCELLED = 'cancelled',
    WITHDRAWN = 'withdrawn',
}

@Entity('time_off_requests')
@Check(`"days_requested" > 0`)
@Index(['employeeId', 'status'])
export class TimeOffRequest {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'employee_id', type: 'varchar' })
    employeeId!: string;

    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'employee_id' })
    employee!: Employee;

    @Column({ name: 'location_id', type: 'varchar' })
    locationId!: string;

    @ManyToOne(() => Location)
    @JoinColumn({ name: 'location_id' })
    location!: Location;

    @Column({ name: 'leave_type', type: 'varchar', length: 50 })
    leaveType!: string;

    @Column({ name: 'start_date', type: 'date' })
    startDate!: string;

    @Column({ name: 'end_date', type: 'date' })
    endDate!: string;

    @Column({
        name: 'days_requested',
        type: 'decimal',
        precision: 6,
        scale: 2,
    })
    daysRequested!: number;

    @Column({
        type: 'simple-enum',
        enum: RequestStatus,
        default: RequestStatus.PENDING,
    })
    @Index()
    status!: RequestStatus;

    @Column({ name: 'submitted_at', type: 'datetime' })
    submittedAt!: Date;

    @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
    resolvedAt!: Date | null;

    @Column({ name: 'resolved_by', type: 'varchar', nullable: true })
    resolvedBy!: string | null;

    @ManyToOne(() => Employee, { nullable: true })
    @JoinColumn({ name: 'resolved_by' })
    resolver!: Employee;

    @Column({ name: 'rejection_reason', type: 'text', nullable: true })
    rejectionReason!: string | null;

    @Column({ name: 'hcm_submission_ref', type: 'varchar', length: 255, nullable: true })
    hcmSubmissionRef!: string | null;

    @Column({ name: 'hcm_submitted_at', type: 'datetime', nullable: true })
    hcmSubmittedAt!: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}