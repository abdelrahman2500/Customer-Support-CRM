# syntax=docker/dockerfile:1
FROM node:20-slim AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @crm/web...

FROM deps AS build

# ---------------------------------------------------------------------------
# NEXT_PUBLIC_API_URL must be supplied HERE, as a --build-arg, not at
# container runtime.
#
# `apps/web/src/lib/api.ts` reads
#   process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"
# and `NEXT_PUBLIC_*` is a *compile-time* substitution: `next build` replaces
# that expression with a string literal inside the JavaScript the browser
# downloads. A `docker run -e NEXT_PUBLIC_API_URL=...` therefore has no
# effect whatsoever on the client bundle — by then the value is already
# baked in. Build the image without this arg and every deployed browser
# permanently tries to reach `http://localhost:3001/api/v1`, i.e. the
# end user's own machine, which presents on the login page as an
# unreachable API with nothing at all in the deployed API's logs.
#
# Include the `/api/v1` suffix: it is part of the base URL the client
# concatenates paths onto (see `apps/api/src/main.ts`'s
# `setGlobalPrefix("api/v1")`).
#
# Also note this value has to be reachable from the *browser*, not from
# inside the cluster — it is the public address of the API. Next.js server
# components in this image resolve the same compiled-in constant, so that
# public address must be reachable from the container as well.
# ---------------------------------------------------------------------------
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Story 113 — optional; unset means unhandled browser exceptions are still
# caught and logged, just not reported anywhere external.
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}

# Next.js only applies its production optimizations when NODE_ENV=production
# at build time, and `next start` in the runtime stage below expects a
# production build.
ENV NODE_ENV=production

COPY . .

# Fail fast, with an actionable message, rather than producing an image whose
# browser bundle points at localhost. This is deliberately a build-time
# check: the mistake is unrecoverable after this stage.
RUN if [ -z "$NEXT_PUBLIC_API_URL" ]; then \
      echo "ERROR: --build-arg NEXT_PUBLIC_API_URL=... is required." >&2; \
      echo "       It is compiled into the browser bundle by 'next build' and" >&2; \
      echo "       cannot be set at container runtime. See docs/deployment.md." >&2; \
      exit 1; \
    fi

# `pnpm --filter`, not `turbo run` — turbo's default strict env mode filters
# the environment it hands to each task, so the build here stays independent
# of turbo.json's env declarations. `@crm/shared` is built explicitly for the
# same reason (apps/web imports it only via `import type`, which SWC erases,
# but Next's separate tsc pass still needs the real declarations).
RUN pnpm --filter @crm/shared build && pnpm --filter @crm/web build

# Prove it: the built client bundle must contain the API URL that was passed
# in and must NOT contain the localhost development fallback.
RUN node scripts/assert-public-api-url.mjs apps/web "$NEXT_PUBLIC_API_URL"

FROM base AS runtime
ENV NODE_ENV=production
# Bind to every interface — the container's published port is unreachable if
# `next start` listens on loopback only.
ENV HOSTNAME=0.0.0.0
# `next start` reads PORT when no `-p` flag is given.
ENV PORT=3000
# Carried through for the Next.js server runtime. The client bundle already
# has this value compiled in (see the build stage); this covers any code path
# that reads it dynamically on the server side, and makes the effective
# configuration visible in `docker inspect`.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# The workspace root manifests. Not needed by the CMD below (which calls
# node directly), but they keep `/repo` a recognizable pnpm workspace root,
# so `pnpm --filter @crm/web <script>` behaves inside the container the same
# way it does in the repository when someone execs in to diagnose something.
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/web ./apps/web
WORKDIR /repo/apps/web
# Drop privileges — the node:20-slim image ships an unprivileged `node` user.
USER node
EXPOSE 3000
# `node`, not `pnpm start`. The runtime stage restarts from `base`, which has
# corepack *enabled* but has never actually downloaded pnpm (that happened in
# the `deps`/`build` layers), so `pnpm start` made corepack fetch pnpm from
# registry.npmjs.org on every container start — an outbound network
# dependency at boot, which fails outright in a network-restricted or
# air-gapped deployment. Invoking Next's own binary directly removes the
# package manager, and the network, from the startup path.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
