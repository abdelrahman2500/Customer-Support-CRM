# syntax=docker/dockerfile:1
FROM node:20-slim AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
COPY apps/worker/package.json apps/worker/
# @crm/worker consumes @prisma/client's generated types (see
# src/queues/sla-timer.processor.ts's `TicketStatus` import) but the schema
# and the `prisma` CLI devDependency are owned by @crm/api (apps/api/prisma/
# schema.prisma, apps/api/package.json), not by @crm/worker itself. Also
# installing @crm/api here — alongside @crm/worker's own filter — makes its
# `prisma` CLI genuinely available so `prisma:generate` below runs the exact
# same way it already does in apps/api/Dockerfile, rather than relying on
# `prisma generate`'s own project-root inference to find a package it was
# never actually installed into.
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @crm/worker... --filter @crm/api

FROM deps AS build
COPY . .
# Generates straight into the @prisma/client package @crm/worker already
# depends on directly — pnpm dedupes identical versions (both @crm/worker
# and @crm/api pin @prisma/client@6.19.3) to one physical copy in the
# workspace's virtual store, so this single generation is what both
# consumers see. No second schema, no separate generation mechanism.
RUN pnpm --filter @crm/api prisma:generate
RUN pnpm --filter @crm/shared build && pnpm --filter @crm/ai build && pnpm --filter @crm/worker build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/worker ./apps/worker
WORKDIR /repo/apps/worker
CMD ["node", "dist/main.js"]
