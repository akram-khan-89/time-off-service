import { HttpException, HttpStatus } from '@nestjs/common';

export class InsufficientBalanceException extends HttpException {
    constructor() {
        super(
            { message: 'Insufficient leave balance', code: 'INSUFFICIENT_BALANCE' },
            HttpStatus.UNPROCESSABLE_ENTITY,
        );
    }
}

export class HcmUnavailableException extends HttpException {
    constructor() {
        super(
            { message: 'HCM system is currently unavailable', code: 'HCM_UNAVAILABLE' },
            HttpStatus.SERVICE_UNAVAILABLE,
        );
    }
}

export class HcmRejectionException extends HttpException {
    constructor(reason?: string) {
        super(
            {
                message: reason || 'HCM rejected the request',
                code: 'HCM_REJECTION',
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
        );
    }
}

export class BalanceConflictException extends HttpException {
    constructor() {
        super(
            { message: 'Balance conflict detected between HCM and local state', code: 'BALANCE_CONFLICT' },
            HttpStatus.CONFLICT,
        );
    }
}

export class InvalidStateTransitionException extends HttpException {
    constructor(from: string, to: string) {
        super(
            {
                message: `Cannot transition request from '${from}' to '${to}'`,
                code: 'INVALID_STATE_TRANSITION',
            },
            HttpStatus.CONFLICT,
        );
    }
}

export class StaleBalanceException extends HttpException {
    constructor() {
        super(
            { message: 'Balance data is stale and could not be refreshed', code: 'STALE_BALANCE' },
            HttpStatus.SERVICE_UNAVAILABLE,
        );
    }
}