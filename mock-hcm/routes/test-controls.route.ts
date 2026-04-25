import { Router, Request, Response } from 'express';
import { store } from '../store';

export const testControlsRouter = Router();

testControlsRouter.post('/set-balance', (req: Request, res: Response) => {
    const { hcmEmployeeId, hcmLocationId, leaveType, balanceDays } = req.body;

    if (!hcmEmployeeId || !hcmLocationId || !leaveType) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof balanceDays !== 'number' || balanceDays < 0) {
        return res.status(400).json({ error: 'balanceDays must be >= 0' });
    }

    store.setBalance({
        hcmEmployeeId,
        hcmLocationId,
        leaveType,
        balanceDays,
        asOf: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, balance: balanceDays });
});


testControlsRouter.post('/set-behavior', (req: Request, res: Response) => {
    const { mode, targetEmployeeId } = req.body;

    const validModes = [
        'normal',
        'insufficient',
        'server_error',
        'timeout',
        'corrupt_response',
        'silent_accept',
    ];

    if (!validModes.includes(mode)) {
        return res.status(400).json({
            error: `Invalid mode. Must be one of: ${validModes.join(', ')}`,
        });
    }

    store.setBehavior({ mode, targetEmployeeId });
    return res.status(200).json({ ok: true, mode, targetEmployeeId });
});

testControlsRouter.post('/reset', (_req: Request, res: Response) => {
    store.reset();
    return res.status(200).json({ ok: true, message: 'Store reset' });
});

testControlsRouter.post(
    '/increment-balance',
    (req: Request, res: Response) => {
        const { hcmEmployeeId, hcmLocationId, leaveType, days } = req.body;

        if (!hcmEmployeeId || !hcmLocationId || !leaveType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (typeof days !== 'number' || days <= 0) {
            return res.status(400).json({ error: 'days must be a positive number' });
        }

        store.incrementBalance(hcmEmployeeId, hcmLocationId, leaveType, days);
        const balances = store.getBalances(hcmEmployeeId, hcmLocationId);
        const updated = balances.find((b) => b.leaveType === leaveType);

        return res.status(200).json({
            ok: true,
            newBalance: updated?.balanceDays ?? 0,
        });
    },
);

testControlsRouter.get('/balances', (_req: Request, res: Response) => {
    return res.status(200).json({ balances: store.getAllBalances() });
});

testControlsRouter.get('/submissions', (_req: Request, res: Response) => {
    return res.status(200).json({ submissions: store.getSubmissions() });
});