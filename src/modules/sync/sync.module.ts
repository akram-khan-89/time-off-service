import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HcmSyncLog } from '../../database/entities/hcm-sync-log.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { BatchSyncProcessor } from './processors/batch-sync.processor';
import { QueueModule } from '../queue/queue.module';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';
import { EmployeesModule } from '../employees/employees.module';
import { LocationsModule } from '../locations/locations.module';
import { AuditModule } from '../audit/audit.module';
import { HcmModule } from '../hcm/hcm.module';
import { AuthModule } from '../auth/auth.module';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
    imports: [
        TypeOrmModule.forFeature([HcmSyncLog]),
        BullModule.registerQueue({ name: QUEUE_NAMES.BATCH_SYNC }),
        QueueModule,
        LeaveBalancesModule,
        EmployeesModule,
        LocationsModule,
        AuditModule,
        HcmModule,
        AuthModule,
    ],
    controllers: [SyncController],
    providers: [SyncService, BatchSyncProcessor],
    exports: [SyncService],
})
export class SyncModule { }