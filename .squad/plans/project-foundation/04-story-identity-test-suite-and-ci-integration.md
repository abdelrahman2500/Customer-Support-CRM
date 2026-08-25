# Story 04 — Identity & Access: Automated Test Suite and CI-Verified Database Integration

## Prerequisites

- [Story 02 completed](./02-story-monorepo-scaffolding.md): NestJS/Prisma/Vitest/Supertest tooling choices, `identity` schema, JWT auth pipeline.
- [Story 03 completed](./03-story-identity-seed-and-user-management.md): the seed script and `IdentityService.{createUser,listUsers,updateUser,listRoles,listPermissions}` / `UsersController` this story tests. **Do not modify their behavior** — write tests against what exists; fix only a genuine bug if one is found, and report it rather than silently expanding scope.

---

## Story Goal

Give the Identity & Access surface built in Stories 02–03 a real automated test suite, and make the deferred "live database" verification from both of those stories actually happen — not on this development machine (Docker Desktop's engine remains blocked by a broken WSL2 install), but in CI, via GitHub Actions' native Postgres/Redis service containers, which don't depend on the local machine's Docker/WSL2 at all.

Concretely:

1. Unit tests for `IdentityService`'s business logic and `PermissionsGuard`, with no database dependency (mocked `PrismaService`).
2. Integration tests (Supertest, a real bootstrapped Nest app) covering the `auth/*` and `identity/*` HTTP surface, run against a real Postgres + Redis.
3. `.github/workflows/ci.yml` extended with real Postgres/Redis service containers, a real `prisma migrate deploy`, and a real run of `prisma/seed.ts`, so the integration suite in (2) has something real to run against on every PR/push.

No CRM feature, no schema change, no new production endpoint, no frontend work.

---

## Context — Read These Files First

1. [docs/architecture/11-quality-and-operations.md](../../../docs/architecture/11-quality-and-operations.md) — "Testing strategy": Vitest for unit, Vitest+Supertest for API integration tests "against a real Postgres instance... one suite per module", Playwright reserved for a small number of E2E flows (out of scope here). This story is what that document calls for, for the Identity & Access module specifically.
2. `apps/api/src/modules/identity/identity.service.ts` — the exact methods to unit-test: `login`, `refresh`, `revoke`, `getAuthenticatedUser`, `createUser`, `listUsers`, `updateUser`, `listRoles`, `listPermissions`, plus the private `issueAccessToken`/`createRefreshTokenRecord`/`hashRefreshToken` helpers (tested indirectly through the public methods).
3. `apps/api/src/modules/identity/users.controller.ts` and `identity.controller.ts` — the exact routes the integration suite must hit: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /identity/users`, `GET /identity/users`, `PATCH /identity/users/:id`, `GET /identity/roles`, `GET /identity/permissions`.
4. `apps/api/src/common/auth/{auth.guard,permissions.guard,jwt.strategy,require-permissions.decorator,public.decorator}.ts` — what the integration tests are implicitly proving (401 without a token, 403 without the right permission) and what the unit test for `PermissionsGuard` mocks (`Reflector`, `PrismaService`).
5. `apps/api/prisma/seed.ts` — the CI workflow must run this for real; know what it creates (`SuperAdmin`/`Agent` roles, one bootstrap admin) so integration tests can log in as that seeded admin rather than inventing their own bootstrap.
6. `apps/api/src/app.module.ts` — global providers (`AuthGuard`, `PermissionsGuard`, `ThrottlerGuard`, `AuditInterceptor`) and the `TenantMiddleware` — the integration test app must bootstrap the _real_ `AppModule`, not a stripped-down test module, so these are exercised too.
7. `apps/api/.env` / `.env.example` — the env vars the test app/CI need (`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_TTL_DAYS`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`).
8. `.github/workflows/ci.yml` (current) — the exact job/steps this story extends: currently `prisma:generate` runs against dummy env vars with no real database at all; this story adds real `services:`, a real migrate+seed step, and points the existing `Test` step at real infrastructure.
9. `apps/api/package.json` — confirm `@nestjs/testing`, `supertest`, `@types/supertest` are already present (Story 02) before adding anything new.

---

## Product rules (from story)

- **Current:** Zero test files exist. CI never touches a real database.
- **New:** `IdentityService`/`PermissionsGuard` have unit tests; `auth/*` and `identity/*` routes have integration tests against a real database; CI provisions that real database (and Redis) via service containers and runs a real migration + seed before the suite.

---

## Implementation Tasks

### 1 — Vitest configuration for `apps/api`

Create file: `apps/api/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
    environment: "node",
    globals: false,
    testTimeout: 15_000, // integration tests hit a real DB
    hookTimeout: 15_000,
  },
});
```

Update `apps/api/package.json`'s `test` script to split unit vs. integration (integration needs a real database; unit does not):

```json
{
  "scripts": {
    "test": "vitest run --exclude '**/*.e2e-spec.ts'",
    "test:e2e": "vitest run test/**/*.e2e-spec.ts",
    "test:all": "vitest run"
  }
}
```

(Merge into the existing `scripts` object — keep every existing script.) Root `pnpm test` (Turborepo) continues to call each package's own `test` script — unit tests only, so `apps/web`/`apps/portal`/`apps/worker`'s existing `--passWithNoTests` behavior for `test` is untouched. `test:e2e` is invoked explicitly by CI (task 4) and by anyone with local infrastructure up.

### 2 — Unit tests

Create file: `apps/api/src/modules/identity/identity.service.spec.ts`

Structure: build an `IdentityService` instance directly with hand-constructed mock collaborators (no `Test.createTestingModule` needed for pure unit tests — simpler and faster):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IdentityService } from "./identity.service";
// ... mock PrismaService (vi.fn() per model method used: user.findUnique,
// user.findMany, user.create, user.update, refreshToken.findUnique/create/
// update/updateMany, role.findMany, permission.findMany, $transaction),
// JwtService (signAsync), ConfigService (get), and TenantContext
// (requireBranchScope / branchId getter) as plain objects with vi.fn().
```

Cover (one `describe` block per method, matching the acceptance criteria):

- `login`: success issues a token pair; unknown email throws `UnauthorizedException`; inactive user throws; wrong password throws (mock `bcrypt.compare` — since `identity.service.ts` imports `bcryptjs` directly, use `vi.mock("bcryptjs", ...)` at the top of the file).
- `refresh`: valid token rotates (old row revoked with `replacedBy` set, new pair returned); expired/revoked/unknown token throws `UnauthorizedException`.
- `revoke`: no-ops silently when the token doesn't exist; updates when it does.
- `createUser`: success path creates `User` + `UserBranchRole` inside `$transaction`; duplicate email throws `ConflictException` (assert `$transaction`/`user.create` were never called in that case).
- `listUsers`: calls `tenantContext.requireBranchScope()` and scopes the Prisma query by the returned `branchId`; throws when `TenantContext` has no active branch (mirror `requireBranchScope`'s own error).
- `updateUser`: throws `NotFoundException` for an unknown id; only includes the fields present in the DTO in the `data` passed to `prisma.user.update`.
- `listRoles`/`listPermissions`: map the mocked Prisma result to the documented shape.

Create file: `apps/api/src/common/auth/permissions.guard.spec.ts`

Cover: no `@RequirePermissions` metadata → `canActivate` resolves `true` without touching Prisma; metadata present and `request.user` missing → resolves `false`; metadata present and the mocked `prisma.permission.findMany` returns all required keys → `true`; missing one required key → throws `ForbiddenException`.

### 3 — Integration tests

Create file: `apps/api/test/identity.e2e-spec.ts`

Bootstrap the **real** `AppModule` (not a trimmed test module) via `@nestjs/testing`'s `Test.createTestingModule({ imports: [AppModule] })`, `compile()`, then `app.init()` — apply the same global pipes/prefix as `main.ts` (`ValidationPipe`, `setGlobalPrefix("api/v1", {...})`, `cookieParser()`) so the test hits the app exactly as it runs in production. Requires a real `DATABASE_URL`/`REDIS_URL` pointed at Postgres/Redis (local docker-compose or the CI service containers from Task 4) and the seed script already having been run against that database (the seeded `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are what the test logs in as — do not create a second bootstrap mechanism inside the test).

Cover, using `supertest(app.getHttpServer())`:

1. `POST /api/v1/auth/login` with the seeded admin's credentials → `200`, `{ accessToken }`, and a `Set-Cookie` for the refresh token.
2. `POST /api/v1/auth/login` with a wrong password → `401`.
3. `GET /api/v1/auth/me` with the access token from (1) → `200`, matches the seeded admin's email.
4. `GET /api/v1/identity/users` with **no** `Authorization` header → `401`.
5. `POST /api/v1/identity/users` as the seeded admin (who holds `SuperAdmin`, granted `user:create`) → `201`.
6. The same `POST /api/v1/identity/users` call repeated with an **`Agent`**-role token (seeded, zero permissions — log in as one, or construct one via the same login flow if the seed creates an Agent user; if it doesn't yet, note this as a finding rather than silently adding an Agent user to the seed script) → `403`.
7. `GET /api/v1/identity/roles` and `GET /api/v1/identity/permissions` as the admin → `200`, containing `SuperAdmin`/`Agent` and the five permission keys seeded in Story 03.
8. `PATCH /api/v1/identity/users/:id` (the user created in step 5) setting `isActive: false` → `200`; a subsequent login attempt as that user → `401`.

**If step 6 reveals the seed script has no way to obtain an `Agent`-role token** (Story 03's seed creates only the bootstrap `SuperAdmin`), do not modify `seed.ts`'s public behavior to add one — instead create the second user via `POST /api/v1/identity/users` within the test itself (assign it the `Agent` role by looking up the role id via `GET /api/v1/identity/roles` first), keeping the test self-contained.

### 4 — CI: real Postgres/Redis service containers

`File: .github/workflows/ci.yml` — add `services:` to the `build-and-test` job:

```yaml
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: crm
          POSTGRES_PASSWORD: crm
          POSTGRES_DB: crm
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U crm -d crm"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
      redis:
        image: redis:7
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
```

Update the job's `env:` block — these were dummy placeholders before; they now need to be **real, working** credentials matching the `postgres`/`redis` services above, plus the seed admin credentials:

```yaml
env:
  DATABASE_URL: "postgresql://crm:crm@localhost:5432/crm?schema=public"
  REDIS_URL: "redis://localhost:6379"
  JWT_ACCESS_SECRET: "ci-only-access-secret-not-a-real-secret-32chars"
  JWT_REFRESH_SECRET: "ci-only-refresh-secret-not-a-real-secret-32chars"
  JWT_REFRESH_TTL_DAYS: "7"
  SEED_ADMIN_EMAIL: "ci-admin@example.com"
  SEED_ADMIN_PASSWORD: "ci-only-admin-password-not-a-real-secret-32ch"
```

Add steps, after "Generate Prisma client" and before "Test":

```yaml
- name: Run database migrations
  run: pnpm --filter @crm/api prisma migrate deploy

- name: Seed database
  run: pnpm --filter @crm/api prisma:seed
```

Change the final "Test" step to run both unit and integration tests now that real infrastructure exists in this job:

```yaml
- name: Test
  run: pnpm test

- name: Integration tests
  run: pnpm --filter @crm/api test:e2e
```

Leave the `docker-images` job untouched.

---

## Files expected to change

- `apps/api/vitest.config.ts` (new)
- `apps/api/src/modules/identity/identity.service.spec.ts` (new)
- `apps/api/src/common/auth/permissions.guard.spec.ts` (new)
- `apps/api/test/identity.e2e-spec.ts` (new)
- `apps/api/package.json` (`test`/`test:e2e`/`test:all` scripts)
- `.github/workflows/ci.yml` (service containers, migrate+seed steps, integration-test step)

No other app/package should need changes. If one does, stop and report why before proceeding (per the plan's own non-goals).

---

## Non-Goals

- No new Prisma models, schema changes, or migrations beyond what Stories 02–03 already created.
- No new production (non-test) endpoints or behavior changes to `IdentityService`/`UsersController`/`IdentityController` beyond a genuine, reported bug fix if one is found while testing.
- No frontend or `apps/web`/`apps/portal`/`apps/worker` test coverage.
- No Playwright/E2E browser tests.
- No observability/tracing work (pino, OpenTelemetry, `/metrics`) — still deferred per docs/architecture/11-quality-and-operations.md.
- No branch/department/role/permission CRUD — still deferred per Story 03.
- No attempt to fix the local machine's WSL2/Docker installation.

---

## Verification Steps

1. **Install:** `pnpm install` (no new dependencies expected — `@nestjs/testing`/`supertest` already present).
2. **Typecheck/lint/build:** `pnpm --filter @crm/api {typecheck,lint,build}`, then workspace-wide `pnpm {typecheck,lint,build}` — confirm zero regressions in `apps/web`/`apps/portal`/`apps/worker`/`packages/*`.
3. **Unit tests (no infra required):** `pnpm --filter @crm/api test` — must actually execute the new `*.spec.ts` files (not `--passWithNoTests`) and pass.
4. **Regression:** re-run the no-database boot smoke test (`node dist/main.js`) exactly as Stories 02–03 did, confirming all existing routes still register.
5. **Integration tests — local, if Docker/WSL2 has been fixed by implementation time:** `docker compose up -d postgres redis`, `pnpm --filter @crm/api prisma:migrate`, `pnpm --filter @crm/api prisma:seed`, `pnpm --filter @crm/api test:e2e`.
6. **Integration tests — CI (the verification of record while local Docker/WSL2 remains broken):** push the implementation branch / open a PR so `.github/workflows/ci.yml` runs with real Postgres/Redis service containers; use `gh run list` / `gh run view` (or the PR's checks tab) to confirm the `build-and-test` job — including the new migrate/seed/integration-test steps — passes. Report the run URL/result.
7. **If neither 5 nor 6 can be completed** (e.g. no `gh` push access in the implementing session), document that explicitly as deferred, exactly as Stories 02–03 did for their own live-infra gaps — do not report the story as fully verified without one of the two.

## Done Criteria

- [ ] `apps/api` has real unit tests for `IdentityService` and `PermissionsGuard`, and `pnpm --filter @crm/api test` runs and passes them.
- [ ] `apps/api` has a real integration test suite (`test:e2e`) covering the scenarios listed in Implementation Task 3.
- [ ] `.github/workflows/ci.yml` provisions Postgres + Redis, runs a real migration and the real seed script, and runs the integration suite against them.
- [ ] At least one of: a local `test:e2e` run against real infra, or a CI run observed via `gh`, actually passed — reported with evidence (output or run URL), not assumed.
- [ ] No Prisma schema changes; no new production endpoints; no frontend changes.
- [ ] Full existing lint/typecheck/build suite still passes with no regressions in Stories 01–03's deliverables.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
