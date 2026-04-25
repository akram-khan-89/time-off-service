export default async function globalTeardown() {
    if (global.__HCM_SERVER__) {
        await new Promise<void>((resolve) => {
            global.__HCM_SERVER__.close(() => {
                console.log('[Test Teardown] Mock HCM server stopped');
                resolve();
            });
        });
    }
}