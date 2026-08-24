# syntax=docker/dockerfile:1
FROM node:20-slim AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/portal/package.json apps/portal/
RUN pnpm install --frozen-lockfile --filter @crm/portal...

FROM deps AS build
COPY . .
RUN pnpm --filter @crm/shared build && pnpm --filter @crm/portal build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/portal ./apps/portal
WORKDIR /repo/apps/portal
EXPOSE 3002
CMD ["pnpm", "start"]
