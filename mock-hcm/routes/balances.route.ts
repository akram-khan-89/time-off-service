import { Router, Request, Response } from 'express';
import { store } from '../store';

export const balancesRouter = Router();

balancesRouter.get(
    '/employees/:hcmEmployeeId/balances',
    (req: Request, res: Response) => {
        const { hcmEmployeeId } = req.params;
        const hcmLocationId = req.query.locationId;
        if (!hcmLocationId || typeof hcmLocationId !== 'string') {
            return res.status(400).json({
                error: 'locationId query param is required',
                code: 'MISSING_LOCATION_ID',
            });
        }

        const behavior = store.getBehavior();

        if (
            behavior.mode === 'server_error' &&
            (!behavior.targetEmployeeId ||
                behavior.targetEmployeeId === hcmEmployeeId)
        ) {
            return res.status(500).json({ error: 'Internal HCM server error' });
        }

        if (
            behavior.mode === 'timeout' &&
            (!behavior.targetEmployeeId ||
                behavior.targetEmployeeId === hcmEmployeeId)
        ) {
            return;
        }

        if (behavior.mode === 'corrupt_response') {
            return res.status(200).json({
                thisIsWrong: true,
                garbage: 'not what we expected',
            });
        }

        const balances = store.getBalances(hcmEmployeeId as string, hcmLocationId);

        if (!balances.length) {
            return res.status(404).json({
                error: 'No balances found for this employee and location',
                code: 'BALANCE_NOT_FOUND',
            });
        }

        return res.status(200).json({
            hcmEmployeeId,
            hcmLocationId,
            balances: balances.map((b) => ({
                leaveType: b.leaveType,
                balanceDays: b.balanceDays,
                asOf: b.asOf,
            })),
        });
    },
);