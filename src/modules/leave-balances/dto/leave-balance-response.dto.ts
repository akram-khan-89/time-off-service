export class LeaveBalanceResponseDto {
    id!: string;
    employeeId!: string;
    locationId!: string;
    leaveType!: string;
    balanceDays!: number;
    hcmSyncedAt!: Date;
    version!: number;

    static from(balance: any): LeaveBalanceResponseDto {
        const dto = new LeaveBalanceResponseDto();
        dto.id = balance.id;
        dto.employeeId = balance.employeeId;
        dto.locationId = balance.locationId;
        dto.leaveType = balance.leaveType;
        dto.balanceDays = Number(balance.balanceDays);
        dto.hcmSyncedAt = balance.hcmSyncedAt;
        dto.version = balance.version;
        return dto;
    }
}