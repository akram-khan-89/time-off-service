import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
    VersionColumn,
    Check,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Location } from './location.entity';

@Entity('leave_balances')
@Unique(['employeeId', 'locationId', 'leaveType'])
@Check(`"balance_days" >= 0`)
export class LeaveBalance {
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

    @Column({
        name: 'balance_days',
        type: 'decimal',
        precision: 6,
        scale: 2,
        default: 0,
    })
    balanceDays!: number;

    @Column({ name: 'hcm_synced_at', type: 'datetime' })
    hcmSyncedAt!: Date;

    // Optimistic locking — TypeORM auto-increments this on every save
    @VersionColumn({ default: 0 })
    version!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}