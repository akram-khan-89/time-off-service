import { SyncStatus, SyncType } from "src/database/entities/hcm-sync-log.entity";

export class SyncLogResponseDto {
    id!: string;
    syncType!: SyncType;
    triggeredBy!: string | null;
    status!: SyncStatus;
    recordsReceived!: number | null;
    recordsApplied!: number | null;
    recordsFailed!: number | null;
    errorSummary!: string | null;
    startedAt!: Date;
    completedAt!: Date | null;

    static from(log: any): SyncLogResponseDto {
        const dto = new SyncLogResponseDto();
        dto.id = log.id;
        dto.syncType = log.syncType;
        dto.triggeredBy = log.triggeredBy;
        dto.status = log.status;
        dto.recordsReceived = log.recordsReceived;
        dto.recordsApplied = log.recordsApplied;
        dto.recordsFailed = log.recordsFailed;
        dto.errorSummary = log.errorSummary;
        dto.startedAt = log.startedAt;
        dto.completedAt = log.completedAt;
        return dto;
    }
}