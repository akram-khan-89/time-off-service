import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequest } from '../../database/entities/time-off-request.entity';
import { TimeOffRequestsService } from './time-off-requests.service';
import { TimeOffRequestsController } from './time-off-requests.controller';
import { AuthModule } from '../auth/auth.module';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';
import { HcmModule } from '../hcm/hcm.module';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';
import { LocationsModule } from '../locations/locations.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TimeOffRequest]),
        AuthModule,
        LeaveBalancesModule,
        HcmModule,
        AuditModule,
        EmployeesModule,
        LocationsModule,
    ],
    controllers: [TimeOffRequestsController],
    providers: [TimeOffRequestsService],
    exports: [TimeOffRequestsService],
})
export class TimeOffRequestsModule { }