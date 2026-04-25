export interface HcmBalanceRecord {
    hcmEmployeeId: string;
    hcmLocationId: string;
    leaveType: string;
    balanceDays: number;
    asOf: string;
}

export interface HcmBalanceResponse {
    hcmEmployeeId: string;
    hcmLocationId: string;
    balances: {
        leaveType: string;
        balanceDays: number;
        asOf: string;
    }[];
}

export interface HcmTimeOffSubmissionRequest {
    hcmEmployeeId: string;
    hcmLocationId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysRequested: number;
}

export interface HcmTimeOffSubmissionResponse {
    reference: string;
    status: 'accepted' | 'rejected';
    reason?: string;
    remainingBalance?: number;
}