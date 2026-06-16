# syntax=docker/dockerfile:1.7
# Multi-stage, optimized backend image (pnpm).
# Stages: deps (full install, cached) -> build (compile + prune) -> runtime (slim, non-root).

ARG NODE_VERSION=22-alpine

# --- base: node + pnpm via corepack -----------------------------------------
FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

# --- deps: install all deps with pnpm store cache ---------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- build: generate prisma client, compile TS, prune to prod deps ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm prune --prod

# --- runtime: minimal image, non-root --------------------------------------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

# dumb-init for correct PID 1 signal handling
RUN apk add --no-cache dumb-init

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# node user ships with the alpine image (uid 1000)
USER node
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
