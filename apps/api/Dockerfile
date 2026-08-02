# Multi-stage build for the Veritine API (NestJS) inside a pnpm workspace
# monorepo. Build context is the repository root (see fly.toml), since the
# API depends on several workspace packages that must be built first.

FROM node:20-slim AS base
# Prisma's query-engine binary is picked per OpenSSL version at generate
# time; without openssl installed it silently defaulted to the wrong
# target (openssl-1.1.x) and crashed at boot with "Unable to require(...)".
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ---- deps: install once, cached across builds unless lockfile changes ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-config/package.json packages/shared-config/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/contract-client/package.json packages/contract-client/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

# ---- build: compile shared packages, generate the Prisma client, build the API ----
FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
COPY database ./database
RUN pnpm --filter @veritine/shared-types build \
  && pnpm --filter @veritine/shared-config --filter @veritine/validation --filter @veritine/contract-client -r build \
  && cd apps/api && node_modules/.bin/prisma generate --schema ../../database/schema.prisma \
  && cd /repo && pnpm --filter @veritine/api build

# ---- runtime: minimal image, production deps only ----
FROM node:20-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-config/package.json packages/shared-config/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/contract-client/package.json packages/contract-client/package.json
COPY apps/api/package.json apps/api/package.json
# Full install (not --prod) so the `prisma` CLI devDependency is present to
# run `prisma generate` below - simpler and more reliable than trying to
# copy the generated client out of the build stage's pnpm store path.
RUN pnpm install --frozen-lockfile

COPY --from=build /repo/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /repo/packages/shared-config/dist packages/shared-config/dist
COPY --from=build /repo/packages/validation/dist packages/validation/dist
COPY --from=build /repo/packages/contract-client/dist packages/contract-client/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY database ./database

# Prisma client is generated into the resolved @prisma/client package inside
# the pnpm store (see docs/architecture note on the schema-load fix) - the
# `pnpm install --prod` above already pulled a fresh @prisma/client, so
# generate again here against the real runtime node_modules layout.
WORKDIR /repo/apps/api
RUN node_modules/.bin/prisma generate --schema ../../database/schema.prisma

EXPOSE 4000
CMD ["node", "dist/main.js"]
