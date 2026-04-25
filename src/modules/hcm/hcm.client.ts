import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
    HcmUnavailableException,
    HcmRejectionException,
} from '../../common/exceptions';
import {
    HcmBalanceResponseDto,
    HcmSubmissionResponseDto,
} from './dto/hcm-balance-response.dto';
import {
    HcmTimeOffSubmissionRequest,
} from './interfaces/hcm-balance.interface';

@Injectable()
export class HcmClient {
    private readonly logger = new Logger(HcmClient.name);
    private readonly http: AxiosInstance;
    private readonly maxRetries = 3;
    private readonly retryDelaysMs = [1000, 2000, 4000];

    constructor(private readonly configService: ConfigService) {
        this.http = axios.create({
            baseURL: this.configService.get<string>('hcm.baseUrl'),
            timeout: this.configService.get<number>('hcm.timeoutMs'),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
    }

    async getBalances(
        hcmEmployeeId: string,
        hcmLocationId: string,
    ): Promise<HcmBalanceResponseDto> {
        const url = `/hcm/employees/${hcmEmployeeId}/balances`;

        this.logger.log(
            `Fetching HCM balances — employeeId: ${hcmEmployeeId}, locationId: ${hcmLocationId}`,
        );

        const raw = await this.executeWithRetry(() =>
            this.http.get(url, { params: { locationId: hcmLocationId } }),
        );

        return this.validateBalanceResponse(raw);
    }

    async submitTimeOff(
        payload: HcmTimeOffSubmissionRequest,
    ): Promise<HcmSubmissionResponseDto> {
        const url = `/hcm/employees/${payload.hcmEmployeeId}/time-off`;

        this.logger.log(
            `Submitting time-off to HCM — employeeId: ${payload.hcmEmployeeId}, ` +
            `locationId: ${payload.hcmLocationId}, days: ${payload.daysRequested}`,
        );

        const raw = await this.executeWithRetry(() =>
            this.http.post(url, {
                hcmLocationId: payload.hcmLocationId,
                leaveType: payload.leaveType,
                startDate: payload.startDate,
                endDate: payload.endDate,
                daysRequested: payload.daysRequested,
            }),
        );

        const response = await this.validateSubmissionResponse(raw);

        if (response.status === 'rejected') {
            this.logger.warn(
                `HCM rejected time-off submission for employee ${payload.hcmEmployeeId}: ${response.reason}`,
            );
            throw new HcmRejectionException(response.reason);
        }

        return response;
    }


    private async executeWithRetry<T>(
        fn: () => Promise<{ data: T }>,
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fn();
                return response.data;
            } catch (err) {
                lastError = err as Error;

                const isRetryable = this.isRetryableError(err);

                if (!isRetryable) {
                    // HCM business errors (4xx) — do not retry
                    this.logger.warn(
                        `HCM returned non-retryable error on attempt ${attempt}: ${this.describeError(err)}`,
                    );
                    throw this.mapHcmError(err);
                }

                if (attempt < this.maxRetries) {
                    const delayMs = this.retryDelaysMs[attempt - 1];
                    this.logger.warn(
                        `HCM call failed (attempt ${attempt}/${this.maxRetries}), ` +
                        `retrying in ${delayMs}ms — ${this.describeError(err)}`,
                    );
                    await this.sleep(delayMs);
                }
            }
        }

        this.logger.error(
            `HCM unreachable after ${this.maxRetries} attempts: ${lastError?.message}`,
        );
        throw new HcmUnavailableException();
    }

    private isRetryableError(err: unknown): boolean {
        if (!axios.isAxiosError(err)) return false;

        const axiosErr = err as AxiosError;

        if (!axiosErr.response) return true;

        const status = axiosErr.response.status;

        if (status >= 500) return true;

        return false;
    }

    private mapHcmError(err: unknown): Error {
        if (!axios.isAxiosError(err)) return err as Error;

        const axiosErr = err as AxiosError<{ message?: string; reason?: string }>;

        if (!axiosErr.response) {
            return new HcmUnavailableException();
        }

        const status = axiosErr.response.status;
        const body = axiosErr.response.data;

        if (status === 422 || status === 400) {
            const reason = body?.reason || body?.message || 'HCM rejected the request';
            return new HcmRejectionException(reason);
        }

        return new HcmUnavailableException();
    }

    private describeError(err: unknown): string {
        if (axios.isAxiosError(err)) {
            const axiosErr = err as AxiosError;
            if (!axiosErr.response) return `network error: ${axiosErr.message}`;
            return `HTTP ${axiosErr.response.status}`;
        }
        return String(err);
    }

    private async validateBalanceResponse(raw: unknown): Promise<HcmBalanceResponseDto> {
        const dto = plainToInstance(HcmBalanceResponseDto, raw);
        const errors = await validate(dto);

        if (errors.length > 0) {
            this.logger.error(
                `HCM balance response failed validation: ${JSON.stringify(errors)}`,
            );
            throw new HcmUnavailableException();
        }

        return dto;
    }

    private async validateSubmissionResponse(raw: unknown): Promise<HcmSubmissionResponseDto> {
        const dto = plainToInstance(HcmSubmissionResponseDto, raw);
        const errors = await validate(dto, { skipMissingProperties: true });

        if (errors.length > 0) {
            this.logger.error(
                `HCM submission response failed validation: ${JSON.stringify(errors)}`,
            );
            throw new HcmUnavailableException();
        }

        return dto;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}