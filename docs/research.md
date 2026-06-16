# Research — Court Reporting Workflow Manager

Date: 2026-06-12
Sources: `docs/requirement.md` (assessment spec), `docs/decision.md` (prior design doc), brainstorming session.

## 1. What the requirement asks for

- Jobs: `case_name`, `duration` (minutes), `location` (physical/remote), `status`.
- Status flow: `NEW → ASSIGNED → TRANSCRIBED → REVIEWED → COMPLETED`.
- Reporter assignment with "prefer same city for physical jobs, allow remote" logic.
- Editor assignment after transcription, with review tracking.
- Payments: reporter paid per minute (example 2000 IDR/min), editor paid flat fee per job. System calculates total payout and per-job earnings.
- Frontend: simple dashboard (job list, status, assignments). Function over design.
- Backend: REST API, Node.js + TypeScript, any DB (Postgres preferred, SQLite OK).

## 2. What is reusable from decision.md

| Item | Verdict |
|---|---|
| ULID primary keys | Reuse |
| `reporter_balance` + append-only `balance_ledger` (with `before_balance`) | Reuse, extended to editors |
| Assignment inside a transaction with `FOR UPDATE` on job + `FOR UPDATE SKIP LOCKED` on worker | Reuse verbatim |
| Completion endpoint doing status flip + ledger append + balance update in one transaction | Reuse |
| Postgres choice rationale (row-level locking, indexing) | Reuse |

## 3. Gaps in decision.md vs the requirement

1. **No editor entity** — requirement needs editor assignment and flat-fee editor payment.
2. **Status mismatch** — decision.md used `IN_PROGRESS / REVIEW`; requirement says `TRANSCRIBED / REVIEWED`.
3. **Missing fields** — job `duration`, job `location` (physical/remote), reporter `location`, same-city preference logic, payment rates.
4. **Internal inconsistency** — decision.md says reporter status flips to `IDLE` on assignment; the enum only defines `AVAILABLE | OFFLINE`. We add `BUSY`.
5. **SQLite incompatibility** — `FOR UPDATE SKIP LOCKED` is Postgres-only; SQLite has a single-writer whole-DB lock and no row locks.

## 4. Decisions made (brainstorm outcomes)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Database / concurrency | **Postgres-first, keep `FOR UPDATE SKIP LOCKED`** | Reuses decision.md design verbatim; SKIP LOCKED keeps throughput under concurrent assignment. SQLite dropped because the locking pattern cannot port. Postgres runs via docker-compose so spin-up stays one command. |
| D2 | Status flow | **Follow requirement.md**: `NEW → ASSIGNED → TRANSCRIBED → REVIEWED → COMPLETED` | Assessment is graded against the spec wording. |
| D3 | Editor model | **Mirror reporter pattern**: `editor` + `editor_balance` + shared append-only `balance_ledger` with `payee_type (REPORTER\|EDITOR)`. Editor auto-assign reuses the same SKIP LOCKED flow when job hits `TRANSCRIBED`. Flat fee credited at `COMPLETED`. | Consistency; full audit trail for both payee types. |
| D4 | Frontend | **React + Vite SPA** in `frontend/`, talking to the NestJS REST API | Standard fullstack-assessment shape; no SSR complexity. |
| D5 | Backend stack | **NestJS + Fastify adapter + Prisma + Biome** — scaffold is the first task | User requirement. |

## 5. Defaults adopted without further discussion

- Same-city preference for physical jobs: reporter pick query orders by city match first (`ORDER BY (reporter.city = job.city) DESC`), falls back to any available reporter (remote allowed).
- Rates configurable via env: `REPORTER_RATE_PER_MINUTE=2000`, `EDITOR_FLAT_FEE=50000` (IDR).
- Monorepo layout: `backend/` + `frontend/` in this repo.
- Postgres via `docker-compose.yml`.
- Concurrency proven by an integration test firing parallel assignment requests and asserting no double-assignment.

## 6. Technical notes

- Prisma has no first-class `FOR UPDATE SKIP LOCKED`; use `prisma.$queryRaw` inside an interactive `prisma.$transaction`.
- Prisma has no native ULID generator; generate ULIDs in the application layer (`ulid` package) and store as `String @id`.
- NestJS on Fastify: use `@nestjs/platform-fastify`; Fastify-specific plugins (e.g. `@fastify/cors`) instead of Express middleware.
