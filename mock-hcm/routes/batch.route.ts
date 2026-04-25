import { Router, Request, Response } from 'express';
import { store } from '../store';

export const batchRouter = Router();

batchRouter.post('/balances/batch', (req: Request, res: Response) => {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'records must be a non-empty array' });
    }

    let applied = 0;
    const errors: string[] = [];

    for (const record of records) {
        const { hcmEmployeeId, hcmLocationId, leaveType, balanceDays } = record;

        if (!hcmEmployeeId || !hcmLocationId || !leaveType) {
            errors.push(`Missing fields in record: ${JSON.stringify(record)}`);
            continue;
        }

        if (typeof balanceDays !== 'number' || balanceDays < 0) {
            errors.push(`Invalid balanceDays in record for ${hcmEmployeeId}`);
            continue;
        }

        store.setBalance({
            hcmEmployeeId,
            hcmLocationId,
            leaveType,
            balanceDays,
            asOf: record.asOf || new Date().toISOString(),
        });

        applied++;
    }

    return res.status(200).json({
        applied,
        failed: errors.length,
        errors,
    });
});