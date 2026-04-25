import {
    Injectable,
    UnauthorizedException,
    NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../database/entities/employee.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(Employee)
        private readonly employeeRepo: Repository<Employee>,
        private readonly jwtService: JwtService,
    ) { }

    async login(dto: LoginDto): Promise<{ accessToken: string; employee: Partial<Employee> }> {
        const employee = await this.employeeRepo.findOne({
            where: { email: dto.email, isActive: true },
        });

        if (!employee) {
            throw new UnauthorizedException({
                message: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS',
            });
        }

        if (dto.password !== 'password123') {
            throw new UnauthorizedException({
                message: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS',
            });
        }

        const payload: JwtPayload = {
            sub: employee.id,
            email: employee.email,
            role: employee.role,
            hcmEmployeeId: employee.hcmEmployeeId,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            accessToken,
            employee: {
                id: employee.id,
                email: employee.email,
                fullName: employee.fullName,
                role: employee.role,
            },
        };
    }

    verifyToken(token: string): JwtPayload {
        try {
            return this.jwtService.verify<JwtPayload>(token);
        } catch {
            throw new UnauthorizedException({
                message: 'Invalid token',
                code: 'INVALID_TOKEN',
            });
        }
    }
}