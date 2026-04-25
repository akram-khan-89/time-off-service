import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../database/entities/employee.entity';
import { CurrentUserData } from '../auth/interfaces/current-user.interface';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';

@Injectable()
export class EmployeesService {
    constructor(
        @InjectRepository(Employee)
        private readonly employeeRepo: Repository<Employee>,
    ) { }

    async findMe(currentUser: CurrentUserData): Promise<EmployeeResponseDto> {
        const employee = await this.employeeRepo.findOne({
            where: { id: currentUser.id, isActive: true },
        });

        if (!employee) {
            throw new NotFoundException({
                message: 'Employee not found',
                code: 'EMPLOYEE_NOT_FOUND',
            });
        }

        return EmployeeResponseDto.from(employee);
    }

    async findById(
        id: string,
        currentUser: CurrentUserData,
    ): Promise<EmployeeResponseDto> {
        // Managers can only view their direct reports or themselves
        if (currentUser.role === 'manager') {
            const employee = await this.employeeRepo.findOne({
                where: { id, isActive: true },
            });

            if (!employee) {
                throw new NotFoundException({
                    message: 'Employee not found',
                    code: 'EMPLOYEE_NOT_FOUND',
                });
            }

            const isSelf = employee.id === currentUser.id;
            const isDirectReport = employee.managerId === currentUser.id;

            if (!isSelf && !isDirectReport) {
                throw new ForbiddenException({
                    message: 'You can only view your own profile or your direct reports',
                    code: 'FORBIDDEN',
                });
            }

            return EmployeeResponseDto.from(employee);
        }

        // Admin can view anyone
        const employee = await this.employeeRepo.findOne({
            where: { id, isActive: true },
        });

        if (!employee) {
            throw new NotFoundException({
                message: 'Employee not found',
                code: 'EMPLOYEE_NOT_FOUND',
            });
        }

        return EmployeeResponseDto.from(employee);
    }

    async findAll(dto: ListEmployeesDto): Promise<{
        data: EmployeeResponseDto[];
        meta: { page: number; limit: number; total: number; totalPages: number };
    }> {
        const [employees, total] = await this.employeeRepo.findAndCount({
            where: { isActive: true },
            skip: (dto.page - 1) * dto.limit,
            take: dto.limit,
            order: { fullName: 'ASC' },
        });

        return {
            data: employees.map(EmployeeResponseDto.from),
            meta: {
                page: dto.page,
                limit: dto.limit,
                total,
                totalPages: Math.ceil(total / dto.limit),
            },
        };
    }

    // Used internally by other modules — not exposed via HTTP
    async findByIdRaw(id: string): Promise<Employee> {
        const employee = await this.employeeRepo.findOne({
            where: { id, isActive: true },
        });

        if (!employee) {
            throw new NotFoundException({
                message: 'Employee not found',
                code: 'EMPLOYEE_NOT_FOUND',
            });
        }

        return employee;
    }

    // Used internally to resolve hcmEmployeeId → internal employee
    async findByHcmId(hcmEmployeeId: string): Promise<Employee | null> {
        return this.employeeRepo.findOne({
            where: { hcmEmployeeId, isActive: true },
        });
    }

    // Used in seeding and tests
    async create(data: Partial<Employee>): Promise<Employee> {
        const employee = this.employeeRepo.create(data);
        return this.employeeRepo.save(employee);
    }
}