export interface MockBalance {
    hcmEmployeeId: string;
    hcmLocationId: string;
    leaveType: string;
    balanceDays: number;
    asOf: string;
}

export interface MockBehavior {
    mode:
    | 'normal'
    | 'insufficient'
    | 'server_error'
    | 'timeout'
    | 'corrupt_response'
    | 'silent_accept';
    targetEmployeeId?: string;
}

export interface MockSubmission {
    reference: string;
    hcmEmployeeId: string;
    hcmLocationId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysRequested: number;
    submittedAt: string;
}

class MockStore {
    private balances: Map<string, MockBalance> = new Map();
    private behavior: MockBehavior = { mode: 'normal' };
    private submissions: MockSubmission[] = [];


    private balanceKey(
        hcmEmployeeId: string,
        hcmLocationId: string,
        leaveType: string,
    ): string {
        return `${hcmEmployeeId}::${hcmLocationId}::${leaveType}`;
    }

    setBalance(balance: MockBalance): void {
        const key = this.balanceKey(
            balance.hcmEmployeeId,
            balance.hcmLocationId,
            balance.leaveType,
        );
        this.balances.set(key, { ...balance });
    }

    getBalances(hcmEmployeeId: string, hcmLocationId: string): MockBalance[] {
        const result: MockBalance[] = [];
        for (const balance of this.balances.values()) {
            if (
                balance.hcmEmployeeId === hcmEmployeeId &&
                balance.hcmLocationId === hcmLocationId
            ) {
                result.push({ ...balance });
            }
        }
        return result;
    }

    deductBalance(
        hcmEmployeeId: string,
        hcmLocationId: string,
        leaveType: string,
        days: number,
    ): boolean {
        const key = this.balanceKey(hcmEmployeeId, hcmLocationId, leaveType);
        const balance = this.balances.get(key);

        if (!balance) return false;
        if (balance.balanceDays < days) return false;

        balance.balanceDays = Math.round((balance.balanceDays - days) * 100) / 100;
        balance.asOf = new Date().toISOString();
        this.balances.set(key, balance);
        return true;
    }

    incrementBalance(
        hcmEmployeeId: string,
        hcmLocationId: string,
        leaveType: string,
        days: number,
    ): void {
        const key = this.balanceKey(hcmEmployeeId, hcmLocationId, leaveType);
        const balance = this.balances.get(key);
        if (!balance) return;

        balance.balanceDays = Math.round((balance.balanceDays + days) * 100) / 100;
        balance.asOf = new Date().toISOString();
        this.balances.set(key, balance);
    }

    getAllBalances(): MockBalance[] {
        return Array.from(this.balances.values());
    }


    setBehavior(behavior: MockBehavior): void {
        this.behavior = behavior;
    }

    getBehavior(): MockBehavior {
        return this.behavior;
    }

    resetBehavior(): void {
        this.behavior = { mode: 'normal' };
    }


    recordSubmission(submission: MockSubmission): void {
        this.submissions.push(submission);
    }

    getSubmissions(): MockSubmission[] {
        return [...this.submissions];
    }

    getSubmissionsForEmployee(hcmEmployeeId: string): MockSubmission[] {
        return this.submissions.filter(
            (s) => s.hcmEmployeeId === hcmEmployeeId,
        );
    }


    reset(): void {
        this.balances.clear();
        this.behavior = { mode: 'normal' };
        this.submissions = [];
    }
}

export const store = new MockStore();