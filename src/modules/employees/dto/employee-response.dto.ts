import { EmployeeRole } from '../../../database/entities/employee.entity';

export class EmployeeResponseDto {
    id!: string;
    hcmEmployeeId!: string;
    email!: string;
    fullName!: string;
    role!: EmployeeRole;
    managerId!: string | null;
    isActive!: boolean;
    createdAt!: Date;

    static from(employee: any): EmployeeResponseDto {
        const dto = new EmployeeResponseDto();
        dto.id = employee.id;
        dto.hcmEmployeeId = employee.hcmEmployeeId;
        dto.email = employee.email;
        dto.fullName = employee.fullName;
        dto.role = employee.role;
        dto.managerId = employee.managerId;
        dto.isActive = employee.isActive;
        dto.createdAt = employee.createdAt;
        return dto;
    }
}