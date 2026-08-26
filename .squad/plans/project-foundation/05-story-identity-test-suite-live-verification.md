# Story 05 — Identity & Access: Resolve Local Postgres Port Conflict and Verify Live Integration Suite

## Prerequisites

- [Story 04 completed](./04-story-identity-test-suite-and-ci-integration.md): `apps/api/src/modules/identity/identity.service.spec.ts`, `apps/api/src/common/auth/permissions.guard.spec.ts`, `apps/api/test/identity.e2e-spec.ts`, `apps/api/vitest.config.mts`, and the `.github/workflows/ci.yml` service-container job all already exist and are already committed (`1c89571`, `95a693a`). Story 04 explicitly deferred **local** verification of the integration suite because local Docker/WSL2 was unavailable at the time, and relied on CI as the verification of record instead. This story does not re-implement any of Story 04's test files — it only diagnoses and resolves why the deferred local verification still cannot run, and then actually runs it.
- Coordinate with whoever owns this development machine before stopping any Windows service (Implementation Task 1 below) — it is a native service unrelated to this repository and may be in use for other work.

---

## Story Goal

Story 04 shipped the test suite but its own local-verification step was explicitly deferred pending a working Docker/WSL2. WSL2 and Docker now work, `docker-compose.yml`'s `postgres`/`redis` services report healthy, yet `pnpm --filter @crm/api exec prisma migrate deploy` still fails with:

```
Error: P3009
migrate found failed migrations in the target database, new migrations will not be applied.
The `20260825111416_init` migration started at 2026-08-25 10:24:15.014216 UTC failed
```

Root cause, confirmed by direct investigation during planning (not a hypothesis to re-derive):

1. A **native Windows PostgreSQL 18 service** (`postgresql-x64-18`, a `postgres.exe` process bound to `0.0.0.0:5432`) is running on this machine, independent of this repository. It claims port 5432 ahead of Docker Desktop's port-forwarding for the `pgvector/pgvector:pg16` container, so every local Postgres client — including `prisma migrate deploy` — actually connects to that native PostgreSQL 18 instance when it dials `localhost:5432`, never to the Docker container.
2. That native instance's own `crm` database has **no `vector` extension available at all** (`pg_available_extensions` lists only `pg_trgm`, not `vector`) — this is exactly the "vector extension unavailable" failure the intake describes. The one failed migration attempt against it left a permanent row in that native database's `public._prisma_migrations` table (`migration_name: 20260825111416_init`, `finished_at: null`, `applied_steps_count: 0`), which is what `prisma migrate status`/`migrate deploy` keep reporting.
3. The Docker container itself (`customer-support-crm-postgres-1`, confirmed via `docker exec` to be genuinely `PostgreSQL 16.15` on Linux) has **no migration history at all** — no `identity`/`admin` schemas, no `_prisma_migrations` table anywhere, and its data volume (`customer-support-crm_postgres-data`) was created within 4 seconds of the container's own start time. **It is not a reused/stale volume** — the intake's concern about a reused volume does not apply here. Both `vector` and `pg_trgm` install cleanly on this container when created directly (verified with `CREATE EXTENSION IF NOT EXISTS`).
4. Redis has no equivalent conflict: a value written through the host `REDIS_URL` (`redis://localhost:6379`) was confirmed present inside the `customer-support-crm-redis-1` container. Only Postgres is affected.
5. Separately: the tracked `.env.example` (root) and `docker-compose.yml:15` both correctly use `POSTGRES_PASSWORD: crm_dev_password`, but this machine's local, gitignored `apps/api/.env` has `DATABASE_URL` using password `crm` instead. This is a local drift in an untracked file, not a repository bug — but it must be corrected locally or authentication against the real Docker container may fail once traffic actually reaches it.

Because the failed-migration record lives entirely in the native instance — which will no longer be in the connection path once the port conflict is resolved — **no `prisma migrate resolve` command against any database is needed**: once `localhost:5432` genuinely reaches the Docker container, `prisma migrate deploy` runs against a database with zero migration history and applies cleanly.

Concretely, this story:

1. Frees port 5432 for Docker by stopping the conflicting native `postgresql-x64-18` service (or documents why that could not be done, per Edge Cases).
2. Fixes the local `apps/api/.env` `DATABASE_URL` password to match `.env.example`/`docker-compose.yml`.
3. Runs the real migration and seed against the now-reachable Docker Postgres, then runs `pnpm --filter @crm/api test` and `pnpm --filter @crm/api test:e2e` locally, capturing real output as evidence.
4. Separately confirms (or explicitly reports as pending) the existing `.github/workflows/ci.yml` `build-and-test` job, which has never had this local port conflict since GitHub-hosted runners don't have a native Postgres 18 service.

**Not in scope:** any change to `apps/api/src/**`, `prisma/schema.prisma`, `prisma/seed.ts`, `apps/api/test/identity.e2e-spec.ts`, `apps/api/src/modules/identity/identity.service.spec.ts`, `apps/api/src/common/auth/permissions.guard.spec.ts`, or `.github/workflows/ci.yml` — Story 04 already built all of these and they are not the problem. No Prisma schema changes, no new endpoints, no frontend work, no `docker-compose.yml` port remapping (see Edge Cases for why remapping is the fallback, not the default, resolution). If a genuine bug in the existing test suite or `IdentityService` surfaces while actually running it against real infrastructure for the first time, fix only that minimal bug and report it explicitly, exactly per Story 04's own policy — do not use this story as cover for broader changes.

---

## Context — Read These Files First

1. [04-story-identity-test-suite-and-ci-integration.md](./04-story-identity-test-suite-and-ci-integration.md) — the story this one continues; re-read its "Verification Steps" (steps 5–7), which already anticipated exactly this situation ("if Docker/WSL2 has been fixed by implementation time, local verification should be done in addition to CI").
2. `docker-compose.yml:11-27` — the `postgres` service block: `image: pgvector/pgvector:pg16`, `POSTGRES_USER: crm`, `POSTGRES_PASSWORD: crm_dev_password` (line 15), `POSTGRES_DB: crm`, published on `5432:5432`. This is the container that must actually receive local traffic.
3. `.env.example:10-11` (repo root) — the documented `DATABASE_URL="postgresql://crm:crm_dev_password@localhost:5432/crm?schema=public"` and `REDIS_URL="redis://localhost:6379"`. Compare this against the local `apps/api/.env` (gitignored, not read by the planner from git but present on disk) to find the password drift described above.
4. `apps/api/prisma/schema.prisma:1-20` — `datasource db` block: `extensions = [pgvector(map: "vector"), pg_trgm]`, `schemas = ["identity", "admin"]`. Confirms both extensions the migration needs.
5. `apps/api/prisma/migrations/20260825111416_init/migration.sql:1-10` — the migration's first statements (`CREATE SCHEMA IF NOT EXISTS "admin"`, `"identity"`, then `CREATE EXTENSION IF NOT EXISTS "pg_trgm"`/`"vector"`) — this is the exact statement that fails on a Postgres build without `vector` available, and the exact statement that succeeds cleanly on the `pgvector/pgvector:pg16` image.
6. `apps/api/package.json:15-21` — the already-implemented scripts: `"test": "vitest run --exclude \"**/*.e2e-spec.ts\""`, `"test:e2e": "vitest run e2e-spec"`, `"test:all": "vitest run"`, `"prisma:migrate": "prisma migrate dev"`, `"prisma:seed": "prisma db seed"`. Use `pnpm --filter @crm/api exec prisma migrate deploy` for the real deploy-style migration (matching CI), not `prisma:migrate` (which runs `migrate dev`, a different command intended for schema-authoring, not deploy verification).
7. `.github/workflows/ci.yml:28-46,81-91` — the `services:` block (real `postgres`/`redis` containers, no port conflict possible on a GitHub-hosted runner) and the migrate/seed/test steps already wired up. Read this to confirm CI's path is unaffected by anything in this story — it's the reference for what "passing against real infra" looks like once local matches it.
8. `apps/api/test/identity.e2e-spec.ts:1-49` — confirms the integration suite already bootstraps the real `AppModule` and requires `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` to be set; nothing here needs to change, but the executor should recognize these env vars are required for the local run in Implementation Task 3.

---

## Implementation Tasks

### 1 — Free port 5432 for Docker

The machine has a native Windows service, **`postgresql-x64-18`** ("PostgreSQL Server 18"), bound to `0.0.0.0:5432`, unrelated to this repository. Confirm this is still the case (services and port ownership can change), then stop it for this session:

```powershell
Get-Service postgresql-x64-18
Get-NetTCPConnection -LocalPort 5432 -State Listen | Select-Object LocalAddress, OwningProcess
Stop-Service postgresql-x64-18   # requires an elevated PowerShell session
```

**Do not** change the service's `-StartupType` (e.g. to `Disabled`) — that is a persistent, machine-wide change outside this repository's scope. Stopping it for the current session is sufficient to unblock local verification; leave the decision to permanently disable or reconfigure it to whoever owns this machine.

Confirm the fix reaches the intended container — re-run the same probe query from both sides and confirm they now agree (they disagreed before the fix: native reported `PostgreSQL 18.1 on x86_64-windows`; the container reported `PostgreSQL 16.15 ... linux`):

```typescript
// one-off probe, not a committed file — delete after use
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.$queryRawUnsafe("SELECT version()").then(console.log).finally(() => prisma.$disconnect());
```

```bash
pnpm --filter @crm/api exec tsx <path-to-probe-script>.ts   # must now print a PostgreSQL 16.x / linux version string
```

If `postgresql-x64-18` cannot be stopped (no elevated access, or it turns out to be needed for other work on this machine), stop here and follow the fallback in Edge Cases — do not attempt to work around it by deleting the Docker volume or by running `prisma migrate resolve` against whichever database still answers on 5432, since that database has not been confirmed to be the intended one.

### 2 — Fix the local `.env` password drift

`File: apps/api/.env` (gitignored, local-only — not part of this story's diff, but must be corrected on this machine for verification to succeed). Update `DATABASE_URL`'s password segment from `crm` to `crm_dev_password` so it matches `docker-compose.yml:15` and the tracked `.env.example:10`:

```
DATABASE_URL="postgresql://crm:crm_dev_password@localhost:5432/crm?schema=public"
```

Leave every other value in `apps/api/.env` unchanged.

### 3 — Apply the real migration, seed, and run both suites locally

With port 5432 now reaching the Docker container and the password corrected:

```bash
pnpm --filter @crm/api exec prisma migrate deploy
pnpm --filter @crm/api prisma:seed
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
```

The migration is expected to apply cleanly in one step — the Docker container has no migration history, so there is nothing to resolve first. If `prisma migrate deploy` reports `P3009` again after Task 1, that means port 5432 is still not reaching the Docker container (re-verify Task 1's probe before doing anything else); it does **not** mean `prisma migrate resolve` should be run.

Capture the full terminal output of the `test:e2e` run — it is this story's primary evidence.

### 4 — Confirm CI is still green

CI has never had this local port conflict. Confirm its current state rather than assuming it (Story 04's commits already pushed the workflow changes):

```bash
gh run list --workflow=ci.yml --limit 5
gh run view <run-id>   # for the most recent run on the current branch/main
```

If `gh` cannot reach the remote from this environment, report CI verification as explicitly pending rather than assuming it passed — per the intake's own instruction.

---

## Edge Cases & Failure Modes

- **`postgresql-x64-18` cannot be stopped** (no admin rights in this session, or it is confirmed needed for other work): do not remap `docker-compose.yml`'s Postgres port as a first resort — that changes a file every other story and `docs/architecture/` reference by convention (5432), and would make local ports diverge from what every doc describes. If stopping the service is genuinely impossible, the fallback is to remap only for a throwaway local verification: temporarily change `docker-compose.yml`'s postgres `ports:` to e.g. `"5433:5432"`, temporarily point a local-only `DATABASE_URL` at `localhost:5433`, run Task 3 against that, then revert `docker-compose.yml` before finishing — do not leave a permanent port remap in a committed file. Report in this case that local verification used a temporary port workaround, and that CI (Task 4) remains the verification of record for the default `5432` configuration.
- **The native instance's failed-migration row reappears in some other diagnostic** (e.g. someone runs `prisma migrate status` again while `postgresql-x64-18` is running): this is expected and does not indicate the fix failed — it means the probe/command reached the native instance again, not the Docker container. Always re-run the version probe from Task 1 first to confirm which database is actually being reached before interpreting any Prisma error.
- **`apps/api/.env`'s password drift recurs** (e.g. a teammate regenerates it from an older template): `docker-compose.yml:15` is the source of truth for the local Postgres password; `.env.example:10` (root) mirrors it. If authentication fails with a password error (as opposed to `P3009`), recheck this first.
- **Redis need not be touched**: confirmed working correctly through Docker already (Story Goal, point 4) — do not spend time investigating Redis if only Postgres-related commands fail.
- **A genuine `IdentityService`/`PermissionsGuard`/route bug surfaces** when the integration suite runs against real infrastructure for the first time (nothing has ever exercised this path before): fix only that specific, minimal bug in `apps/api/src/modules/identity/identity.service.ts` or the relevant guard, and report exactly what was wrong and why — do not expand scope beyond the one bug found, per Story 04's own non-goals.
- **CI cannot be observed from this environment** (no `gh` network access, no push access): report CI verification explicitly as pending, not as passing — per the intake's explicit instruction not to claim full verification without real evidence.

---

## Test Plan

No new test files are added by this story — Story 04 already created the full suite. This story's "test plan" is running the existing suite for real and capturing evidence:

1. **Unit tests (no infra dependency):** `pnpm --filter @crm/api test` — re-run to reconfirm no regression; this already passes today since it mocks all collaborators (`apps/api/src/modules/identity/identity.service.spec.ts`, `apps/api/src/common/auth/permissions.guard.spec.ts`).
2. **Integration tests (real infra, the actual new evidence this story produces):** `pnpm --filter @crm/api test:e2e` — `apps/api/test/identity.e2e-spec.ts`, run against the Docker `pgvector/pgvector:pg16` + `redis:7` containers for the first time ever from this machine. Capture full pass/fail output.
3. **Regression, unrelated apps:** `pnpm --filter @crm/api {typecheck,lint,build}` then workspace-wide `pnpm {typecheck,lint,build}` — confirm no drift since Story 04's commits.

---

## Verification Steps

1. **Confirm the port conflict is real and current:** `Get-NetTCPConnection -LocalPort 5432 -State Listen` and compare `SELECT version()` reached via `localhost:5432` (host-side Prisma/psql client) against `docker exec customer-support-crm-postgres-1 psql -U crm -d crm -c "SELECT version();"` — they must disagree before the fix and agree after it.
2. **Backend builds:** `pnpm --filter @crm/api {typecheck,lint,build}` in the repository root.
3. **Workspace builds:** `pnpm {typecheck,lint,build}` in the repository root.
4. **Unit tests:** `pnpm --filter @crm/api test` in the repository root — must pass.
5. **Live migration + seed + integration suite:** after Implementation Tasks 1–2, run `pnpm --filter @crm/api exec prisma migrate deploy`, `pnpm --filter @crm/api prisma:seed`, then `pnpm --filter @crm/api test:e2e` — all three must succeed, with the full `test:e2e` output captured as this story's evidence.
6. **CI regression:** `gh run list --workflow=ci.yml --limit 5` and `gh run view <run-id>` for the latest run — report its actual result; if unreachable from this environment, report that explicitly.

## Done Criteria

- [ ] The port-5432 conflict with the native `postgresql-x64-18` service is confirmed and either resolved (service stopped) or explicitly documented as blocked, with the temporary-remap fallback used and reverted if so.
- [ ] `apps/api/.env`'s `DATABASE_URL` password matches `docker-compose.yml`/`.env.example`.
- [ ] `prisma migrate deploy` applies `20260825111416_init` successfully against the actual `pgvector/pgvector:pg16` Docker container — with no `prisma migrate resolve` command run against any database.
- [ ] `prisma/seed.ts` runs successfully against that same database.
- [ ] `pnpm --filter @crm/api test` and `pnpm --filter @crm/api test:e2e` both pass locally, with real captured output as evidence — not assumed.
- [ ] CI's `build-and-test` job result is reported (pass, fail, or explicitly "could not be observed from this environment") — never assumed.
- [ ] No changes to `apps/api/src/**`, `prisma/schema.prisma`, `prisma/seed.ts`, or `.github/workflows/ci.yml`, unless a genuine bug was found and fixed, in which case it is called out explicitly in the report.
- [ ] Full existing lint/typecheck/build suite still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
