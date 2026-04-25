export default () => ({
    nodeEnv: process.env.NODE_ENV || 'development',

    port: parseInt(process.env.PORT || '3000', 10),

    jwt: {
        secret: process.env.JWT_SECRET || 'default-secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },

    hcm: {
        baseUrl: process.env.HCM_BASE_URL || '',
        serviceToken: process.env.HCM_SERVICE_TOKEN || '',
        timeoutMs: parseInt(process.env.HCM_TIMEOUT_MS || '5000', 10),
        staleThresholdHours: parseInt(
            process.env.HCM_STALE_THRESHOLD_HOURS || '4',
            10,
        ),
    },

    database: {
        path: process.env.DATABASE_PATH || './data/time-off.sqlite',
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
});