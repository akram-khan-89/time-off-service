import { startMockHcm } from '../mock-hcm/server';
import { Server } from 'http';

declare global {
    var __HCM_SERVER__: Server;
}

export default async function globalSetup() {
    const server = await startMockHcm(3099);
    global.__HCM_SERVER__ = server;
    console.log('[Test Setup] Mock HCM server started on port 3099');
}