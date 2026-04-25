import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { Employee } from './database/entities/employee.entity';
import { Location } from './database/entities/location.entity';
import { LeaveBalance } from './database/entities/leave-balance.entity';
import { TimeOffRequest } from './database/entities/time-off-request.entity';
import { HcmSyncLog } from './database/entities/hcm-sync-log.entity';
import { AuditLog } from './database/entities/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('database.path'),
        entities: [
          Employee,
          Location,
          LeaveBalance,
          TimeOffRequest,
          HcmSyncLog,
          AuditLog
        ],
        synchronize: true,
        logging: config.get<string>('nodeEnv') === 'development',
      }),
    }),
  ],
})
export class AppModule { }