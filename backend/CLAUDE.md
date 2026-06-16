# Backend — Court Reporting Workflow Manager

NestJS (Fastify adapter) + Prisma + PostgreSQL. TypeScript. Package manager: **pnpm**.

## Commands

```bash
pnpm start:dev          # watch-mode dev server (port 3000)
pnpm build              # nest build → dist/
pnpm start:prod         # node dist/main.js
pnpm test               # vitest run (unit)
pnpm test:e2e           # vitest run --dir test (e2e)
pnpm check              # biome check (lint + format)
pnpm format             # biome format --write
pnpm prisma:migrate     # prisma migrate dev
pnpm prisma:generate    # regenerate client
pnpm prisma:seed        # tsx prisma/seed.ts
pnpm prisma:studio
```

Lint/format is **Biome**, not ESLint/Prettier. Run `pnpm check` before claiming done.

## Layout

- `src/main.ts` — bootstrap. Global prefix `/api`, CORS open, `ValidationPipe` with `whitelist + forbidNonWhitelisted + transform`, `AllExceptionsFilter`.
- `src/app.module.ts` — root module.
- Feature modules: `jobs/`, `reporters/`, `editors/`, `payments/` — each has `*.controller.ts`, `*.module.ts`, `*.service.ts`, and `dto/`.
- `src/prisma/` — `PrismaService` + module.
- `src/config/rates.ts` — payment rates from env, read at call time.
- `src/common/http-exception.filter.ts` — error envelope `{ statusCode, error, message, path, timestamp }`.
- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`.
- `test/` — e2e specs + `helpers/`. Unit specs live next to source (`*.spec.ts`).

## Domain rules (don't break these)

- **IDs are ULIDs** generated in the app layer (`ulid` pkg), stored as `String @id`. Don't switch to DB autoincrement/uuid.
- **Money is integer cents.** `reporter_amount`, `editor_amount`, balances, ledger `amount` — all `Int`. No floats.
- **Job lifecycle** (`src/jobs/jobs.transitions.ts` is single source of truth):
  `NEW → ASSIGNED → TRANSCRIBED → REVIEWED → COMPLETED`. No skipping. `→ REVIEWED` requires an editor assigned. `ASSIGNED` set via assign-reporter, `COMPLETED` via complete endpoint — not the manual status endpoint.
- **`BalanceLedger` is append-only** — insert only, never update/delete. Deliberately has no `updated_at`. Preserve that.
- **Soft delete** via `deleted_at` on Job/Reporter/Editor. Filter it in queries.
- **Rates** from env (`REPORTER_RATE_PER_MINUTE`=2000, `EDITOR_FLAT_FEE`=50000 cents). Bad/missing env falls back to default — never NaN into a payout.

## Env

Copy `.env.example` → `.env`. Postgres matches root `docker-compose.yml` (port 5433). `DATABASE_URL`, `PORT`, rate vars.
