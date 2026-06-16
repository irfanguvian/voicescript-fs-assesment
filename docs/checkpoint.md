# Checkpoints — Court Reporting Workflow Manager

Tracks phase progress for `docs/plan.md`. Update as phases complete.

## Phase 1 — Scaffold
- [x] NestJS backend created with Fastify adapter (`@nestjs/platform-fastify`)
- [x] Biome configured (`biome.json`), lint/format scripts wired, no ESLint/Prettier
- [x] Prisma initialized, provider `postgresql`, `DATABASE_URL` in `.env`
- [x] `docker-compose.yml` with postgres:16-alpine + healthcheck
- [x] Vite React-TS frontend scaffolded with `/api` proxy
- [x] Root README with run instructions
- [x] Verify: backend boots on Fastify (vitest e2e GET /api/health 200), `biome check .` exit 0
- [x] Extra: optimized multi-stage Dockerfiles + .dockerignore (backend + frontend)
- [x] Extra: `.devcontainer` (devcontainer.json + compose overlay, workspace + postgres)
- [x] Extra: tests use Vitest (not Jest) in both packages; smoke tests green

## Phase 2 — Schema, migrations, seed
- [x] Prisma schema: job, reporter, editor, reporter_balance, editor_balance, balance_ledger + enums + indexes
- [x] Initial migration applied (`20260612123901_init`)
- [x] Seed script (reporters w/ mixed cities, editors, NEW jobs, zeroed balances)
- [x] PrismaService provider (@Global PrismaModule, wired into AppModule)
- [x] Verify: migrate status up to date, seed data visible (3 reporters / 2 editors / 4 jobs / 3+2 balances)
- [x] Env note: host Postgres port remapped 5432→5433 (local 5432 already in use); container internal 5432 unchanged

## Phase 3 — Core workflow API
- [x] Modules: jobs, reporters, editors (payments deferred to Phase 4 — that's where complete + summary live)
- [x] Reporters/editors create + list (zeroed balance row created via nested create)
- [x] Job create / list / detail with DTO validation (city required when PHYSICAL via @ValidateIf)
- [x] `assign-reporter` with FOR UPDATE + SKIP LOCKED + same-city preference (interactive `$transaction` + `$queryRaw`)
- [x] `assign-editor` same pattern (job must be TRANSCRIBED, no editor)
- [x] Status endpoint with transition map (422 on illegal); map in `jobs.transitions.ts` (reusable by Phase 6 test)
- [x] Global ValidationPipe (whitelist/forbidNonWhitelisted/transform) + AllExceptionsFilter (consistent JSON envelope)
- [x] Verify: manual happy path via curl — 400/409/422 all correct, same-city reporter picked, NEW→ASSIGNED→TRANSCRIBED→(editor)→REVIEWED green; `build` + `biome check .` exit 0

## Phase 4 — Completion & payments
- [x] `complete` endpoint: single transaction (status, releases, amounts, 2 ledger rows, 2 balance updates) — job FOR UPDATE lock makes it double-pay safe (2nd complete → 409)
- [x] Rates via env config (`src/config/rates.ts`, REPORTER_RATE_PER_MINUTE=2000, EDITOR_FLAT_FEE=50000; read at call time)
- [x] `payments/summary` (total + per-worker balance & ledger rows) + per-job earnings already in job responses
- [x] Verify (live, :5433): 90-min REMOTE job → reporter_amount=180000, editor_amount=50000, before_balance=0, both ledger rows, balances bumped, workers→AVAILABLE, total_payout=230000, 2nd complete=409; `build`+`biome check .` exit 0; balance_ledger has only createMany/findMany (no update/delete)

## Phase 5 — Frontend dashboard
- [x] API client + types (`src/api/types.ts`, `src/api/client.ts` — `ApiError` carries backend envelope message)
- [x] Jobs table with status badges, assignees, earnings, contextual action buttons (status-driven; Mark reviewed gated on editor)
- [x] Create-job form (city shown/required only when PHYSICAL; duration sent as number)
- [x] Reporters/editors panel with balances + add forms; payments summary card (total_payout + per-worker balances)
- [x] Verify: `pnpm run build` ok, `biome check .` exit 0, `vitest run` 1/1; action calls mapped 1:1 to backend endpoints; live UI happy-path drive belongs to Phase 6 e2e

## Phase 6 — Tests & verification (Vitest · Testing Trophy · best-return only)
- [x] Test runner: Vitest in both packages (no Jest); backend integration/e2e boot Nest on Fastify via `app.inject()` (`test/helpers/e2e.ts` harness)
- [x] Strategy: Testing Trophy — weight integration tests; thin unit + thin e2e; Biome+TS as static base
- [x] Best-return rule: one highest-return test per concern, no exhaustive enumeration
- [x] Unit (thin): payment calc (`src/config/rates.spec.ts`); single parametrized transition-matrix test (`src/jobs/jobs.transitions.spec.ts`, one `it.each` over the full from/to×hasEditor grid)
- [x] Integration (fat middle, real Postgres :5433): concurrent assignment (1 job × 20 → exactly 1 winner / 19×409, FOR UPDATE), no double-booking (5 jobs × 3 reporters → 3 win, none double-booked, SKIP LOCKED), completion consistency + atomicity (`test/assignment.e2e-spec.ts`, `test/completion.e2e-spec.ts`)
- [x] Atomicity proof is genuine: ledger rows insert, then `reporterBalance.update` overflows int4 → whole tx rolls back (zero ledger rows, balance unchanged, job stays REVIEWED)
- [x] e2e (thin top): one happy-path flow via HTTP only — create→assign-reporter→TRANSCRIBED→assign-editor→REVIEWED→complete→summary (`test/happy-path.e2e-spec.ts`)
- [x] `vitest.config.ts` sets `fileParallelism: false` — integration specs share one Postgres and TRUNCATE between cases
- [x] `biome check .` exits 0 (backend 38 files, frontend 20 files); backend 62 tests green (6 files), frontend 1 test green; `nest build` 0 errors
- [x] DB restored to canonical seed (3 reporters / 2 editors / 4 jobs) after the test truncations
- [x] All acceptance criteria in `docs/plan.md` covered by tests (see Phase 6 mapping in `docs/notes.md`)
