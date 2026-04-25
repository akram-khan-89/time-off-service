import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { HcmClient } from '../../src/modules/hcm/hcm.client';
import {
    HcmUnavailableException,
    HcmRejectionException,
} from '../../src/common/exceptions';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HcmClient', () => {
    let client: HcmClient;

    const mockConfigService = {
        get: jest.fn((key: string) => {
            const config: Record<string, any> = {
                'hcm.baseUrl': 'http://localhost:3099',
                'hcm.timeoutMs': 5000,
            };
            return config[key];
        }),
    };

    const mockHttp = {
        get: jest.fn(),
        post: jest.fn(),
    };

    beforeEach(async () => {
        // Mock axios.create to return our controlled instance
        mockedAxios.create = jest.fn().mockReturnValue(mockHttp);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HcmClient,
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        client = module.get(HcmClient);
    });

    afterEach(() => jest.clearAllMocks());

    // ─── getBalances ──────────────────────────────────────────────────────────

    describe('getBalances', () => {
        const validResponse = {
            data: {
                hcmEmployeeId: 'HCM-EMP-001',
                hcmLocationId: 'LOC-NY-001',
                balances: [
                    { leaveType: 'annual', balanceDays: 10, asOf: '2024-01-01T00:00:00Z' },
                ],
            },
        };

        it('returns validated balance response on success', async () => {
            mockHttp.get.mockResolvedValueOnce(validResponse);

            const result = await client.getBalances('HCM-EMP-001', 'LOC-NY-001');

            expect(result.hcmEmployeeId).toBe('HCM-EMP-001');
            expect(result.balances).toHaveLength(1);
            expect(result.balances[0].balanceDays).toBe(10);
        });

        it('throws HcmUnavailableException on network error', async () => {
            const networkError = new Error('Network Error');
            (networkError as any).isAxiosError = true;
            (networkError as any).response = undefined;
            mockedAxios.isAxiosError = (() => true) as any; mockHttp.get.mockRejectedValue(networkError);

            await expect(
                client.getBalances('HCM-EMP-001', 'LOC-NY-001'),
            ).rejects.toThrow(HcmUnavailableException);
        });

        it('throws HcmUnavailableException after all retries exhausted on 500', async () => {
            const serverError = {
                isAxiosError: true,
                response: { status: 500 },
                message: 'Server Error',
            };
            mockedAxios.isAxiosError = (() => true) as any; mockHttp.get.mockRejectedValue(serverError);

            await expect(
                client.getBalances('HCM-EMP-001', 'LOC-NY-001'),
            ).rejects.toThrow(HcmUnavailableException);

            // Should have retried 3 times
            expect(mockHttp.get).toHaveBeenCalledTimes(3);
        });

        it('throws HcmUnavailableException when response shape is invalid', async () => {
            mockHttp.get.mockResolvedValueOnce({
                data: { garbage: true, notWhatWeExpected: 'yes' },
            });

            await expect(
                client.getBalances('HCM-EMP-001', 'LOC-NY-001'),
            ).rejects.toThrow(HcmUnavailableException);
        });

        it('does not retry on 4xx errors', async () => {
            const clientError = {
                isAxiosError: true,
                response: { status: 422, data: { reason: 'Bad request' } },
            };
            mockedAxios.isAxiosError = (() => true) as any; mockHttp.get.mockRejectedValue(clientError);

            await expect(
                client.getBalances('HCM-EMP-001', 'LOC-NY-001'),
            ).rejects.toThrow(HcmRejectionException);

            // Must NOT retry — only 1 call
            expect(mockHttp.get).toHaveBeenCalledTimes(1);
        });

        it('succeeds on second attempt after first fails with 500', async () => {
            const serverError = {
                isAxiosError: true,
                response: { status: 500 },
                message: 'Server Error',
            };
            mockedAxios.isAxiosError = (() => true) as any; mockHttp.get
                .mockRejectedValueOnce(serverError)
                .mockResolvedValueOnce(validResponse);

            const result = await client.getBalances('HCM-EMP-001', 'LOC-NY-001');

            expect(result.hcmEmployeeId).toBe('HCM-EMP-001');
            expect(mockHttp.get).toHaveBeenCalledTimes(2);
        });
    });

    // ─── submitTimeOff ────────────────────────────────────────────────────────

    describe('submitTimeOff', () => {
        const payload = {
            hcmEmployeeId: 'HCM-EMP-001',
            hcmLocationId: 'LOC-NY-001',
            leaveType: 'annual',
            startDate: '2024-02-01',
            endDate: '2024-02-03',
            daysRequested: 3,
        };

        const acceptedResponse = {
            data: {
                reference: 'HCM-REF-123',
                status: 'accepted',
                remainingBalance: 7,
            },
        };

        it('returns submission reference on acceptance', async () => {
            mockHttp.post.mockResolvedValueOnce(acceptedResponse);

            const result = await client.submitTimeOff(payload);

            expect(result.reference).toBe('HCM-REF-123');
            expect(result.status).toBe('accepted');
        });

        it('throws HcmRejectionException when HCM rejects with status rejected', async () => {
            mockHttp.post.mockResolvedValueOnce({
                data: {
                    reference: 'HCM-REF-456',
                    status: 'rejected',
                    reason: 'Insufficient balance',
                },
            });

            await expect(client.submitTimeOff(payload)).rejects.toThrow(
                HcmRejectionException,
            );
        });

        it('throws HcmRejectionException on 422 response', async () => {
            const rejection = {
                isAxiosError: true,
                response: {
                    status: 422,
                    data: { reason: 'Insufficient balance in HCM' },
                },
            };
            mockedAxios.isAxiosError = (() => true) as any; mockHttp.post.mockRejectedValue(rejection);

            await expect(client.submitTimeOff(payload)).rejects.toThrow(
                HcmRejectionException,
            );
            // No retry on 422
            expect(mockHttp.post).toHaveBeenCalledTimes(1);
        });

        it('retries 3 times on 500 then throws HcmUnavailableException', async () => {
            const serverError = {
                isAxiosError: true,
                response: { status: 500 },
                message: 'HCM down',
            };
            mockedAxios.isAxiosError = (() => true) as any; mockHttp.post.mockRejectedValue(serverError);

            await expect(client.submitTimeOff(payload)).rejects.toThrow(
                HcmUnavailableException,
            );
            expect(mockHttp.post).toHaveBeenCalledTimes(3);
        });

        it('throws HcmUnavailableException when response shape is corrupt', async () => {
            mockHttp.post.mockResolvedValueOnce({
                data: { garbage: true },
            });

            await expect(client.submitTimeOff(payload)).rejects.toThrow(
                HcmUnavailableException,
            );
        });
    });
});