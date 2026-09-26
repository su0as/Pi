# syntax=docker/dockerfile:1
#
# Build from the monorepo root: docker build -f apps/api/Dockerfile .
#
# No `tsc`-compile stage: apps/api runs its TypeScript source directly via tsx, same as
# `pnpm dev` minus --watch. See docs/adr/0006-run-typescript-source-in-production.md for why —
# short version: packages/db and packages/core ship as raw .ts on purpose (ADR-0001), so a
# compiled apps/api/dist/ would still import uncompiled .ts from its workspace dependencies, and
# plain `node` can't resolve those; tsx can.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- deps: install once, cached as long as manifests don't change ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/reader/package.json packages/reader/package.json
COPY packages/sources/package.json packages/sources/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN pnpm install --frozen-lockfile

# --- runtime: only the source this app actually needs at runtime ---
FROM deps AS runtime
COPY apps/api apps/api
COPY packages/config packages/config
COPY packages/db packages/db
COPY packages/core packages/core
COPY packages/reader packages/reader
COPY packages/sources packages/sources

RUN addgroup -S app && adduser -S app -G app
RUN chown -R app:app /repo
USER app

ENV NODE_ENV=production
WORKDIR /repo/apps/api
EXPOSE 3001

CMD ["node_modules/.bin/tsx", "--env-file-if-exists=.env", "src/index.ts"]
