# Frontend — Court Reporting Workflow Manager

React 19 + Vite 6 + TypeScript dashboard. Package manager: **pnpm**.

## Commands

```bash
pnpm dev                # vite dev server (port 5173)
pnpm build              # tsc -b && vite build
pnpm preview            # serve built dist/
pnpm test               # vitest run
pnpm test:watch
pnpm check              # biome check (lint + format)
pnpm format             # biome format --write
```

Lint/format is **Biome**, not ESLint/Prettier. Tests: Vitest + Testing Library + jsdom. Run `pnpm check` before claiming done.

## Layout

- `src/main.tsx` — entry. `src/App.tsx` — root component.
- `src/api/client.ts` — fetch wrapper. Throws `ApiError(statusCode, message)` on non-2xx, parsing backend error envelope. Use it for all backend calls.
- `src/api/types.ts` — shared types (Job, Reporter, Editor, JobStatus, PaymentsSummary, Create*Input). Keep in sync with backend DTOs.
- `src/components/` — `JobsTable`, `CreateJobForm`, `WorkersPanel`, `PaymentsSummaryCard`, `StatusBadge`.
- `src/format.ts` — display formatting (money is **integer cents** from the API — format here).
- `src/index.css`.

## API proxy

In **dev**, Vite proxies `/api/*` to the backend (`vite.config.ts`); target is `VITE_API_PROXY_TARGET` env, default `http://localhost:3000`. In **docker** the SPA is served by nginx, which proxies `/api/` to `http://backend:3000` (`nginx.conf`) — Vite is not running there. Either way, don't hardcode the backend host in code — go through `/api`.

## Conventions

- Money values from the API are integer cents — never assume dollars/floats.
- Job status strings/order mirror the backend lifecycle (`NEW → ASSIGNED → TRANSCRIBED → REVIEWED → COMPLETED`).
