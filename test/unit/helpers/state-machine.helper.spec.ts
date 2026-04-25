import {
    assertValidTransition,
    canTransition,
} from '../../../src/modules/time-off-requests/helpers/state-machine.helper';
import { RequestStatus } from '../../../src/database/entities/time-off-request.entity';
import { InvalidStateTransitionException } from '../../../src/common/exceptions';

describe('State Machine Helper', () => {
    describe('canTransition', () => {
        it('allows pending → approved', () => {
            expect(canTransition(RequestStatus.PENDING, RequestStatus.APPROVED)).toBe(true);
        });

        it('allows pending → rejected', () => {
            expect(canTransition(RequestStatus.PENDING, RequestStatus.REJECTED)).toBe(true);
        });

        it('allows pending → withdrawn', () => {
            expect(canTransition(RequestStatus.PENDING, RequestStatus.WITHDRAWN)).toBe(true);
        });

        it('allows approved → cancelled', () => {
            expect(canTransition(RequestStatus.APPROVED, RequestStatus.CANCELLED)).toBe(true);
        });

        it('blocks approved → approved', () => {
            expect(canTransition(RequestStatus.APPROVED, RequestStatus.APPROVED)).toBe(false);
        });

        it('blocks rejected → approved', () => {
            expect(canTransition(RequestStatus.REJECTED, RequestStatus.APPROVED)).toBe(false);
        });

        it('blocks withdrawn → anything', () => {
            expect(canTransition(RequestStatus.WITHDRAWN, RequestStatus.PENDING)).toBe(false);
            expect(canTransition(RequestStatus.WITHDRAWN, RequestStatus.APPROVED)).toBe(false);
            expect(canTransition(RequestStatus.WITHDRAWN, RequestStatus.REJECTED)).toBe(false);
            expect(canTransition(RequestStatus.WITHDRAWN, RequestStatus.CANCELLED)).toBe(false);
        });

        it('blocks cancelled → anything', () => {
            expect(canTransition(RequestStatus.CANCELLED, RequestStatus.PENDING)).toBe(false);
            expect(canTransition(RequestStatus.CANCELLED, RequestStatus.APPROVED)).toBe(false);
        });

        it('blocks rejected → rejected', () => {
            expect(canTransition(RequestStatus.REJECTED, RequestStatus.REJECTED)).toBe(false);
        });
    });

    describe('assertValidTransition', () => {
        it('does not throw for valid transition', () => {
            expect(() =>
                assertValidTransition(RequestStatus.PENDING, RequestStatus.APPROVED),
            ).not.toThrow();
        });

        it('throws InvalidStateTransitionException for illegal transition', () => {
            expect(() =>
                assertValidTransition(RequestStatus.REJECTED, RequestStatus.APPROVED),
            ).toThrow(InvalidStateTransitionException);
        });

        it('throws with correct from/to in message', () => {
            try {
                assertValidTransition(RequestStatus.CANCELLED, RequestStatus.APPROVED);
                fail('should have thrown');
            } catch (err: any) {
                expect(err.message ?? err.response?.message).toContain('cancelled');
                expect(err.message ?? err.response?.message).toContain('approved');
            }
        });

        it('throws for withdrawn → pending', () => {
            expect(() =>
                assertValidTransition(RequestStatus.WITHDRAWN, RequestStatus.PENDING),
            ).toThrow(InvalidStateTransitionException);
        });
    });
});