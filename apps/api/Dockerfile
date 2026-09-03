# syntax=docker/dockerfile:1
FROM node:20-slim AS base
WORKDIR /repo
# A shared, image-wide corepack cache instead of the invoking user's home
# directory. The `runtime` stage below restarts from `base`, so it has
# corepack *enabled* but has never downloaded pnpm — the download happened in
# the `deps` layer. Copying this directory forward means the migration
# command in docs/deployment.md (`pnpm --filter @crm/api migrate:deploy`)
# runs without reaching out to registry.npmjs.org, which a
# network-restricted or air-gapped deployment would refuse.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable
# Prisma's query engine is dynamically linked against OpenSSL, which
# node:20-slim does not ship. Without it the client fails at connect time
# with "Unable to require libquery_engine-*.so.node", not at build time.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @crm/api...

FROM deps AS build
COPY . .
RUN pnpm --filter @crm/api prisma:generate
RUN pnpm --filter @crm/shared build && pnpm --filter @crm/ai build && pnpm --filter @crm/api build

FROM base AS runtime
ENV NODE_ENV=production
# The workspace root manifests, so `pnpm --filter @crm/api <script>` resolves
# inside the image. That is what makes the migration command in
# docs/deployment.md runnable from this same image:
#
#   docker run --rm -e DATABASE_URL=... <image> \
#     pnpm --filter @crm/api migrate:deploy
#
# docs/architecture/11-quality-and-operations.md requires migrations to run
# *explicitly* before API startup in non-local environments, never
# implicitly at boot — so this image's CMD starts the server and nothing
# else. `docker-compose.prod.yml` wires the explicit ordering with a
# one-shot `migrate` service the `api` service waits on.
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api ./apps/api
# The pnpm binary corepack already fetched during `deps`, so no runtime
# download is needed (see the COREPACK_HOME comment in `base`).
COPY --from=build --chown=node:node /opt/corepack /opt/corepack
WORKDIR /repo/apps/api
# Drop privileges — the node:20-slim image ships an unprivileged `node` user.
USER node
EXPOSE 3001
# Liveness only. `/health/ready` additionally checks Postgres and Redis and
# belongs in the orchestrator's readiness probe, not here: a container whose
# database is briefly unreachable should not be killed and restarted.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
