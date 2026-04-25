import { RequestStatus } from '../../../database/entities/time-off-request.entity';

export class TimeOffRequestResponseDto {
    id!: string;
    employeeId!: string;
    locationId!: string;
    leaveType!: string;
    startDate!: string;
    endDate!: string;
    daysRequested!: number;
    status!: RequestStatus;
    submittedAt!: Date;
    resolvedAt!: Date | null;
    resolvedBy!: string | null;
    rejectionReason!: string | null;
    hcmSubmissionRef!: string | null;
    hcmSubmittedAt!: Date | null;
    createdAt!: Date;
    updatedAt!: Date;

    static from(request: any): TimeOffRequestResponseDto {
        const dto = new TimeOffRequestResponseDto();
        dto.id = request.id;
        dto.employeeId = request.employeeId;
        dto.locationId = request.locationId;
        dto.leaveType = request.leaveType;
        dto.startDate = request.startDate;
        dto.endDate = request.endDate;
        dto.daysRequested = Number(request.daysRequested);
        dto.status = request.status;
        dto.submittedAt = request.submittedAt;
        dto.resolvedAt = request.resolvedAt;
        dto.resolvedBy = request.resolvedBy;
        dto.rejectionReason = request.rejectionReason;
        dto.hcmSubmissionRef = request.hcmSubmissionRef;
        dto.hcmSubmittedAt = request.hcmSubmittedAt;
        dto.createdAt = request.createdAt;
        dto.updatedAt = request.updatedAt;
        return dto;
    }
}