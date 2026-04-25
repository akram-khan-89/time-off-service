import { BatchBalanceRecordDto } from '../dto/batch-ingest.dto';

export interface BatchSyncJobData {
    syncLogId: string;
    records: BatchBalanceRecordDto[];
    triggeredBy: string | null;
}