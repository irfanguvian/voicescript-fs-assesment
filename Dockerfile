# syntax=docker/dockerfile:1.7
# Option B — single image: NestJS backend serves the built React SPA.
# Build context is the repo root (needs both frontend/ and backend/).
# Stages: frontend build -> backend deps -> backend build/prune -> runtime.

ARG NODE_VERSION=22-alpine

# --- base: node + pnpm via corepack -----------------------------------------
FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# --- frontend: produce the static SPA bundle (frontend/dist) -----------------
FROM base AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

# --- backend deps: full install (cached) ------------------------------------
FROM base AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- backend build: prisma client + compile + prune to prod deps ------------
FROM base AS backend-build
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./
RUN pnpm exec prisma generate
RUN pnpm run build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm prune --prod

# --- runtime: minimal image, non-root, serves API + SPA ---------------------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache dumb-init

COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/prisma ./prisma
COPY --from=backend-build /app/backend/package.json ./package.json
# SPA bundle served by NestJS from /app/public (see backend/src/main.ts).
COPY --from=frontend-build /app/frontend/dist ./public

USER node
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
