# Court Reporting Workflow Manager

Monorepo for a simplified court-reporting workflow system.

- **`backend/`** — NestJS on the **Fastify** adapter, Prisma ORM, PostgreSQL, Biome.
- **`frontend/`** — React + Vite SPA dashboard.
- **`docs/`** — requirements, research, decisions, plan, checkpoints.

Domain flow: jobs move `NEW → ASSIGNED → TRANSCRIBED → REVIEWED → COMPLETED`.
Reporters are paid per minute, editors a flat fee; balances are backed by an
append-only ledger. See `docs/plan.md` for the full design.

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
