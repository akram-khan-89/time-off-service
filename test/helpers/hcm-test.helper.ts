import axios from 'axios';

const HCM_TEST_BASE = 'http://localhost:3099/hcm/__test__';

export const HcmTestHelper = {
    async setBalance(
        hcmEmployeeId: string,
        hcmLocationId: string,
        leaveType: string,
        balanceDays: number,
    ): Promise<void> {
        await axios.post(`${HCM_TEST_BASE}/set-balance`, {
            hcmEmployeeId,
            hcmLocationId,
            leaveType,
            balanceDays,
        });
    },

    async setBehavior(
        mode:
            | 'normal'
            | 'insufficient'
            | 'server_error'
            | 'timeout'
            | 'corrupt_response'
            | 'silent_accept',
        targetEmployeeId?: string,
    ): Promise<void> {
        await axios.post(`${HCM_TEST_BASE}/set-behavior`, {
            mode,
            targetEmployeeId,
        });
    },

    async reset(): Promise<void> {
        await axios.post(`${HCM_TEST_BASE}/reset`);
    },

    async incrementBalance(
        hcmEmployeeId: string,
        hcmLocationId: string,
        leaveType: string,
        days: number,
    ): Promise<void> {
        await axios.post(`${HCM_TEST_BASE}/increment-balance`, {
            hcmEmployeeId,
            hcmLocationId,
            leaveType,
            days,
        });
    },

    async getBalances(): Promise<any[]> {
        const res = await axios.get(`${HCM_TEST_BASE}/balances`);
        return res.data.balances;
    },

    async getSubmissions(): Promise<any[]> {
        const res = await axios.get(`${HCM_TEST_BASE}/submissions`);
        return res.data.submissions;
    },
};