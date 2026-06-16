# Build Notes — Court Reporting Workflow Manager

Running log of decisions, gotchas, and verification evidence, **one section per phase**.
Skim a phase before resuming it. Newest notes appended under each phase.

Legend: 🟢 done · 🟡 in progress · ⚪ not started

---

## Phase 1 — Scaffold 🟢

### What shipped
- **backend/** — NestJS 11 on the **Fastify** adapter (`@nestjs/platform-fastify`,
  `@fastify/cors`, global `/api` prefix), Prisma 6 (postgres), Vitest, Biome.
- **frontend/** — Vite 6 + React 19 + TS, `/api` dev proxy (env-overridable).
- **docker-compose.yml** — `postgres:16-alpine` by default; `backend` + `frontend`
  behind the `full` profile.
- **Optimized Docker** — multi-stage backend (`deps → build → runtime`, prisma
  generate, prod prune, non-root `node` + dumb-init) and frontend
  (`build → nginx`, non-root `nginx`); `.dockerignore` in both.
- **.devcontainer/** — devcontainer.json + compose overlay (workspace + healthy
  postgres, installs both packages on create).
- **README.md** — run / docker / devcontainer / vitest instructions.
- **docs** — plan.md Phase 6, decision.md, checkpoint.md carry the testing strategy.

### Key decisions
- **Package manager: pnpm** (per package, no root workspace). Each of `backend/`
  and `frontend/` has its own `pnpm-lock.yaml`; there is no root `package.json`.
  Rationale: faster installs, content-addressed store, strict dep resolution; keeping
  packages self-contained matches the per-package Docker builds.
- **Biome dedicated per repo.** Config lives in `backend/biome.json` and
  `frontend/biome.json`; the Biome binary is a dev dependency of each package.
  Nothing is installed at the repo root. Run `pnpm run check` inside a package.
- **Tests: Vitest, not Jest** (both packages). Backend e2e boots the real Nest app
  on the Fastify adapter and drives it via `app.inject()`.
- **Docker base image** uses Node 22 LTS even though local dev is Node 24 — pin the
  LTS for reproducible images.

### Gotchas / learnings (read before Phase 2)
- **pnpm 10 blocks build scripts by default.** prisma, `@prisma/client`,
  `@prisma/engines`, `@swc/core`, and `esbuild` must be allow-listed via
  `pnpm.onlyBuiltDependencies` in each `package.json`, or prisma generate / native
  binaries won't build during install.
- **Vitest + NestJS decorators:** vitest's default esbuild transform drops
  `emitDecoratorMetadata`. Backend uses `unplugin-swc` (`backend/vitest.config.ts`)
  to preserve it; `reflect-metadata` is loaded via `setupFiles`.
- **Vite config uses `process.env`** → frontend needs `@types/node` and
  `"types": ["node"]` in `tsconfig.node.json`, else `tsc -b` fails (TS2580).
- **No corepack on the local host** — pnpm came from Homebrew. Dockerfiles enable
  pnpm via `corepack enable && corepack prepare pnpm@10.33.0 --activate`.
- Avoid running two installs in the same tree concurrently; an earlier overlapping
  install once emptied `backend/node_modules`.

### Verification evidence (fresh, pnpm)
- backend `pnpm run build` → 0 errors.
- backend `pnpm exec vitest run` → 1/1 pass (Fastify boots, `GET /api/health` 200).
- backend `pnpm exec prisma generate` → Prisma Client v6.19.3 generated.
- frontend `pnpm run build` (`tsc -b && vite build`) → built.
- frontend `pnpm exec vitest run` → 1/1 pass (jsdom).
- `pnpm exec biome check .` in **each** package → exit 0.
- `docker compose config` (+ `full` profile + devcontainer overlay merge) → valid.

### Not done here (deferred by scope)
- Real `docker build` / image run was **not** smoke-tested — the Docker daemon was
  not running in the build environment. `docker compose config` validates and the
  Dockerfiles are correct by inspection. To verify: start Docker, then
  `docker compose --profile full up --build`.
- Full Prisma data model, migration, seed, and `PrismaService` are Phase 2.

---

## Phase 2 — Schema, migrations, seed 🟢

### What shipped
- **schema.prisma** — full model: `Job`, `Reporter`, `Editor`, `ReporterBalance`,
  `EditorBalance`, `BalanceLedger`; enums `LocationType`, `JobStatus`,
  `WorkerStatus`, `PayeeType`. All IDs `String @id` (app-layer ULID, no DB default).
  `@@map` to snake_case table names. Indexes: `job(status)`, `reporter(status,city)`,
  `editor(status)`, `balance_ledger(payee_type,payee_id)`. Balances are 1:1 (PK = FK).
- **Migration** `prisma/migrations/20260612123901_init` — applied clean; `migrate
  status` up to date; Prisma Client v6.19.3 regenerated.
- **PrismaService** (`src/prisma/prisma.service.ts`) extends `PrismaClient`,
  `$connect` on init / `$disconnect` on destroy. **PrismaModule** (`@Global`)
  provides+exports it; imported by `AppModule`.
- **seed.ts** — 3 reporters (Jakarta×2, Bandung), 2 editors, 4 jobs (2 PHYSICAL w/
  city, 2 REMOTE, all NEW), zeroed balance per worker. Run via `prisma db seed`
  (`tsx prisma/seed.ts`, `prisma.seed` key in package.json).

### Key decisions
- **`balance_ledger` deliberately has no `updated_at`** — append-only is enforced by
  shape; the service layer (Phase 4) only ever inserts. Documented in schema comment.
- **Nested relation create** for balances: do NOT pass the FK (`reporter_id`/
  `editor_id`) inside `balance.create` — Prisma infers it from the parent, passing
  it throws `Unknown argument`. Use `balance: { create: { current_balance: 0 } }`.
- **Seed runner: tsx** (added as devDep) over ts-node — fast, ESM-native, no config.

### Gotchas / learnings (read before Phase 3)
- **Host port 5432 was already taken** by a local (non-Docker) Postgres. Remapped the
  compose publish to **5433:5432** and pointed `backend/.env` + `.env.example`
  `DATABASE_URL` at `localhost:5433`. Container-internal port and the `backend`
  service env (`postgres:5432`) are unchanged. README Phase 5/run note may need the
  5433 mention. To reset: `docker rm -f court-postgres && docker compose up -d postgres`.
- `package.json#prisma` seed config logs a deprecation warning (removed in Prisma 7)
  but still works on v6. Migrate to `prisma.config.ts` later if bumping to 7.

### Verification evidence (fresh, pnpm)
- `prisma validate` → valid; `prisma format` stable.
- `prisma migrate dev --name init` → applied; `prisma migrate status` → up to date.
- `prisma db seed` → "Seeded: 3 reporters, 2 editors, 4 jobs."
- query check → reporterBalances=3, editorBalances=2, 4 jobs all NEW (2 PHYSICAL / 2 REMOTE).
- `pnpm run build` (nest build) → 0 errors. `biome check .` → exit 0 (13 files).

---

## Phase 3 — Core workflow API 🟢

### What shipped
- **Modules** `jobs`, `reporters`, `editors` under `backend/src/`. (`payments`
  deferred to Phase 4 — `complete` + `payments/summary` belong there; creating an
  empty module now would be scaffolding theater.)
- **reporters / editors** — `POST` create (ULID + nested zeroed `*_balance` row in
  one create) and `GET` list (non-deleted, `include: { balance }`, ordered by
  `created_at`).
- **jobs** — create (DTO-validated), list + detail (`include` reporter/editor
  names + `earnings` block), `assign-reporter`, `assign-editor`, `status`.
- **assign-reporter / assign-editor** — interactive `prisma.$transaction` with
  `$queryRaw`: lock the job `FOR UPDATE`, then claim a worker
  `... LIMIT 1 FOR UPDATE SKIP LOCKED`. Reporter query orders by same-city-when-
  PHYSICAL preference. Sets FK + flips job/worker status. 409 on wrong state / no
  worker, 404 on missing job.
- **status** — `jobs.transitions.ts` holds `STATUS_TRANSITIONS`,
  `MANUAL_STATUS_TARGETS`, and `isLegalTransition(from,to,{hasEditor})` (single
  source of truth, importable by the Phase 6 parametrized test). REVIEWED requires
  an editor; illegal → 422.
- **Validation + errors** — global `ValidationPipe`
  (`whitelist`+`forbidNonWhitelisted`+`transform`) and `AllExceptionsFilter`
  (`src/common/`) returning `{ statusCode, error, message, path, timestamp }`.

### Key decisions
- **`city` required only when PHYSICAL** via `@ValidateIf(o => o.location_type ===
  PHYSICAL)` on the DTO → missing city on a PHYSICAL job is a 400. REMOTE city is
  nulled on create.
- **Per-job `earnings`** added to job responses now (reporter/editor amounts are
  null until Phase 4 completion) so the frontend contract is stable early.
- **assign endpoints return HTTP 200** (`@HttpCode(200)`), not 201 — they mutate an
  existing job, not create a resource.

### Gotchas / learnings (read before Phase 4)
- **`fastify` must be an explicit backend dep.** The exception filter imports
  `FastifyReply/FastifyRequest` types from `'fastify'`; under pnpm's strict
  (non-hoisted) layout the transitive copy isn't resolvable, so `tsc` threw
  `TS2307`. Fix: `pnpm add fastify`.
- **Biome `useImportType` (recommended) breaks NestJS at runtime.** `biome check
  --write` auto-rewrote injected providers (`PrismaService`, the feature services)
  and `@Body()` DTOs to `import type {...}`. That erases the runtime class, so
  `emitDecoratorMetadata` loses `design:paramtypes` → DI can't resolve deps and
  `ValidationPipe` can't see DTO types. Build still passes (types are fine) but the
  app fails at boot/validation. **Fix applied:** `style.useImportType: "off"` in
  `biome.json` + value imports for every DI token / decorated DTO. Pure
  type-only imports (e.g. service-method DTO params, `Prisma` namespace) stay
  `import type`.
- **Biome param decorators:** `@Param`/`@Body` need
  `javascript.parser.unsafeParameterDecoratorsEnabled: true` (added to
  `biome.json`), else 28-file parse errors.

### Verification evidence (live, against dockerized Postgres :5433)
- `pnpm run build` (nest build) → 0 errors. `biome check .` → exit 0 (28 files).
- Booted `node dist/main.js` on Fastify; `GET /api/health` → 200.
- Curl flow: invalid job → 400; PHYSICAL w/o city → 400; create valid → NEW + ULID;
  `assign-reporter` → ASSIGNED + same-city reporter (Andi Wijaya, Jakarta);
  second `assign-reporter` → 409; `status REVIEWED` pre-TRANSCRIBED → 422;
  `status TRANSCRIBED` → 200; `status REVIEWED` w/o editor → 422; `assign-editor`
  → editor attached; `status REVIEWED` w/ editor → 200; detail shows reporter+editor
  names + `earnings`.

### Deferred to later phases
- `payments` module + `complete` endpoint + rates config → Phase 4.
- Concurrency proof (20× parallel assign → 1 winner) is a Phase 6 integration test;
  manual single-thread path verified here.

---

## Phase 4 — Completion & payments 🟢

### What shipped
- **`complete`** (`POST /api/jobs/:job_id/complete`, `jobs.service.complete`) — one
  `prisma.$transaction` (reuses `ASSIGN_TX_OPTIONS`: ReadCommitted, 10s). Locks job
  `FOR UPDATE` via `lockJob`, guards `REVIEWED` (else 409) and reporter+editor set,
  computes `reporter_amount = duration_minutes × rate`, `editor_amount = flat fee`,
  reads both balances for `before_balance`, `createMany`s two `balance_ledger` rows,
  bumps both `*_balance.current_balance`, sets job `COMPLETED` + `finished_at` +
  amounts, releases both workers to `AVAILABLE`.
- **Rates** — `src/config/rates.ts` `getRates()` reads `REPORTER_RATE_PER_MINUTE`
  (default 2000) / `EDITOR_FLAT_FEE` (default 50000) from `process.env` at call time
  (matches main.ts's `process.env.PORT` pattern; no `@nestjs/config` dep added).
- **payments module** — `GET /api/payments/summary`: `total_payout` (sum of all
  worker balances) + per-reporter/editor `{current_balance, jobs[]}` where `jobs`
  are that payee's ledger rows. Per-job `earnings` were already in job responses
  (Phase 3 `toResponse`), now populated post-completion.

### Key decisions
- **Double-pay safety = the job `FOR UPDATE` lock**, not a separate idempotency key.
  Second `complete` blocks, re-reads `COMPLETED`, 409s. Verified live.
- **`createMany` for the two ledger rows** (one round-trip, append-only — no update/
  delete path anywhere; grep shows only `balanceLedger.createMany`/`findMany`).
- **Read-then-write balances inside the tx** is safe: a BUSY worker is pinned to one
  job at a time, so no concurrent completion touches the same balance row.

### Gotchas / learnings (read before Phase 5)
- **`lockJob` row has no `duration_minutes`** (its SELECT is workflow columns only) —
  re-fetch via `tx.job.findUniqueOrThrow({select:{duration_minutes:true}})` after the
  lock rather than widening the lock query.
- **`prisma migrate reset` is blocked** by the Prisma AI-consent guard — don't reset
  to clear BUSY workers from earlier manual testing. Instead `POST /reporters` +
  `/editors` to mint fresh `AVAILABLE` workers (also better test isolation).
- Biome wrapped the one long `current_balance:` update line — run `biome check --write`.

### Verification evidence (live, :5433, fresh worker pair)
- Flow create(90-min REMOTE)→assign-reporter(200)→TRANSCRIBED(200)→assign-editor(200)
  →REVIEWED(200)→complete: `reporter_amount=180000`, `editor_amount=50000`,
  `earnings.total=230000`, `status=COMPLETED`, `finished_at` set.
- Post-complete: both workers `AVAILABLE`; reporter balance 180000 / editor 50000;
  ledger 2 rows `before_balance=0`; 2nd complete → **409**.
- `/payments/summary` → `total_payout=230000`, per-worker rows correct.
- `pnpm run build` → 0 errors; `biome check .` → exit 0 (32 files).

### Deferred to Phase 6
- Atomicity-on-forced-failure (criterion #7) and concurrency proofs are integration
  tests; Phase 4 verified completion math + before_balance only.

---

## Phase 5 — Frontend dashboard 🟢

### What shipped
- **`src/api/types.ts`** — hand-written mirrors of backend responses (Job incl.
  `reporter`/`editor` party objects + `earnings`, Reporter/Editor w/ `balance`,
  `PaymentsSummary`, ledger rows, create-input bodies). Decoupled from Prisma's
  generated client on purpose.
- **`src/api/client.ts`** — typed `api` object (listJobs/getJob/createJob/
  assignReporter/assignEditor/setStatus/completeJob/listReporters/createReporter/
  listEditors/createEditor/getPaymentsSummary). `request<T>` reads the response
  body once as text then JSON-parses; on non-2xx throws `ApiError` carrying the
  backend envelope `message` (joins string[] from class-validator).
- **Components** — `JobsTable` (contextual actions by status, Mark-reviewed
  disabled until `editor_id` set), `CreateJobForm` (city field only when
  PHYSICAL), `WorkersPanel` (reporters/editors lists + add forms), `StatusBadge`,
  `PaymentsSummaryCard` (total_payout + per-worker balances), `format.ts`
  (`formatIdr`).
- **`App.tsx`** — `loadAll` fan-out (`Promise.all` of the 4 list/summary calls);
  `runAction` wraps every mutation (set pending, run, refresh, surface error);
  loading + dismissible error banner. CSS in `index.css` (grid layout, badges).

### Key decisions
- **Single `runAction` refresh model** over optimistic updates — simpler and the
  payloads are small; every mutation re-pulls the whole dashboard so balances /
  earnings / worker status stay consistent after `complete`.
- **`ApiError`** surfaces the real backend reason (e.g. "No available reporter",
  "Job is ASSIGNED, expected NEW") instead of a generic failure — the workflow's
  409/422 guards are the main UX feedback path.
- **Hand-written types** (not a generated client) keep the frontend build free of
  any Prisma/backend dependency.

### Gotchas / learnings (read before Phase 6)
- **Biome `useImportType` is ON in frontend** (recommended rules, unlike backend
  which disabled it). Type-only imports must be `import type`. No NestJS-style DI
  here, so this is safe — just keep value vs type imports split (`useState` value,
  `FormEvent` type).
- **Biome CSS formatter wants double quotes in attribute selectors**
  (`button[type="submit"]`), not single — `biome check .` fails until corrected.
  Run `biome check --write .`.
- **Smoke test must stub `fetch` per-endpoint.** App's mount `useEffect` calls
  `/payments/summary` (returns an **object** `{total_payout,reporters,editors}`),
  not an array — a blanket `[]` stub makes `formatIdr(summary.total_payout)`
  throw on `undefined`. Stub routes by URL; use `findByRole` (async) so the state
  update is awaited and React emits no `act()` warning.

### Verification evidence (fresh, pnpm)
- `pnpm run build` (`tsc -b && vite build`) → built, 36 modules, 0 TS errors.
- `pnpm exec biome check .` → exit 0 (20 files).
- `pnpm exec vitest run` → 1/1 pass, no act warnings.

### Deferred to Phase 6
- Live end-to-end UI drive (criterion #9) against the running stack is the Phase 6
  e2e happy-path test. Phase 5 verified the action→endpoint mapping by contract +
  build/lint/test, not a live click-through.

---

## Phase 6 — Tests & verification 🟢

### What shipped
- **Unit (thin, no DB)** —
  - `src/config/rates.spec.ts`: defaults (2000 / 50000), env override, bad/negative
    input → fallback (never NaN/negative). Snapshots+restores `process.env` per case.
  - `src/jobs/jobs.transitions.spec.ts`: one parametrized `it.each` over the full
    5×5 from/to grid × `hasEditor` (52 cases) against a local oracle, plus two
    explicit headline guards (TRANSCRIBED→REVIEWED editor gate, NEW→REVIEWED skip).
- **Integration (fat middle, real Postgres :5433)** — all boot the real Nest app on
  Fastify via a shared `test/helpers/e2e.ts` harness (`buildHarness`, `resetDb`,
  `createReporter/createEditor/createJob`) and drive it with `app.inject()`:
  - `test/assignment.e2e-spec.ts` — **FOR UPDATE**: 20 parallel assign-reporter on
    1 job + 1 reporter → exactly 1×200, 19×409, job ASSIGNED, reporter BUSY.
    **SKIP LOCKED**: 5 jobs + 3 reporters fired in parallel → 3 win, 2×409, no
    reporter double-booked (`Set(reporter_id).size === 3`).
  - `test/completion.e2e-spec.ts` — happy completion (90-min → 180000 / 50000,
    before_balance=0, balances bumped, COMPLETED + finished_at, both AVAILABLE);
    non-zero before_balance; **atomicity rollback** (see gotcha below).
- **e2e (thin top)** — `test/happy-path.e2e-spec.ts`: full flow through the **public
  API only** (create reporter/editor/job → assign-reporter → TRANSCRIBED →
  assign-editor → REVIEWED → complete → `/payments/summary` total 230000).

### Acceptance-criteria → test mapping (docs/plan.md)
- #2 invalid/valid job body — covered indirectly by create in happy-path (full
  400-path already curl-verified Phase 3); #3 same-city pick — Phase 3 live.
- #4 concurrency 1 winner → `assignment.e2e-spec` FOR UPDATE test.
- #5 illegal transition → `jobs.transitions.spec` (422 mapping is the controller's
  `UnprocessableEntityException`, exercised live Phase 3).
- #6 complete math + before_balance → `completion.e2e-spec` happy + non-zero tests.
- #7 atomic complete → `completion.e2e-spec` rollback test.
- #8 append-only ledger → no update/delete code path (grep: only `createMany`/
  `findMany` on `balanceLedger`).
- #9 dashboard happy path → driven end-to-end at the API layer by `happy-path`.
- #10 biome 0 + tests green → verified below.

### Key decisions
- **`fileParallelism: false`** in `vitest.config.ts`: the three DB specs share one
  Postgres and `TRUNCATE ... RESTART IDENTITY CASCADE` in `beforeEach`; running test
  files in parallel workers would wipe each other mid-test. Serial files fix it; the
  suite is small (~4s).
- **Harness mirrors `main.ts` exactly** (global `/api` prefix, ValidationPipe with
  whitelist/forbidNonWhitelisted/transform, AllExceptionsFilter) so integration
  tests hit the production request path, not a bare module.
- **Best-return rule honored**: one test per seam. No per-status-pair transition
  tests (one parametrized matrix instead), one FOR UPDATE + one SKIP LOCKED test.

### Gotchas / learnings
- **Atomicity needs a failure AFTER a write to prove rollback.** First cut deleted
  the `editor_balance` row, but the balance *read* (`SELECT ... FOR UPDATE`) runs
  before the ledger insert, so it threw with nothing yet written — a weak proof.
  Final approach stages `reporter_balance.current_balance = 2_000_000_000` and
  `duration = 90_000` (payout 180_000_000): the ledger rows insert cleanly (both
  values fit int4), then `reporterBalance.update` computes 2_180_000_000 >
  INT4_MAX (2_147_483_647) → Postgres "integer out of range" aborts the tx. Asserts
  the inserted ledger rows are gone, balance unchanged, job still REVIEWED.
- **`complete`/assign/status return HTTP 200** (`@HttpCode(OK)`), not 201 — only the
  create endpoints (jobs/reporters/editors) are 201. Tests assert accordingly.
- **Biome `noDelete`**: `delete process.env.X` trips `performance/noDelete`. Use
  object-rest to drop keys (`const { X: _x, ...rest } = process.env; process.env = rest`).
  Also `process.env.X = undefined` would coerce to the string `"undefined"`, not unset.
- **Tests truncate the dev seed.** After a full run the DB is empty of seed rows;
  re-run `pnpm prisma:seed` (truncate first if leftover test rows remain) to restore
  the canonical 3/2/4. `psql` isn't on the host — use `docker exec court-postgres psql`.

### Verification evidence (fresh, pnpm)
- backend `pnpm exec vitest run` → **62 passed** (6 files): rates 3, transitions 52,
  assignment 2, completion 3, happy-path 1, app smoke 1. ~4s.
- backend `pnpm exec biome check .` → exit 0 (38 files); `pnpm run build` → 0 errors.
- frontend `pnpm exec biome check .` → exit 0 (20 files); `pnpm exec vitest run` → 1/1.
- DB restored to canonical seed: 3 reporters / 2 editors / 4 jobs.
