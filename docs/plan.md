# Work Plan — Court Reporting Workflow Manager

Status: **pending approval**
Date: 2026-06-12
Inputs: `docs/requirement.md`, `docs/decision.md`, `docs/research.md` (decisions D1–D5)
Phases tracked in: `docs/checkpoint.md`

## Requirements Summary

Build a simplified court-reporting workflow system:

- **Backend** (`backend/`): NestJS on the Fastify adapter, Prisma ORM, Biome linter, PostgreSQL (docker-compose). REST API for job creation, reporter/editor assignment, status updates, completion, and payment calculation.
- **Frontend** (`frontend/`): React + Vite SPA dashboard — job list with status, assignments, earnings; forms/buttons to drive the workflow.
- **Domain**: jobs flow `NEW → ASSIGNED → TRANSCRIBED → REVIEWED → COMPLETED`. Reporters paid per minute (default 2000 IDR/min), editors paid flat fee per job. Balances backed by an append-only ledger. Assignment concurrency handled with `FOR UPDATE` / `FOR UPDATE SKIP LOCKED` inside a transaction (decision.md design, reused verbatim).

## Data Model (Prisma schema targets)

All IDs are ULIDs generated in the application layer (`ulid` package), stored as `String @id`.

- **job**: `job_id`, `case_name`, `duration_minutes Int`, `location_type` enum `PHYSICAL|REMOTE`, `city String?` (required when PHYSICAL), `status` enum `NEW|ASSIGNED|TRANSCRIBED|REVIEWED|COMPLETED`, `reporter_id FK?`, `editor_id FK?`, `reporter_amount Int?`, `editor_amount Int?`, `created_at`, `updated_at`, `finished_at?`, `deleted_at?`
- **reporter**: `reporter_id`, `name`, `city`, `status` enum `AVAILABLE|BUSY|OFFLINE`, `created_at`, `updated_at`, `deleted_at?`
- **editor**: `editor_id`, `name`, `status` enum `AVAILABLE|BUSY|OFFLINE`, `created_at`, `updated_at`, `deleted_at?`
- **reporter_balance**: `reporter_id FK (unique)`, `current_balance Int`, `created_at`, `updated_at`
- **editor_balance**: `editor_id FK (unique)`, `current_balance Int`, `created_at`, `updated_at`
- **balance_ledger** (append-only — no updates, no deletes): `ledger_id`, `job_id FK`, `payee_type` enum `REPORTER|EDITOR`, `payee_id`, `amount Int`, `before_balance Int`, `description`, `created_at`

Indexes: `job(status)`, `reporter(status, city)`, `editor(status)`, `balance_ledger(payee_type, payee_id)`.

## API Endpoints

| Method | Path | Behavior |
|---|---|---|
| POST | `/api/jobs` | Create job (`case_name`, `duration_minutes`, `location_type`, `city?`). Status `NEW`. |
| GET | `/api/jobs` | List jobs with assignments + per-job earnings (dashboard source). |
| GET | `/api/jobs/:job_id` | Job detail incl. payment breakdown. |
| POST | `/api/jobs/:job_id/assign-reporter` | Transaction: lock job `FOR UPDATE` (must be `NEW`), pick reporter `WHERE status='AVAILABLE' ORDER BY (city = job.city AND job is PHYSICAL) DESC LIMIT 1 FOR UPDATE SKIP LOCKED`, set `reporter_id`, job → `ASSIGNED`, reporter → `BUSY`. 409 if no reporter or wrong status. |
| POST | `/api/jobs/:job_id/status` | Body `{ "status": "TRANSCRIBED" \| "REVIEWED" }`. Validated against transition map (`ASSIGNED→TRANSCRIBED`, editor-assigned `TRANSCRIBED→REVIEWED`). 422 on illegal transition. |
| POST | `/api/jobs/:job_id/assign-editor` | Same SKIP LOCKED pattern on `editor`; job must be `TRANSCRIBED` and have no editor. Editor → `BUSY`. |
| POST | `/api/jobs/:job_id/complete` | One transaction: job (must be `REVIEWED`) → `COMPLETED` + `finished_at`; reporter & editor → `AVAILABLE`; compute `reporter_amount = duration_minutes × REPORTER_RATE_PER_MINUTE`, `editor_amount = EDITOR_FLAT_FEE`; append two `balance_ledger` rows (with `before_balance`); update both `*_balance.current_balance`. |
| GET | `/api/payments/summary` | Total payout overall + per reporter/editor (`current_balance` + per-job rows). |
| POST/GET | `/api/reporters`, `/api/editors` | Create (also creates zeroed balance row) and list with balances. |

Validation via DTOs + `ValidationPipe` (class-validator). Global exception filter returning consistent JSON errors.

## Implementation Phases

### Phase 1 — Scaffold (first thing, per user)
1. `backend/`: NestJS project; swap Express for Fastify (`@nestjs/platform-fastify`, `FastifyAdapter` in `backend/src/main.ts`); `@fastify/cors`.
2. Biome: `biome.json` at repo root (lint + format, recommended rules); `lint`/`format` scripts in both packages. No ESLint/Prettier.
3. Prisma: `prisma init`, provider `postgresql`, `backend/prisma/schema.prisma`; `.env` with `DATABASE_URL`.
4. `docker-compose.yml` at repo root: `postgres:16-alpine`, port 5432, volume, healthcheck.
5. `frontend/`: Vite React-TS scaffold, proxy `/api` → backend in `vite.config.ts`.
6. Root `README.md`: run instructions (`docker compose up -d` → migrate → seed → start both apps).

### Phase 2 — Schema, migrations, seed
1. Full Prisma schema per data model above; `prisma migrate dev` initial migration.
2. `backend/prisma/seed.ts`: ~3 reporters (mixed cities), ~2 editors, ~4 jobs (mix of PHYSICAL/REMOTE, statuses NEW), zeroed balances.
3. `PrismaService` (NestJS provider, lifecycle hooks).

### Phase 3 — Core workflow API
1. Modules: `jobs`, `reporters`, `editors`, `payments` under `backend/src/`.
2. Reporters/editors CRUD-lite (create + list with balance).
3. Job create/list/detail.
4. `assign-reporter`: interactive `prisma.$transaction` + `$queryRaw` for `FOR UPDATE` / `FOR UPDATE SKIP LOCKED` with city-preference ordering.
5. `assign-editor`: same pattern.
6. `status`: transition map enforcement.

### Phase 4 — Completion & payments
1. `complete` endpoint transaction (status, releases, amounts, ledger ×2, balances) — single `prisma.$transaction`.
2. Rates from config module env: `REPORTER_RATE_PER_MINUTE` (default 2000), `EDITOR_FLAT_FEE` (default 50000).
3. `payments/summary` + per-job earnings in job list/detail responses.

### Phase 5 — Frontend dashboard
1. API client + types mirroring backend DTOs.
2. Jobs table: case name, duration, location, status badge, reporter/editor names, earnings; action buttons per row (assign reporter / mark transcribed / assign editor / mark reviewed / complete) shown contextually by status.
3. Create-job form; reporters/editors panel with status + balance; payments summary card.
4. Plain CSS or minimal utility styling — function over design.

### Phase 6 — Tests & verification

**Test framework: Vitest** (not Jest) across both packages. Backend uses
`unplugin-swc` so decorator metadata survives transform; e2e boots the real Nest
app on the Fastify adapter and drives it via `app.inject()`.

**Strategy — Testing Trophy (Kent C. Dodds), not the pyramid.** Weight effort
toward **integration tests** (the fat middle of the trophy), with a thin layer of
focused unit tests for pure logic, a static base (Biome + TypeScript), and a few
e2e tests at the top. Rationale: this system's risk lives in the seams —
transactional assignment, SKIP LOCKED concurrency, ledger/balance consistency —
which only integration tests against real Postgres can prove. Pure-unit coverage
of glue code buys little confidence here.

**Best-return rule: one highest-return test per concern.** Do **not** exhaustively
enumerate cases. For each concern, write the single test that, if green, gives the
most confidence the concern holds — then stop. Skip redundant variants that
exercise the same code path. Prefer the test closest to real usage that still runs
fast and deterministically.

1. Unit (thin): payment calculation; status-transition map — one parametrized test
   covering the legal/illegal matrix rather than one test per pair.
2. Integration (fat middle, real Postgres) — the highest-return tests:
   - Concurrency: fire N parallel `assign-reporter` calls for one job → exactly one
     succeeds (proves `FOR UPDATE`). One test covers it.
   - No double-booking: parallel assigns across multiple jobs with fewer reporters →
     no reporter assigned twice (proves `SKIP LOCKED`).
   - Completion consistency: one test asserting ledger rows + balance + `before_balance`
     are all consistent and atomic.
3. e2e (thin top): one happy-path flow — create → assign-reporter → TRANSCRIBED →
   assign-editor → REVIEWED → complete → summary correct.
4. `biome check` clean; README verified by following it from scratch.

## Acceptance Criteria (testable)

1. `docker compose up -d && prisma migrate dev && seed && npm run start:dev` brings up API on Fastify (boot log shows Fastify, not Express).
2. POST `/api/jobs` with invalid body → 400 with field errors; valid body → 201 with ULID `job_id`, status `NEW`.
3. `assign-reporter` on a PHYSICAL job picks a same-city AVAILABLE reporter when one exists; otherwise any AVAILABLE reporter; reporter becomes `BUSY`, job `ASSIGNED`.
4. 20 concurrent `assign-reporter` calls against 1 NEW job: exactly 1 returns 200, 19 return 409; job has exactly one reporter (integration test passes).
5. Illegal transition (e.g. `NEW → REVIEWED`, or `TRANSCRIBED → REVIEWED` without editor) → 422.
6. `complete` on a REVIEWED 90-minute job (defaults): reporter ledger row `amount=180000`, editor row `amount=50000`, balances increase by exactly those amounts, `before_balance` equals prior balance, job `COMPLETED` with `finished_at`, both workers back to `AVAILABLE`.
7. `complete` is atomic: forced failure mid-transaction leaves no ledger row and unchanged balances.
8. `balance_ledger` has no update/delete code path anywhere in the codebase.
9. Dashboard shows job list with statuses, assignee names, and per-job earnings; the full happy path is drivable from the UI alone.
10. `biome check .` exits 0; all tests pass.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Prisma lacks native `SKIP LOCKED` | `$queryRaw` inside interactive `$transaction`; integration test #4 proves it. |
| Raw SQL drifts from Prisma schema | Keep raw SQL confined to two assignment service methods; cover with integration tests. |
| ULID not native to Prisma/Postgres | Generate in app layer (`ulid`), `String @id`; no DB default needed. |
| Fastify adapter incompatibilities (Express-style middleware) | Use Fastify-native plugins only; smoke-test boot in Phase 1. |
| Transition-map edge cases (editor required before REVIEWED) | Single transition-validator unit-tested for the full matrix. |
| Completion double-pay on retry | Status guard (`REVIEWED` only) inside the locked transaction makes completion idempotent-safe; test #7. |

## Verification Steps

1. Phase 1: boot backend, confirm Fastify adapter; `biome check` passes; frontend dev server proxies `/api`.
2. Phase 2: `prisma migrate dev` clean; seed inspectable via `prisma studio`.
3. Phases 3–4: run integration + unit suites against dockerized Postgres.
4. Phase 5: drive happy path via UI; verify summary numbers against seeded durations by hand.
5. Final: fresh clone simulation — follow README start-to-finish; all acceptance criteria checked off in `docs/checkpoint.md`.
