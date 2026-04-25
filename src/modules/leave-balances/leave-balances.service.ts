import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { LeaveBalance } from '../../database/entities/leave-balance.entity';
import { CurrentUserData } from '../auth/interfaces/current-user.interface';
import { LeaveBalanceResponseDto } from './dto/leave-balance-response.dto';

@Injectable()
export class LeaveBalancesService {
    private readonly logger = new Logger(LeaveBalancesService.name);

    constructor(
        @InjectRepository(LeaveBalance)
        private readonly leaveBalanceRepo: Repository<LeaveBalance>,
        private readonly configService: ConfigService,
    ) { }


    async getMyBalances(
        currentUser: CurrentUserData,
    ): Promise<LeaveBalanceResponseDto[]> {
        const balances = await this.leaveBalanceRepo.find({
            where: { employeeId: currentUser.id },
            order: { leaveType: 'ASC' },
        });
        return balances.map(LeaveBalanceResponseDto.from);
    }

    async getBalancesByEmployeeId(
        employeeId: string,
        currentUser: CurrentUserData,
    ): Promise<LeaveBalanceResponseDto[]> {
        this.assertCanViewEmployee(employeeId, currentUser);

        const balances = await this.leaveBalanceRepo.find({
            where: { employeeId },
            order: { leaveType: 'ASC' },
        });

        return balances.map(LeaveBalanceResponseDto.from);
    }

    async getBalanceByEmployeeAndLocation(
        employeeId: string,
        locationId: string,
        currentUser: CurrentUserData,
    ): Promise<LeaveBalanceResponseDto[]> {
        this.assertCanViewEmployee(employeeId, currentUser);

        const balances = await this.leaveBalanceRepo.find({
            where: { employeeId, locationId },
            order: { leaveType: 'ASC' },
        });

        if (!balances.length) {
            throw new NotFoundException({
                message: 'No balances found for this employee and location',
                code: 'BALANCE_NOT_FOUND',
            });
        }

        return balances.map(LeaveBalanceResponseDto.from);
    }

    async findRaw(
        employeeId: string,
        locationId: string,
        leaveType: string,
    ): Promise<LeaveBalance | null> {
        return this.leaveBalanceRepo.findOne({
            where: { employeeId, locationId, leaveType },
        });
    }

    async findRawOrFail(
        employeeId: string,
        locationId: string,
        leaveType: string,
    ): Promise<LeaveBalance> {
        const balance = await this.findRaw(employeeId, locationId, leaveType);

        if (!balance) {
            throw new NotFoundException({
                message: `No ${leaveType} balance found for employee at this location`,
                code: 'BALANCE_NOT_FOUND',
            });
        }

        return balance;
    }

    isStale(balance: LeaveBalance): boolean {
        const thresholdHours = this.configService.get<number>(
            'hcm.staleThresholdHours',
            4,
        );
        const thresholdMs = thresholdHours * 60 * 60 * 1000;
        const ageMs = Date.now() - new Date(balance.hcmSyncedAt).getTime();
        return ageMs > thresholdMs;
    }

    async upsertBalance(data: {
        employeeId: string;
        locationId: string;
        leaveType: string;
        balanceDays: number;
        hcmSyncedAt: Date;
    }): Promise<LeaveBalance> {
        let balance = await this.findRaw(
            data.employeeId,
            data.locationId,
            data.leaveType,
        );

        if (balance) {
            balance.balanceDays = data.balanceDays;
            balance.hcmSyncedAt = data.hcmSyncedAt;
        } else {
            balance = this.leaveBalanceRepo.create({
                employeeId: data.employeeId,
                locationId: data.locationId,
                leaveType: data.leaveType,
                balanceDays: data.balanceDays,
                hcmSyncedAt: data.hcmSyncedAt,
            });
        }

        return this.leaveBalanceRepo.save(balance);
    }

    async deductBalance(
        employeeId: string,
        locationId: string,
        leaveType: string,
        daysToDeduct: number,
    ): Promise<LeaveBalance> {
        const balance = await this.findRawOrFail(employeeId, locationId, leaveType);

        if (Number(balance.balanceDays) < daysToDeduct) {
            throw new NotFoundException({
                message: 'Insufficient balance for deduction',
                code: 'INSUFFICIENT_BALANCE',
            });
        }

        balance.balanceDays = Number(balance.balanceDays) - daysToDeduct;
        balance.hcmSyncedAt = new Date();

        try {
            return await this.leaveBalanceRepo.save(balance);
        } catch (err: any) {
            if (
                err.name === 'OptimisticLockVersionMismatchError' ||
                (err.message && err.message.includes('optimistic lock'))
            ) {
                this.logger.warn(
                    `Optimistic lock conflict deducting balance for employee ${employeeId}`,
                );
                throw {
                    isOptimisticLockError: true,
                    message: 'Balance was modified concurrently. Please retry.',
                };
            }

            if (
                err.message &&
                (err.message.includes('CHECK') || err.message.includes('constraint'))
            ) {
                this.logger.warn(
                    `DB CHECK constraint prevented negative balance for employee ${employeeId}`,
                );
                throw new NotFoundException({
                    message: 'Insufficient balance — database constraint enforced',
                    code: 'INSUFFICIENT_BALANCE',
                });
            }

            throw err;
        }
    }

    private assertCanViewEmployee(
        employeeId: string,
        currentUser: CurrentUserData,
    ): void {
        if (currentUser.role === 'employee' && currentUser.id !== employeeId) {
            throw new ForbiddenException({
                message: 'You can only view your own balances',
                code: 'FORBIDDEN',
            });
        }
    }
}