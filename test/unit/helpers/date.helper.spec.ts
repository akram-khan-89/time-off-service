import { computeBusinessDays } from '../../../src/modules/time-off-requests/helpers/date.helper';

describe('computeBusinessDays', () => {
    it('counts a single Monday as 1 business day', () => {
        expect(computeBusinessDays('2024-01-08', '2024-01-08')).toBe(1);
    });

    it('counts Monday to Friday as 5 business days', () => {
        expect(computeBusinessDays('2024-01-08', '2024-01-12')).toBe(5);
    });

    it('counts Monday to next Monday as 6 business days', () => {
        expect(computeBusinessDays('2024-01-08', '2024-01-15')).toBe(6);
    });

    it('excludes Saturday and Sunday', () => {
        // Sat 2024-01-13 and Sun 2024-01-14 must not be counted
        expect(computeBusinessDays('2024-01-13', '2024-01-14')).toBe(0);
    });

    it('counts two full weeks as 10 business days', () => {
        expect(computeBusinessDays('2024-01-08', '2024-01-19')).toBe(10);
    });

    it('throws when endDate is before startDate', () => {
        expect(() =>
            computeBusinessDays('2024-01-10', '2024-01-08'),
        ).toThrow('endDate must be on or after startDate');
    });

    it('counts same-day Saturday as 0 business days', () => {
        expect(computeBusinessDays('2024-01-13', '2024-01-13')).toBe(0);
    });

    it('counts same-day Sunday as 0 business days', () => {
        expect(computeBusinessDays('2024-01-14', '2024-01-14')).toBe(0);
    });

    it('handles a range spanning a weekend correctly', () => {
        // Thu + Fri + Mon + Tue = 4 days (Sat/Sun skipped)
        expect(computeBusinessDays('2024-01-11', '2024-01-16')).toBe(4);
    });
});