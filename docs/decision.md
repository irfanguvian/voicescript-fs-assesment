Database Choice
PostgreSQL is the right pick for this. It handles row-level locking well, has solid index support, and is reasonably priced. Other SQL databases are options, but each has trade-offs in how they handle locking and indexing — and I know Postgres better, so that also plays a factor.

Data Model
job

job_id (ULID), job_name, job_status (NEW → ASSIGNED → IN_PROGRESS → REVIEW → COMPLETED), taken_by_reporter_id (FK to reporter, nullable), amount, created_at, updated_at, finished_at, deleted_at
reporter

reporter_id (ULID), reporter_name, reporter_status (AVAILABLE | OFFLINE), created_at, updated_at, deleted_at
reporter_balance

reporter_id (FK), current_balance, created_at, updated_at
reporter_balance_ledger (append-only — no updates, no deletes)

ledger_id (ULID), job_id (FK), amount, description, before_balance, created_at

Concurrency Handling
The assignment flow runs inside a transaction with a row-level lock:
-- Step 1: lock the job first
SELECT * FROM job
WHERE job_id = :job_id
AND job_status = 'NEW'
FOR UPDATE

-- Step 2: then find an available reporter
SELECT * FROM reporter
WHERE reporter_status = 'AVAILABLE'
LIMIT 1
FOR UPDATE SKIP LOCKED

SKIP LOCKED means competing transactions won't wait on the same row — they skip it and pick the next available reporter instead. This keeps throughput up under concurrent assignment attempts.
If a row is found and locked: set taken_by_reporter_id, flip job_status to ASSIGNED, and update reporter_status to IDLE. Then commit.

API Endpoints
POST /api/jobs/:job_id/assign
Runs the transaction above. Finds an AVAILABLE reporter, locks the row, assigns the job.
POST /api/jobs/:job_id/status
body: { status: ASSIGNED | IN_PROGRESS | REVIEW }
Moves the job through the intermediate statuses. Does not handle completion — that's a separate endpoint.

POST /api/jobs/:job_id/completed
Marks the job as COMPLETED, releases the reporter back to AVAILABLE, appends a row to reporter_balance_ledger, and updates reporter_balance.current_balance. These all run in one transaction so the balance update and ledger entry are always in sync.

Testing Strategy
Framework: Vitest, not Jest. Single runner for unit, integration, and e2e across backend and frontend; the backend uses unplugin-swc so NestJS decorator metadata survives the transform, and e2e boots the real Nest app on the Fastify adapter via app.inject(). Chose Vitest over Jest for faster ESM-native runs, a Vite-shared config with the frontend, and less ts-jest/transform friction.

Shape: Testing Trophy, not the pyramid. Effort concentrates on integration tests against real Postgres because this system's risk is in the seams — transactional assignment, FOR UPDATE / SKIP LOCKED concurrency, and ledger/balance consistency — which unit tests on glue code cannot prove. Static analysis (Biome + TypeScript) forms the base, a thin unit layer covers pure logic (payment math, transition map), and a single e2e happy path sits at the top.

Tooling
Package manager: pnpm, dedicated per package (backend and frontend each own a pnpm-lock.yaml; no root package.json or workspace). Content-addressed store + strict resolution; self-contained packages match the per-package Docker builds. pnpm 10 blocks dependency build scripts by default, so prisma/@prisma/client/@prisma/engines/@swc/core/esbuild are allow-listed via pnpm.onlyBuiltDependencies in each package.json.
Linter/formatter: Biome, configured per repo (backend/biome.json, frontend/biome.json), binary as a per-package dev dependency — nothing installed at the repo root. Run `pnpm run check` inside a package. No ESLint/Prettier.

Best-return rule: generate only the highest-return test per concern. For each concern write the one test that, if green, gives the most confidence, then stop — no exhaustive case enumeration, no redundant variants of the same code path. Example: one parametrized transition-matrix test instead of one per state pair; one concurrency test to prove SKIP LOCKED rather than many.