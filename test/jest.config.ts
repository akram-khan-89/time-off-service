import type { Config } from 'jest';

const config: Config = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/modules/**/*.service.ts',
        'src/modules/**/*.client.ts',
        'src/modules/**/helpers/*.ts',
        '!src/**/*.module.ts',
        '!src/**/*.dto.ts',
        '!src/**/*.entity.ts',
        '!src/**/*.decorator.ts',
        '!src/**/*.constants.ts',
        '!src/**/*.interface.ts',
    ],
    coverageThreshold: {
        global: {
            lines: 85,
            functions: 85,
            branches: 80,
            statements: 85,
        },
    },
    globalSetup: './test/jest.global-setup.ts',
    globalTeardown: './test/jest.global-teardown.ts',
    testMatch: [
        './test/unit/**/*.spec.ts',
        './test/integration/**/*.spec.ts',
        './test/e2e/**/*.spec.ts',
    ],
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
    },
};

export default config;