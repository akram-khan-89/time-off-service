import {
    Processor,
    Process,
    OnQueueFailed,
    OnQueueCompleted,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncService } from '../sync.service';
import { QUEUE_NAMES, JOB_NAMES } from '../../queue/queue.constants';
import { BatchSyncJobData } from '../interfaces/batch-job.interface';
import {
    HcmSyncLog,
    SyncStatus,
} from '../../../database/entities/hcm-sync-log.entity';

@Processor(QUEUE_NAMES.BATCH_SYNC)
export class BatchSyncProcessor {
    private readonly logger = new Logger(BatchSyncProcessor.name);

    constructor(
        private readonly syncService: SyncService,
        @InjectRepository(HcmSyncLog)
        private readonly syncLogRepo: Repository<HcmSyncLog>,
    ) { }

    @Process(JOB_NAMES.PROCESS_BATCH)
    async handleBatchSync(job: Job<BatchSyncJobData>): Promise<void> {
        this.logger.log(
            `Starting batch sync job — jobId: ${job.id}, syncLogId: ${job.data.syncLogId}`,
        );

        await this.syncService.processBatch(job.data);
    }

    @OnQueueFailed()
    async onFailed(job: Job<BatchSyncJobData>, err: Error): Promise<void> {
        this.logger.error(
            `Batch sync job failed permanently — jobId: ${job.id}, ` +
            `syncLogId: ${job.data.syncLogId}, attempts: ${job.attemptsMade}`,
            err.stack,
        );

        if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
            await this.syncLogRepo.update(job.data.syncLogId, {
                status: SyncStatus.FAILED,
                errorSummary: err.message,
                completedAt: new Date(),
            });
        }
    }

    @OnQueueCompleted()
    onCompleted(job: Job<BatchSyncJobData>): void {
        this.logger.log(
            `Batch sync job completed — jobId: ${job.id}, syncLogId: ${job.data.syncLogId}`,
        );
    }
}