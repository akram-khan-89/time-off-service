import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';

@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                redis: {
                    host: config.get<string>('redis.host'),
                    port: config.get<number>('redis.port'),
                },
            }),
        }),
        BullModule.registerQueue({
            name: QUEUE_NAMES.BATCH_SYNC,
        }),
    ],
    exports: [
        BullModule,
    ],
})
export class QueueModule { }