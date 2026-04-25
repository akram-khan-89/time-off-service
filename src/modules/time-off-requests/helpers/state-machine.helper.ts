import { RequestStatus } from '../../../database/entities/time-off-request.entity';
import { InvalidStateTransitionException } from '../../../common/exceptions';

const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
    [RequestStatus.PENDING]: [
        RequestStatus.APPROVED,
        RequestStatus.REJECTED,
        RequestStatus.WITHDRAWN,
    ],
    [RequestStatus.APPROVED]: [RequestStatus.CANCELLED],
    [RequestStatus.REJECTED]: [],
    [RequestStatus.CANCELLED]: [],
    [RequestStatus.WITHDRAWN]: [],
};

export function assertValidTransition(
    from: RequestStatus,
    to: RequestStatus,
): void {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];

    if (!allowed.includes(to)) {
        throw new InvalidStateTransitionException(from, to);
    }
}

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    return allowed.includes(to);
}