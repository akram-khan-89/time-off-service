import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';

export enum EmployeeRole {
    EMPLOYEE = 'employee',
    MANAGER = 'manager',
    ADMIN = 'admin',
}

@Entity('employees')
export class Employee {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index({ unique: true })
    @Column({ name: 'hcm_employee_id', type: 'varchar', length: 100 })
    hcmEmployeeId!: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 255 })
    email!: string;

    @Column({ name: 'full_name', type: 'varchar', length: 255 })
    fullName!: string;

    @Column({
        type: 'simple-enum',
        enum: EmployeeRole,
        default: EmployeeRole.EMPLOYEE,
    })
    role!: EmployeeRole;

    @Column({ name: 'manager_id', type: 'varchar', nullable: true })
    managerId!: string | null;

    @ManyToOne(() => Employee, (employee) => employee.subordinates, {
        nullable: true,
    })
    @JoinColumn({ name: 'manager_id' })
    manager!: Employee;

    @OneToMany(() => Employee, (employee) => employee.manager)
    subordinates!: Employee[];

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive!: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    @DeleteDateColumn({ name: 'deleted_at', nullable: true })
    deletedAt!: Date | null;
}