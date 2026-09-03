# Deployment

How to deploy this CRM so that a **real browser on the internet can reach the
deployed API and stay signed in**.

This document exists because the deployment-critical settings in this project
fail _silently_ and _identically_: a wrong build argument, a missing CORS
origin, a cookie attribute that does not match the deployment's DNS layout,
and a runtime database that migrations never touched all present to the user
as the same thing — "login is broken" — while the API's own logs look
perfectly healthy. Each one is called out below with the symptom it produces
and the way to verify it.

> **What this repository does and does not contain.** It contains no
> production hostnames, no production credentials, no registry, and no
> platform integration (no Terraform, no Kubernetes manifests, no deploy
> workflow). Everything a deployment needs is enumerated in
> [`.env.production.example`](../.env.production.example), and
> [`docker-compose.prod.yml`](../docker-compose.prod.yml) is the reference
> topology. What must still be supplied by whoever operates the deployment is
> listed in [Supplied by the deployment platform](#supplied-by-the-deployment-platform).

---

## The one thing to get right first: `NEXT_PUBLIC_API_URL`

`apps/web/src/lib/api.ts` and `apps/portal/src/lib/api.ts` both resolve their
API base URL like this:

```ts
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
}
```

`NEXT_PUBLIC_*` variables are **compile-time substitutions**. `next build`
replaces that whole expression with a string literal inside the JavaScript
the browser downloads. Consequences:

- The value must be present **when the image is built** — as a
  `--build-arg`, never as a runtime `-e` / `environment:` entry. A runtime
  variable arrives far too late and is silently ignored for client code.
- If it is absent at build time, the _fallback_ is compiled in, and every
  deployed browser tries to reach `http://localhost:3001/api/v1` — which
  resolves to **the end user's own machine**. The request never reaches the
  deployed API, so there is nothing in the API's logs to find.
- Changing the deployed API URL requires **rebuilding** `apps/web` and
  `apps/portal`. Restarting them is not enough.

It must include the `/api/v1` suffix — `apps/api` mounts every route under
that global prefix (`apps/api/src/main.ts`, `setGlobalPrefix("api/v1")`), and
the client concatenates paths onto this base.

It must be the **public** address, reachable from a browser — not an internal
service name such as `http://api:3001/api/v1`, which only resolves inside the
container network. Next.js server components in the same image resolve the
identical compiled-in constant, so that public address has to be reachable
from inside the container as well.

### How this is enforced

Three layers, so the mistake cannot reach a deployed image:

1. **`apps/web/Dockerfile` / `apps/portal/Dockerfile`** declare
   `ARG NEXT_PUBLIC_API_URL`, promote it to `ENV` before `next build`, and
   **fail the build** with an explanatory message if it is empty.
2. After the build, both run
   [`scripts/assert-public-api-url.mjs`](../scripts/assert-public-api-url.mjs),
   which scans `.next/static` and `.next/server` and fails if the localhost
   fallback is present, or if the URL that was passed in is _absent_.
3. `docker-compose.prod.yml` passes it as a `build.args` entry using
   `${NEXT_PUBLIC_API_URL:?...}`, so Compose refuses to build without it.

The same assertion can be run by hand against any build output:

```bash
node scripts/assert-public-api-url.mjs apps/web
node scripts/assert-public-api-url.mjs apps/portal "https://api.example.com/api/v1"
```

### A note on turbo

The Dockerfiles build with `pnpm --filter @crm/web build`, not
`turbo run build`, so the image build does not depend on turbo's environment
handling at all. For repo-root builds (`pnpm build`) and for CI, turbo runs in
its default **strict** env mode, which hands each task only the variables
declared for it — so `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SENTRY_DSN` and
`SENTRY_DSN` are declared in `turbo.json`'s `build.env`. Without that
declaration a root `pnpm build` can produce a bundle carrying the localhost
fallback even though the variable was exported in the shell.

---

## Cookies, CORS and cross-site auth

Authentication uses two credentials (`apps/api/src/modules/identity/`):

- a short-lived **access token** returned in the login response body, which
  the frontend stores in a readable cookie and sends as
  `Authorization: Bearer`;
- a long-lived **refresh token** in an `httpOnly` cookie scoped to
  `/api/v1/auth` (agents) or `/api/v1/portal/auth` (portal customers), which
  the browser attaches automatically to `POST /auth/refresh`,
  `POST /auth/logout` and `POST /auth/switch-branch`.

Both matter for a deployment, in different ways.

### `CORS_ORIGINS` — required in production

Comma-separated list of every deployed browser origin that calls the API:
the agent workspace and, where deployed, the customer portal.

```
CORS_ORIGINS="https://crm.example.com,https://portal.example.com"
```

- **Required** when `NODE_ENV=production` — the API now refuses to start
  without it. Previously it booted happily with an empty allow-list and
  rejected every browser request.
- Each entry is `scheme://host[:port]`, exactly as a browser sends it in the
  `Origin` header: **no trailing slash, no path**. A trailing slash is
  normalized away; anything carrying a path, a query, a fragment,
  credentials, a non-`http(s)` scheme, or `*` is rejected at boot with the
  reason, rather than kept as a value that could never match.
- `*` is rejected deliberately: this API sets `credentials: true`, and the
  CORS specification forbids a wildcard origin on a credentialed response.
- The same parsed list is used for the Socket.IO handshake
  (`RedisIoAdapter`), so a missing origin also breaks realtime updates.
- **Symptom when wrong:** the browser reports a CORS/network error; the API
  logs nothing, because the preflight was rejected before any handler ran.
- **Verify:** the API prints `CORS allowed origins: ...` at boot. Or from a
  shell:

  ```bash
  curl -i -X OPTIONS https://api.example.com/api/v1/auth/login \
    -H 'Origin: https://crm.example.com' \
    -H 'Access-Control-Request-Method: POST'
  ```

  A correct configuration answers with
  `access-control-allow-origin: https://crm.example.com` and
  `access-control-allow-credentials: true`. A missing/incorrect origin
  returns neither header.

### `AUTH_COOKIE_SAMESITE` — decided by your DNS layout

The refresh-token cookie's `SameSite` attribute. Default `strict`, which is
exactly what the controllers hard-coded before this variable existed.

A browser sends a `SameSite=strict` cookie only on **same-site** requests,
and "same site" means the same _registrable domain_ — not the same origin.
So:

| Browser origin                 | API origin                  | Same-site? | Setting            |
| ------------------------------ | --------------------------- | ---------- | ------------------ |
| `https://crm.example.com`      | `https://api.example.com`   | yes        | `strict` (default) |
| `https://example.com`          | `https://api.example.com`   | yes        | `strict` (default) |
| `https://crm.example.com`      | `https://api.example.net`   | **no**     | `none`             |
| `https://crm-web.somepaas.app` | `https://crm-api.other.dev` | **no**     | `none`             |

- **Symptom when wrong:** login _appears to succeed_, then the session dies
  at the first access-token expiry (15 minutes by default) and the user is
  bounced to the login page. `POST /auth/refresh` returns 401 with nothing
  suspicious in the logs, because the request genuinely arrived with no
  cookie — the browser withheld it. Branch switching breaks the same way.
- `none` requires `Secure`, which this app ties to `NODE_ENV=production`;
  the API refuses `AUTH_COOKIE_SAMESITE=none` outside production, since
  browsers would drop such a cookie outright.
- **Verify:** the API prints `Refresh cookie: SameSite=...; Secure=...` at
  boot, and the `set-cookie` header on a login response shows the attributes
  the browser will actually see.
- **The simplest way to avoid this entirely** is to put both frontends and
  the API on one registrable domain (`crm.example.com`,
  `portal.example.com`, `api.example.com`) and keep the default.

### Credentials must stay on

The frontends call the refresh/logout/switch-branch endpoints with
`credentials: "include"`, and the API answers with `credentials: true`. Both
halves are required; neither is configurable, and neither should be removed.
This is also why `CORS_ORIGINS` cannot be `*`.

---

## API runtime configuration

Validated once at boot by `apps/api/src/common/config/env.validation.ts` —
a missing or malformed value fails startup immediately rather than letting
the app run misconfigured.

| Variable                                                        | Required              | Notes                                                                                                                                                                                             |
| --------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                      | yes                   | `production`. Also switches the refresh cookie to `Secure` and disables the Swagger UI.                                                                                                           |
| `PORT`                                                          | no (3001)             |                                                                                                                                                                                                   |
| `DATABASE_URL`                                                  | yes                   | The migration/owner role. See [Database](#database-migrations-and-seed).                                                                                                                          |
| `APP_DATABASE_URL`                                              | no                    | The restricted runtime role. Must name the **same database** as `DATABASE_URL`.                                                                                                                   |
| `REDIS_URL`                                                     | yes                   | BullMQ queues **and** the Socket.IO adapter.                                                                                                                                                      |
| `JWT_ACCESS_SECRET`                                             | yes                   | ≥ 32 characters.                                                                                                                                                                                  |
| `JWT_REFRESH_SECRET`                                            | yes                   | ≥ 32 characters, **must differ** from the access secret.                                                                                                                                          |
| `JWT_ACCESS_TTL`                                                | no (`15m`)            |                                                                                                                                                                                                   |
| `JWT_REFRESH_TTL_DAYS`                                          | no (`7`)              |                                                                                                                                                                                                   |
| `CORS_ORIGINS`                                                  | **yes in production** | See above.                                                                                                                                                                                        |
| `AUTH_COOKIE_SAMESITE`                                          | no (`strict`)         | See above.                                                                                                                                                                                        |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | yes                   | Attachments. The defaults are the local MinIO container and are **not** valid in production. `S3StorageService.onModuleInit` calls the endpoint at boot, so an unreachable value crashes startup. |
| `SENTRY_DSN`                                                    | no                    | Sentry or a self-hosted GlitchTip.                                                                                                                                                                |

`apps/worker` reads `NODE_ENV`, `DATABASE_URL`, `APP_DATABASE_URL`,
`REDIS_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` and `SENTRY_DSN` from the
same contract.

### Empty string vs unset

Deployment platforms routinely materialize an unset variable as `""` — a
Compose `${VAR:-}` default, a Kubernetes `env:` entry with no `value`, an
emptied field in a hosted platform's variable editor. Every optional variable
above now treats a blank value as _unset_, so `CORS_ORIGINS=""` is "not
configured" (and therefore rejected in production) rather than a
deliberately-empty allow-list.

`APP_DATABASE_URL` needed the same handling in **two** places, and the second
is the one that actually bit:

1. `env.validation.ts` normalizes `""` to `undefined`.
2. `PrismaService` resolves the URL through
   `resolveRuntimeDatabaseUrl` rather than `appUrl ?? dbUrl`, because
   `@nestjs/config`'s `ConfigService.get()` **falls through to raw
   `process.env`** whenever the validated value is `undefined`. Step 1 alone
   therefore did not help: `""` came straight back out of `get()`, `??` did
   not replace it (it only replaces `null`/`undefined`), and Prisma rejected
   the empty datasource URL with
   `PrismaClientInitializationError: Error validating datasource 'db': You
must provide a nonempty URL`, crash-looping the API and worker
   containers.

If you see that Prisma error in a deployment, an empty-but-present
`APP_DATABASE_URL` is the first thing to check — the API's boot log states
which of the two URLs it resolved to.

### The two JWT secrets must be independent

Both are HMAC keys for the same algorithm. Reuse one value for both and a
refresh token becomes a structurally valid access token: `JwtStrategy` would
accept it as a bearer credential, defeating the short access-token lifetime
and the server-side refresh-token revocation. The API refuses to start when
they are equal. Generate them separately:

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
```

### Behind a reverse proxy / load balancer

`Secure` cookies are keyed off `NODE_ENV=production`, so TLS termination at a
proxy is fine. Note that Express is _not_ configured with `trust proxy`, so
`request.ip` — recorded in refresh-token session metadata and used by the
audit log — will be the proxy's address rather than the client's. That is a
fidelity limitation in those records, not a functional one; it does not
affect authentication.

---

## Database, migrations and seed

This project uses **two** connection strings on purpose:

|                    | Used by                                                      | Role                                                                           |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `DATABASE_URL`     | `prisma migrate deploy`, `prisma db seed`, `prisma generate` | owner / migration role — may alter schema                                      |
| `APP_DATABASE_URL` | the running `apps/api` and `apps/worker` (`PrismaService`)   | restricted `crm_app` role — no DDL, no `UPDATE`/`DELETE` on `admin.audit_logs` |

The Prisma CLI reads `schema.prisma`'s own `env("DATABASE_URL")` datasource
directly and never sees `APP_DATABASE_URL`. `PrismaService` prefers
`APP_DATABASE_URL` and falls back to `DATABASE_URL`.

### The trap

**Point the two at different databases and everything looks healthy.**
Migrations succeed, the API boots, `/health` and `/health/ready` both return
200 — while every query runs against a database that was never migrated or
seeded. Login fails with an opaque error and the auth code is entirely
blameless.

Mitigations in place:

- At boot the API logs
  `Runtime database (from APP_DATABASE_URL|DATABASE_URL): <password-redacted URL>`,
  so the connection actually in use is visible in the deployment's logs.
- It logs a **warning** when the two URLs name different _databases_.
  A differing host/port alone is not warned about: routing the runtime role
  through a connection pooler on another host/port is a normal deployment.

### Running migrations

`docs/architecture/11-quality-and-operations.md` requires migrations to run
**explicitly before** API/worker startup in non-local environments, never
implicitly at boot. The API image therefore starts the server and nothing
else. Run migrations as their own step, from the same image:

```bash
docker run --rm \
  -e DATABASE_URL="postgresql://owner:...@db:5432/crm?schema=public" \
  <api-image> pnpm --filter @crm/api migrate:deploy
```

`docker-compose.prod.yml` encodes exactly this ordering: a one-shot
`migrate` service, which `api` and `worker` wait on with
`condition: service_completed_successfully`, so a failed migration stops the
rollout instead of leaving the API serving against a half-migrated schema.

On a platform with a release/pre-deploy hook, that hook's command is
`pnpm --filter @crm/api migrate:deploy` with `DATABASE_URL` set to the owner
role.

### Seeding — deliberate, once, never automatic

`apps/api/prisma/seed.ts` creates the first Organization/Branch/Department,
the permission catalog, the baseline roles, and one bootstrap admin user. On
an empty database it is what makes the **very first login possible at all**.

It is idempotent and safe to re-run, but it also **reconciles role permission
grants to the catalog in the code** — so re-running it against a live
database resets hand-edited grants on the seeded roles. It is therefore _not_
part of any deploy step and there is no seed service in
`docker-compose.prod.yml`. Run it once, deliberately, when bootstrapping a
new environment:

```bash
docker run --rm \
  -e DATABASE_URL="postgresql://owner:...@db:5432/crm?schema=public" \
  -e SEED_ADMIN_EMAIL="admin@your-org.example" \
  -e SEED_ADMIN_PASSWORD="<a real, rotated secret>" \
  <api-image> pnpm --filter @crm/api prisma:seed
```

The seed refuses to run unless both `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` are set — it will not create a default/hard-coded admin
password. Change that password after the first sign-in.

If you use `APP_DATABASE_URL`, also rotate the `crm_app` password the
migration provisions with a fixed dev value:

```sql
ALTER ROLE crm_app WITH PASSWORD '<a real secret>';
```

---

## Deploying with `docker-compose.prod.yml`

```bash
cp .env.production.example .env.production   # then fill every placeholder in
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
```

It defines `migrate`, `api`, `worker`, `web` and `portal`. It deliberately
does **not** define Postgres, Redis or object storage — supply those as
managed services, or run the datastore containers in the sibling
`docker-compose.yml`. Every deployment-specific value comes from the env
file, and Compose refuses to start when a required one is missing rather
than substituting an empty string.

`.env.production` is gitignored. Never commit a filled-in copy.

---

## Post-deploy verification

Run these in order; each one isolates a different layer.

```bash
# 1. The API is up and its dependencies are reachable.
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/health/ready      # checks Postgres + Redis

# 2. The API's boot log states the three settings that fail silently.
#    Expect: "CORS allowed origins: ...", "Refresh cookie: SameSite=...",
#            "Runtime database (from ...): ..." and no database warning.

# 3. CORS accepts the real browser origin, with credentials.
curl -i -X OPTIONS https://api.example.com/api/v1/auth/login \
  -H 'Origin: https://crm.example.com' \
  -H 'Access-Control-Request-Method: POST'

# 4. Login works against the deployed API, and sets the refresh cookie.
curl -i -X POST https://api.example.com/api/v1/auth/login \
  -H 'Origin: https://crm.example.com' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@your-org.example","password":"..."}'
#    Expect 200 with an accessToken, and a `set-cookie: refreshToken=...`
#    carrying HttpOnly, Secure, and the SameSite value you configured.

# 5. The browser bundle really points at the deployed API. In the browser's
#    devtools Network tab, load the login page and confirm the request goes
#    to https://api.example.com/api/v1/auth/login — NOT to localhost:3001.
```

Step 5 is the one that catches a wrong `NEXT_PUBLIC_API_URL`; steps 1–4 all
pass regardless of it, because they never involve the browser bundle.

---

## Supplied by the deployment platform

Nothing in this list can be resolved from inside the repository. Each item
requires a decision or a credential from whoever operates the deployment.

**Infrastructure**

- A PostgreSQL 16 instance with the `vector` and `pg_trgm` extensions
  available (see `apps/api/prisma/schema.prisma`'s `extensions`), and the two
  roles described above.
- A Redis 7 instance — used for both BullMQ and the Socket.IO adapter, so it
  must be shared by every API replica.
- An S3-compatible bucket, plus its endpoint and credentials.

**DNS / TLS**

- Public hostnames for the API, the agent workspace and the portal, with TLS.
  These determine `NEXT_PUBLIC_API_URL`, `CORS_ORIGINS` and whether
  `AUTH_COOKIE_SAMESITE` must be `none`.

**Secrets**

- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (two independent values).
- Database, Redis and S3 credentials.
- The one-time `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
- Optionally `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` and
  `ANTHROPIC_API_KEY`.

**Container registry and rollout**

- A registry to host the four images. CI (`.github/workflows/ci.yml`) builds
  all four on every push to `main` and asserts the frontends' API URL, but
  **does not push** them anywhere and does not deploy: no registry has been
  chosen for this project. Enabling a push is a one-line change to that job
  plus registry credentials — an explicit decision, not something inferable
  from the repository.
- The rollout mechanism itself (Compose on a host, Kubernetes, a PaaS), and
  a pre-deploy hook that runs `pnpm --filter @crm/api migrate:deploy`.

**Still deferred by the architecture**

- Email / SMS / WhatsApp providers for the Communication & Channels domain
  remain an open decision — see
  `docs/architecture/09-integrations.md` and
  `docs/architecture/12-risks-tradeoffs-and-scope.md`. Nothing in this
  document depends on it.
