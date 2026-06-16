# Court Reporting Workspace — Agent Guide

pnpm monorepo: `backend/` (NestJS + Fastify + Prisma) and `frontend/` (React 19 + Vite).
Tests run on **Vitest** in both packages. Lint/format via **Biome**.

## Mandatory workflow gate

Run after EVERY feature change / addition / update — before considering the work done:

```bash
pnpm build   # backend: nest build · frontend: tsc -b && vite build
pnpm lint    # biome lint, both packages
pnpm test    # vitest run, both packages
```

All three MUST pass. This is non-negotiable for any change that touches source.

### Code follows tests

Tests are the specification. If a test written to spec fails because the
production code is wrong, **fix the production code** so the test passes.
Never weaken, skip, or delete a test to make the gate green.

### Testing Trophy methodology

Write only high-ROI tests; do not chase coverage for its own sake.

- **Static** (biome + tsc) and **integration** layers carry the most weight.
- **Unit-test** pure logic: state machines, rate/amount math, formatters,
  error-envelope decoding.
- **Component-test** behavior users rely on (forms, status-gated actions) with
  Testing Library — not implementation details.
- **Skip** thin controllers / module wiring (covered by backend e2e),
  purely presentational components, and DB concurrency paths (covered by the
  real-Postgres e2e specs in `backend/test/`).
- One test per behavior. No redundant variants.

## Faster local iteration

```bash
pnpm --dir backend test          # backend only
pnpm --dir frontend test         # frontend only
pnpm --dir backend run test:watch
pnpm --dir frontend run test:watch
```

Backend service unit tests inject a mock Prisma client (no DB). Real-database
behavior is covered by `backend/test/*.e2e-spec.ts`.
