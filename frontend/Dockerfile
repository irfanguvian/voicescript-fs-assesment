# syntax=docker/dockerfile:1.7
# Multi-stage, optimized frontend image (pnpm).
# Stages: build (vite static bundle) -> runtime (nginx serving static assets).

ARG NODE_VERSION=22-alpine
ARG NGINX_VERSION=1.27-alpine

# --- build: install deps + produce static bundle ---------------------------
FROM node:${NODE_VERSION} AS build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# --- runtime: nginx serving the built SPA ----------------------------------
FROM nginx:${NGINX_VERSION} AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Run as the unprivileged nginx user; make the paths it touches writable.
RUN touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid /usr/share/nginx/html /var/cache/nginx
USER nginx

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
