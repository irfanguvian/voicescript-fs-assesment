# Court Reporting Workflow Manager

Monorepo for a simplified court-reporting workflow system.

- **`backend/`** — NestJS on the **Fastify** adapter, Prisma ORM, PostgreSQL, Biome.
- **`frontend/`** — React + Vite SPA dashboard.
- **`docs/`** — requirements, research, decisions, plan, checkpoints.

Domain flow: jobs move `NEW → ASSIGNED → TRANSCRIBED → REVIEWED → COMPLETED`.
Reporters are paid per minute, editors a flat fee; balances are backed by an
append-only ledger. See `docs/plan.md` for the full design.

## How it works (solution flow)

A job walks the lifecycle one step at a time — no skipping. Each transition is a
distinct REST call, validated against the transition map in
`backend/src/jobs/jobs.transitions.ts` (the single source of truth). Illegal
moves return `422`.

```
                                         (per-minute reporter pay
                                          + flat editor fee →
                                          2 ledger rows + balances)
 create     assign-reporter   status     assign-editor   status      complete
   │            │               │            │             │            │
   ▼            ▼               ▼            ▼             ▼            ▼
  NEW ──────▶ ASSIGNED ──▶ TRANSCRIBED ──▶ (editor set) ──▶ REVIEWED ──▶ COMPLETED
              │                                                           │
        reporter → BUSY                                    reporter+editor → AVAILABLE
```

1. **Create job** — `POST /api/jobs` (`case_name`, `duration_minutes`,
   `location_type` PHYSICAL|REMOTE, `city?`). Starts `NEW`.
2. **Assign reporter** — `POST /api/jobs/:id/assign-reporter`. One transaction:
   lock the job `FOR UPDATE` (must be `NEW`), pick an `AVAILABLE` reporter with
   `FOR UPDATE SKIP LOCKED` preferring same-city for PHYSICAL jobs, set
   `reporter_id`, job → `ASSIGNED`, reporter → `BUSY`. `409` if none free.
3. **Mark transcribed** — `POST /api/jobs/:id/status` `{ "status": "TRANSCRIBED" }`.
4. **Assign editor** — `POST /api/jobs/:id/assign-editor`. Same SKIP LOCKED
   pattern on `editor`; job must be `TRANSCRIBED`. Editor → `BUSY`.
5. **Mark reviewed** — `POST /api/jobs/:id/status` `{ "status": "REVIEWED" }`.
   Rejected unless an editor is assigned.
6. **Complete** — `POST /api/jobs/:id/complete`. One transaction: job (must be
   `REVIEWED`) → `COMPLETED` + `finished_at`; reporter & editor → `AVAILABLE`;
   compute `reporter_amount = duration_minutes × REPORTER_RATE_PER_MINUTE` and
   `editor_amount = EDITOR_FLAT_FEE`; append two `balance_ledger` rows (each with
   `before_balance`) and bump both `*_balance.current_balance` — atomically.

**Reads:** `GET /api/jobs` (dashboard: status, assignees, per-job earnings),
`GET /api/jobs/:id` (detail + payment breakdown), `GET /api/payments/summary`
(total payout + per reporter/editor). Reporters/editors via
`POST|GET /api/reporters` and `/api/editors` (create also seeds a zeroed balance).

**Why it holds up:**

- **Concurrency** — assignment locks the job row, then claims a worker with
  `FOR UPDATE SKIP LOCKED`, so N parallel assigns on one job yield exactly one
  winner and never double-book a worker.
- **Money is integer cents**, never floats. Rates come from env
  (`REPORTER_RATE_PER_MINUTE`=2000, `EDITOR_FLAT_FEE`=50000) with safe defaults.
- **`balance_ledger` is append-only** — insert only, never update/delete — so
  payouts are auditable. Balances are derived alongside in the same transaction.
- **Soft delete** via `deleted_at` on job/reporter/editor; filtered in queries.

The frontend SPA drives this whole flow with contextual per-row action buttons —
each button is enabled only when the job's status permits that transition.

## Prerequisites

- Node.js 22+
- **pnpm 10+** (`corepack enable && corepack prepare pnpm@10.33.0 --activate`, or `brew install pnpm`)
- Docker + Docker Compose (for PostgreSQL)

Each package manages its own dependencies and `pnpm-lock.yaml` — this is **not**
a pnpm workspace. The root `package.json` is a thin convenience runner (via
`concurrently`); it installs nothing of its own beyond that and delegates to each
package. Run pnpm inside `backend/` and `frontend/` for real work, or use the
root shortcuts below.

```bash
pnpm install:all   # install both packages (backend + frontend)
pnpm dev           # run backend (start:dev) + frontend (vite) together
pnpm build         # build both packages
pnpm lint          # biome lint both packages
pnpm test          # vitest run both packages
```

## Quick start (local)

```bash
# 1. Start PostgreSQL
docker compose up -d                 # postgres:16-alpine, host port :5433

# 2. Backend
cd backend
cp .env.example .env                 # adjust if needed
pnpm install
pnpm run prisma:generate
pnpm run prisma:migrate              # applies migrations (Phase 2+)
# pnpm run prisma:studio             # optional: inspect data
pnpm run start:dev                   # Fastify API on :3000

# 3. Frontend (new terminal)
cd frontend
pnpm install
pnpm run dev                         # Vite dev server on :5173, /api proxied to :3000
```

The frontend dev server proxies `/api/*` to the backend (`vite.config.ts`).
Override the target with `VITE_API_PROXY_TARGET` if the backend runs elsewhere.

## Running the full stack in Docker

Backend and frontend ship optimized multi-stage Dockerfiles and sit behind the
`full` compose profile:

```bash
docker compose --profile full up --build
# postgres :5433 · backend :3000 · frontend (nginx) :8080
```

- `backend/Dockerfile` — `deps → build → runtime` stages (pnpm via corepack),
  runs `prisma generate`, `pnpm prune --prod`, runs as the non-root `node` user
  under `dumb-init`.
- `frontend/Dockerfile` — `build → nginx` stages (pnpm via corepack); nginx serves
  the static SPA as the non-root `nginx` user and proxies `/api` to `backend`.

## Dev container

`.devcontainer/` provides a ready-to-code environment (workspace + postgres via
compose, Node 22, Biome/Prisma extensions). Open the folder in VS Code and
"Reopen in Container"; `postCreateCommand` enables pnpm and installs deps for
both packages.

## Linting & formatting (Biome)

Biome is the single linter/formatter (no ESLint/Prettier). **Config is dedicated
per package** — `backend/biome.json` and `frontend/biome.json` — and the Biome
binary is a dev dependency of each package (nothing installed at the repo root).
Run it from inside the package you want to check:

```bash
cd backend  && pnpm run check        # lint + format check (or: pnpm run lint / pnpm run format)
cd frontend && pnpm run check
```

## Testing (Vitest)

Both packages use **Vitest** (no Jest). E2E for the backend boots the real Nest
app on the Fastify adapter.

```bash
cd backend  && pnpm run test         # unit + e2e (vitest)
cd backend  && pnpm run test:e2e     # e2e only (test/ dir)
cd frontend && pnpm run test         # component tests (jsdom)
```

See `docs/plan.md` Phase 6 for the Testing Trophy strategy (one highest-return
test per concern), and `docs/notes.md` for per-phase build notes.

## Project layout

```
.
├── package.json        root convenience runner (concurrently): dev/build/lint/test
├── backend/            NestJS + Fastify + Prisma (+ backend/biome.json)
├── frontend/           React + Vite (+ frontend/biome.json)
├── docker-compose.yml  postgres (default) + backend/frontend (profile: full)
├── .devcontainer/      VS Code dev container
└── docs/               requirement, research, decision, plan, checkpoint, notes
```

Dependencies are managed with **pnpm**, per package (each has its own
`pnpm-lock.yaml`). The root `package.json` is only a convenience runner — there
is no pnpm workspace; nothing is hoisted to the repo root.
