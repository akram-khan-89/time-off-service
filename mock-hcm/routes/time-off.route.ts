import { Router, Request, Response } from 'express';
import { store } from '../store';
import { v4 as uuidv4 } from 'uuid';

export const timeOffRouter = Router();

timeOffRouter.post(
    '/employees/:hcmEmployeeId/time-off',
    (req: Request, res: Response) => {
        const hcmEmployeeId = req.params.hcmEmployeeId as string;
        const {
            hcmLocationId,
            leaveType,
            startDate,
            endDate,
            daysRequested,
        } = req.body;

        if (!hcmLocationId || !leaveType || !startDate || !endDate || !daysRequested) {
            return res.status(400).json({
                error: 'Missing required fields',
                code: 'MISSING_FIELDS',
                required: ['hcmLocationId', 'leaveType', 'startDate', 'endDate', 'daysRequested'],
            });
        }

        if (typeof daysRequested !== 'number' || daysRequested <= 0) {
            return res.status(400).json({
                error: 'daysRequested must be a positive number',
                code: 'INVALID_DAYS',
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

        if (
            behavior.mode === 'silent_accept' &&
            (!behavior.targetEmployeeId ||
                behavior.targetEmployeeId === hcmEmployeeId)
        ) {
            const reference = `HCM-SILENT-${uuidv4()}`;
            store.recordSubmission({
                reference,
                hcmEmployeeId,
                hcmLocationId,
                leaveType,
                startDate,
                endDate,
                daysRequested,
                submittedAt: new Date().toISOString(),
            });
            return res.status(200).json({
                reference,
                status: 'accepted',
                remainingBalance: 999,
            });
        }

        if (behavior.mode === 'corrupt_response') {
            return res.status(200).json({
                thisIsWrong: true,
                garbage: 'not what we expected',
            });
        }

        if (
            behavior.mode === 'insufficient' &&
            (!behavior.targetEmployeeId ||
                behavior.targetEmployeeId === hcmEmployeeId)
        ) {
            return res.status(422).json({
                status: 'rejected',
                reason: 'Insufficient leave balance in HCM',
                code: 'INSUFFICIENT_BALANCE',
            });
        }

        const balances = store.getBalances(hcmEmployeeId, hcmLocationId);
        const targetBalance = balances.find((b) => b.leaveType === leaveType);

        if (!targetBalance) {
            return res.status(422).json({
                status: 'rejected',
                reason: `No ${leaveType} balance found for this employee and location`,
                code: 'BALANCE_NOT_FOUND',
            });
        }

        if (targetBalance.balanceDays < daysRequested) {
            return res.status(422).json({
                status: 'rejected',
                reason: 'Insufficient leave balance',
                code: 'INSUFFICIENT_BALANCE',
            });
        }

        const success = store.deductBalance(
            hcmEmployeeId,
            hcmLocationId,
            leaveType,
            daysRequested,
        );

        if (!success) {
            return res.status(422).json({
                status: 'rejected',
                reason: 'Deduction failed',
                code: 'DEDUCTION_FAILED',
            });
        }

        const reference = `HCM-REF-${uuidv4()}`;
        const updatedBalances = store.getBalances(hcmEmployeeId, hcmLocationId);
        const updatedBalance = updatedBalances.find((b) => b.leaveType === leaveType);

        store.recordSubmission({
            reference,
            hcmEmployeeId,
            hcmLocationId,
            leaveType,
            startDate,
            endDate,
            daysRequested,
            submittedAt: new Date().toISOString(),
        });

        return res.status(200).json({
            reference,
            status: 'accepted',
            remainingBalance: updatedBalance?.balanceDays ?? 0,
        });
    },
);