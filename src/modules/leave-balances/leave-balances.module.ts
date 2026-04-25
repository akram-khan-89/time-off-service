import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from '../../database/entities/leave-balance.entity';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveBalancesController } from './leave-balances.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([LeaveBalance]),
        AuthModule,
    ],
    controllers: [LeaveBalancesController],
    providers: [LeaveBalancesService],
    exports: [LeaveBalancesService],
})
export class LeaveBalancesModule { }