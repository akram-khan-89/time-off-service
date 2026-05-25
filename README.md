# Time-Off Microservice

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-FF4438?style=for-the-badge&logo=redis&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js_v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

![Tests](https://img.shields.io/badge/tests-84%20passing-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

A NestJS microservice that manages the full lifecycle of employee time-off requests and keeps leave balances in sync with an external HCM system (Workday, SAP, or equivalent).

---

## What It Does

- Employees submit time-off requests; managers approve or reject them
- Leave balances are cached locally and synced from HCM in real time (on demand) and in batch (pushed by HCM)
- HCM is the source of truth — balances are only deducted locally **after** HCM confirms the approval
- Handles HCM being down, returning corrupt data, or changing balances independently (anniversary bonuses, year-start resets)
- Full audit trail of every balance change and request state transition

---

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white) NestJS (TypeScript) |
| Database | ![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white) SQLite via TypeORM |
| Auth | ![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white) JWT — role-based (employee / manager / admin) |
| Background Jobs | ![Bull](https://img.shields.io/badge/Bull_Queue-FF4438?style=flat-square&logo=redis&logoColor=white) Bull (Redis-backed queue) |
| HCM Communication | ![Axios](https://img.shields.io/badge/Axios-5A29E4?style=flat-square&logo=axios&logoColor=white) Axios with exponential backoff retry |
| Testing | ![Jest](https://img.shields.io/badge/Jest-C21325?style=flat-square&logo=jest&logoColor=white) Jest — 84 unit tests, all passing |
| Mock HCM | ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) Express server with in-memory state |

---

## Prerequisites

- ![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=nodedotjs&logoColor=white) **Node.js** v18 or higher
- ![npm](https://img.shields.io/badge/npm-v9+-CB3837?style=flat-square&logo=npm&logoColor=white) **npm** v9 or higher
- ![Redis](https://img.shields.io/badge/Redis-FF4438?style=flat-square&logo=redis&logoColor=white) **Redis** — required for Bull queue (background batch sync)
  - Install locally: https://redis.io/docs/getting-started/
  - Or run with Docker: `docker run -d -p 6379:6379 redis:alpine`
  - For tests, Redis is mocked via `ioredis-mock` — no Redis needed to run tests

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/time-off-service.git
cd time-off-service
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set the required values:

```env
JWT_SECRET=any-long-random-string
HCM_BASE_URL=http://localhost:3099
HCM_SERVICE_TOKEN=hcm-service-secret-token
```

All other values have safe defaults for local development.

### 3. Create the data directory

```bash
mkdir data
```

---

## Running the Application

### Start the Mock HCM Server (required for the app to work)

The mock HCM server simulates the external HCM system. Start it in a separate terminal:

```bash
npx ts-node -r tsconfig-paths/register mock-hcm/server.ts
```

It runs on `http://localhost:3099` and seeds default balances automatically.

Verify it's running:
```bash
curl http://localhost:3099/health
# → {"status":"ok","service":"mock-hcm"}
```

### Start Redis (if not already running)

```bash
# Docker
docker run -d -p 6379:6379 redis:alpine

# Or start your local Redis instance
redis-server
```

### Seed the Database

```bash
npm run seed
```

This creates the following accounts (all use password: `password123`):

| Email | Role |
|---|---|
| admin@company.com | admin |
| manager@company.com | manager |
| David@company.com | employee |
| Jessica@company.com | employee |

### Start the API

```bash
npm run start:dev
```

API runs on `http://localhost:3000`.

---

## Running Tests

No Redis or running app needed for tests. The mock HCM server starts automatically as part of the Jest global setup.

### Run all unit tests

```bash
npx jest test/unit --no-coverage --verbose
```

### Run unit tests with coverage report

```bash
npx jest test/unit --coverage --verbose
```

Expected output:
```
Test Suites: 7 passed, 7 total
Tests:       84 passed, 84 total
```

### Build

```bash
npm run build
```

---

## API Overview

All endpoints (except `POST /auth/login` and `POST /sync/batch-ingest`) require a JWT in the `Authorization: Bearer <token>` header.

### Get a token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@company.com","password":"password123"}'
```

### Key endpoints

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | /auth/login | Public | Get JWT |
| `GET` | /employees/me | Any | Own profile |
| `GET` | /employees/me/balances | Any | Own leave balances |
| `POST` | /time-off-requests | Employee | Submit a request |
| `GET` | /time-off-requests/mine | Employee | Own requests |
| `GET` | /time-off-requests/team | Manager | Direct reports' requests |
| `POST` | /time-off-requests/:id/approve | Manager, Admin | Approve a request |
| `POST` | /time-off-requests/:id/reject | Manager, Admin | Reject with reason |
| `POST` | /time-off-requests/:id/withdraw | Employee | Withdraw own pending request |
| `POST` | /time-off-requests/:id/cancel | Admin | Cancel approved request |
| `POST` | /sync/batch-ingest | Service token | HCM pushes balance corpus |
| `POST` | /sync/trigger | Admin | Manual sync trigger |
| `GET` | /sync/logs | Admin | Sync history |
| `GET` | /audit | Admin | Full audit trail |

Full API specification is in the TRD (`TRD.docx`).

---

## Mock HCM Test Controls

When running in development or test mode, the mock HCM exposes control endpoints for simulating different HCM behaviours:

```bash
# Set a specific balance
curl -X POST http://localhost:3099/hcm/__test__/set-balance \
  -H "Content-Type: application/json" \
  -d '{"hcmEmployeeId":"HCM-EMP-001","hcmLocationId":"LOC-NY-001","leaveType":"annual","balanceDays":10}'

# Simulate HCM being down
curl -X POST http://localhost:3099/hcm/__test__/set-behavior \
  -H "Content-Type: application/json" \
  -d '{"mode":"server_error"}'

# Available modes: normal | insufficient | server_error | timeout | corrupt_response | silent_accept

# Reset to normal
curl -X POST http://localhost:3099/hcm/__test__/reset

# Simulate an independent HCM balance update (e.g. anniversary bonus)
curl -X POST http://localhost:3099/hcm/__test__/increment-balance \
  -H "Content-Type: application/json" \
  -d '{"hcmEmployeeId":"HCM-EMP-001","hcmLocationId":"LOC-NY-001","leaveType":"annual","days":5}'

# Inspect current balances in mock
curl http://localhost:3099/hcm/__test__/balances
```

---

## Project Structure

```
time-off-service/
├── src/
│   ├── config/                  # Environment configuration
│   ├── common/
│   │   ├── decorators/          # @CurrentUser, @Roles
│   │   ├── exceptions/          # Custom HTTP exceptions
│   │   └── filters/             # Global HTTP exception filter
│   ├── database/
│   │   └── entities/            # TypeORM entities (6 tables)
│   └── modules/
│       ├── auth/                # JWT strategy, guards, login
│       ├── employees/           # Employee CRUD
│       ├── locations/           # Location management
│       ├── leave-balances/      # Balance reads, upsert, optimistic deduction
│       ├── hcm/                 # HCM HTTP client with retry
│       ├── audit/               # Insert-only audit log
│       ├── time-off-requests/   # Full request lifecycle + state machine
│       ├── queue/               # Bull queue setup
│       └── sync/                # Batch ingest + reconciliation
├── mock-hcm/
│   ├── server.ts                # Express mock server entry point
│   ├── store.ts                 # In-memory state store
│   └── routes/                  # balance, time-off, batch, test-control routes
├── test/
│   ├── unit/                    # 84 unit tests (all passing)
│   ├── helpers/                 # HCM test helper utilities
│   ├── jest.global-setup.ts     # Starts mock HCM server before tests
│   └── jest.global-teardown.ts  # Stops mock HCM server after tests
├── TRD.docx                     # Technical Requirements Document
├── .env.example                 # Environment variable template
├── jest.config.ts               # Test configuration + coverage thresholds
└── README.md
```

---

## Key Design Decisions

| Decision | Chosen | Why |
|---|---|---|
| Balance deduction timing | At approval | Submission is intent; deduction at approval matches when the commitment is real |
| Locking strategy | Optimistic (version column) | Pessimistic locking holds a DB lock during the HCM call (seconds); optimistic only costs a retry on the rare conflict |
| HCM down behaviour | Fail safe — block the action | Silent approval when HCM is unreachable would corrupt balance integrity |
| Batch processing | Async Bull queue | Synchronous processing would time out the HTTP connection for large batches |
| Staleness refresh | Lazy at decision time | Background polling wastes HCM calls; lazy refresh fires exactly when the data is needed |

Full analysis of alternatives in `TRD.docx`.

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `JWT_SECRET` | — | ✅ Yes | HS256 signing key |
| `JWT_EXPIRES_IN` | 24h | No | Token lifetime |
| `HCM_BASE_URL` | — | ✅ Yes | HCM real-time API base URL |
| `HCM_SERVICE_TOKEN` | — | ✅ Yes | Static token for batch ingest |
| `HCM_TIMEOUT_MS` | 5000 | No | Per-attempt HCM call timeout (ms) |
| `HCM_STALE_THRESHOLD_HOURS` | 4 | No | Hours before a local balance is considered stale |
| `DATABASE_PATH` | ./data/time-off.sqlite | No | SQLite file path |
| `REDIS_HOST` | localhost | No | Bull queue Redis host |
| `REDIS_PORT` | 6379 | No | Bull queue Redis port |
| `PORT` | 3000 | No | HTTP listen port |
