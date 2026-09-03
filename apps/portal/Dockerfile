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

# ---------------------------------------------------------------------------
# NEXT_PUBLIC_API_URL must be supplied HERE, as a --build-arg, not at
# container runtime. See apps/web/Dockerfile's own comment for the full
# explanation — apps/portal/src/lib/api.ts reads exactly the same
# `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"`
# expression, and `next build` substitutes it into the browser bundle at
# compile time.
#
# Both frontends point at the *same* API base URL. The portal's own routes
# live under `/portal/*` beneath it (see `apps/portal/src/lib/api.ts`), so
# this value is the API root including `/api/v1`, not a portal-specific path.
# ---------------------------------------------------------------------------
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}

ENV NODE_ENV=production

COPY . .

RUN if [ -z "$NEXT_PUBLIC_API_URL" ]; then \
      echo "ERROR: --build-arg NEXT_PUBLIC_API_URL=... is required." >&2; \
      echo "       It is compiled into the browser bundle by 'next build' and" >&2; \
      echo "       cannot be set at container runtime. See docs/deployment.md." >&2; \
      exit 1; \
    fi

RUN pnpm --filter @crm/shared build && pnpm --filter @crm/portal build

RUN node scripts/assert-public-api-url.mjs apps/portal "$NEXT_PUBLIC_API_URL"

FROM base AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# `next start` reads PORT when no `-p` flag is given (apps/portal's own
# `start` script passes `-p 3002`; this image does not go through it).
ENV PORT=3002
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# The workspace root manifests — see apps/web/Dockerfile's own comment.
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/portal ./apps/portal
WORKDIR /repo/apps/portal
USER node
EXPOSE 3002
# `node`, not `pnpm start` — see apps/web/Dockerfile's own comment: the
# runtime stage never downloaded pnpm, so `pnpm start` would fetch it from
# registry.npmjs.org on every container start.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
