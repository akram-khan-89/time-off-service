import express, { Application } from 'express';
import { Server } from 'http';
import { balancesRouter } from './routes/balances.route';
import { timeOffRouter } from './routes/time-off.route';
import { testControlsRouter } from './routes/test-controls.route';
import { batchRouter } from './routes/batch.route';
import { store } from './store';

export function createMockHcmApp(): Application {
    const app = express();
    app.use(express.json());

    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', service: 'mock-hcm' });
    });

    app.use('/hcm', balancesRouter);
    app.use('/hcm', timeOffRouter);
    app.use('/hcm', batchRouter);

    if (
        process.env.NODE_ENV === 'test' ||
        process.env.NODE_ENV === 'development'
    ) {
        app.use('/hcm/__test__', testControlsRouter);
        console.log('[MockHCM] Test control endpoints enabled');
    }

    app.use((req, res) => {
        res.status(404).json({
            error: `HCM endpoint not found: ${req.method} ${req.path}`,
            code: 'NOT_FOUND',
        });
    });

    return app;
}

export async function startMockHcm(port: number = 3099): Promise<Server> {
    const app = createMockHcmApp();

    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            console.log(`[MockHCM] Running on http://localhost:${port}`);
            resolve(server);
        });

        server.on('error', reject);
    });
}

export { store };

if (require.main === module) {
    const port = parseInt(process.env.MOCK_HCM_PORT || '3099', 10);
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';

    startMockHcm(port).then(() => {
        console.log('[MockHCM] Standalone mode — seeding default balances...');

        store.setBalance({
            hcmEmployeeId: 'HCM-ADMIN-001',
            hcmLocationId: 'LOC-NY-001',
            leaveType: 'annual',
            balanceDays: 20,
            asOf: new Date().toISOString(),
        });

        store.setBalance({
            hcmEmployeeId: 'HCM-MGR-001',
            hcmLocationId: 'LOC-NY-001',
            leaveType: 'annual',
            balanceDays: 15,
            asOf: new Date().toISOString(),
        });

        store.setBalance({
            hcmEmployeeId: 'HCM-EMP-001',
            hcmLocationId: 'LOC-NY-001',
            leaveType: 'annual',
            balanceDays: 10,
            asOf: new Date().toISOString(),
        });

        store.setBalance({
            hcmEmployeeId: 'HCM-EMP-001',
            hcmLocationId: 'LOC-NY-001',
            leaveType: 'sick',
            balanceDays: 5,
            asOf: new Date().toISOString(),
        });

        store.setBalance({
            hcmEmployeeId: 'HCM-EMP-002',
            hcmLocationId: 'LOC-NY-001',
            leaveType: 'annual',
            balanceDays: 8,
            asOf: new Date().toISOString(),
        });

        store.setBalance({
            hcmEmployeeId: 'HCM-EMP-002',
            hcmLocationId: 'LOC-LHR-001',
            leaveType: 'annual',
            balanceDays: 12,
            asOf: new Date().toISOString(),
        });

        console.log('[MockHCM] Default balances seeded');
        console.log('[MockHCM] Test endpoints: http://localhost:3099/hcm/__test__/balances');
    });
}