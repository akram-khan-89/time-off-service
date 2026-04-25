export function computeBusinessDays(
    startDate: string,
    endDate: string,
): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
        throw new Error('endDate must be on or after startDate');
    }

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}