# Story 115 — Administration: Runtime DB role hardening

## Goal

Make `docs/architecture/05-auth-and-security.md`'s two DB-level
guarantees literally true, closing a gap that has existed, undetected,
since Story 02:

> - `admin.audit_logs` is append-only, with application DB roles denied
>   `UPDATE` and `DELETE`.
> - The runtime DB role cannot alter schema; a separate migration role is
>   used only by CI/deploy.

Today exactly one Postgres role (`crm`) is used for schema DDL, all
application CRUD, and the audit-log writes.

## Non-goals

- No per-table/per-schema fine-grained permission model beyond the one
  documented special case (`admin.audit_logs`'s append-only guarantee).
  Every other table gets the same SELECT/INSERT/UPDATE/DELETE grant —
  finer-grained table-level policy is out of scope unless a future
  architecture decision names another table that needs it.
- No Postgres row-level security (RLS). Branch/tenant isolation stays an
  application-level concern (`TenantMiddleware`/service-layer scoping),
  unchanged — this story is purely about which DB-level operations a
  role can perform on a table, not which rows within it.
- No credential-rotation tooling/automation. The new role's dev/CI
  password is a fixed, documented, non-secret value exactly like this
  repository's existing `crm`/`crm_dev_password` precedent
  (`docker-compose.yml`/`.env.example`); a real production deployment is
  expected to `ALTER ROLE crm_app WITH PASSWORD <real secret>` before
  going live, exactly like production is already expected to replace the
  placeholder `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` values.
- No change to how `prisma migrate deploy`/`prisma db seed` authenticate
  — both keep using `DATABASE_URL` (the owner/migration role), unchanged.
- No `docker-entrypoint-initdb.d` init script — see the Design section
  for why a migration is used instead.

## Design

### One new role, shared by both apps

A single new Postgres role, `crm_app`, `LOGIN`, `NOSUPERUSER
NOCREATEDB NOCREATEROLE NOREPLICATION` — used by both `apps/api` and
`apps/worker` at runtime. `docs/architecture/05-auth-and-security.md`
describes one "runtime DB role," singular; both apps already share the
same generated Prisma client and the same set of Postgres schemas
(`identity`, `admin`, `customers`, `ticketing`, `sla`, `notifications`,
`knowledge_base`, `ai`, `channels`), so a single shared role is the
correct match for the existing architecture, not a role per app.

### Grants — one idempotent Prisma migration (raw SQL)

A single new migration (`prisma migrate dev --create-only`, hand-written
SQL body — no corresponding `schema.prisma` model change, so the
auto-generated diff is empty):

1. `DO $$ ... CREATE ROLE crm_app LOGIN PASSWORD '<dev/CI-only password>'
   NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; EXCEPTION WHEN
   duplicate_object THEN NULL; END $$;` — idempotent (safe to re-run
   against a database where the role already exists, e.g. because
   `prisma migrate deploy` retries).
2. For each of the 9 schemas: `GRANT USAGE ON SCHEMA "<schema>" TO
   crm_app;` and `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN
   SCHEMA "<schema>" TO crm_app;` — covers every existing table.
3. For each of the 9 schemas: `ALTER DEFAULT PRIVILEGES FOR ROLE crm IN
   SCHEMA "<schema>" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO
   crm_app;` — every *future* table any later migration adds (migrations
   always run as `crm`, the owner role) is automatically covered too,
   with no need to touch this migration again.
4. `REVOKE UPDATE, DELETE ON admin.audit_logs FROM crm_app;` — the one
   documented special case. `crm_app` keeps `SELECT, INSERT` on this
   table (the app still needs to read and write new audit entries; it
   must never modify or remove an existing one).
5. No `GRANT CREATE`/table-ownership transfer anywhere — `crm_app` never
   owns any table (all tables stay owned by `crm`, the role that ran
   every migration), which is what actually makes "the runtime DB role
   cannot alter schema" true: only an object's owner (or a superuser)
   can `ALTER`/`DROP` it in Postgres, and `crm_app` is neither.

No sequences/views/custom functions exist anywhere in the schema today
(confirmed: no `autoincrement()` field, no `CREATE VIEW`/`CREATE
FUNCTION` in any migration) — table grants are the entire surface.

Why a migration, not a `docker-entrypoint-initdb.d` init script: an init
script only runs on a Postgres container's first-ever startup against an
empty data volume. It would silently no-op against this repository's own
already-provisioned local dev volume (and any already-running real
deployment) — leaving the guarantee unenforced exactly where it matters
most. A migration applies uniformly everywhere `prisma migrate deploy`
already runs.

### Config wiring — `APP_DATABASE_URL`, optional, falls back to `DATABASE_URL`

- `apps/api/src/common/config/env.validation.ts` and
  `apps/worker/src/env.validation.ts` each gain `APP_DATABASE_URL:
  z.string().optional()`.
- `apps/api/src/prisma/prisma.service.ts` and
  `apps/worker/src/prisma/prisma.service.ts`: inject `ConfigService` in
  the constructor and pass `super({ datasources: { db: { url:
  configService.get("APP_DATABASE_URL", { infer: true }) ??
  configService.get("DATABASE_URL", { infer: true }) } } })` — the one
  place either app's actual runtime Postgres connection is established.
  `DATABASE_URL` alone (no `APP_DATABASE_URL` set) reproduces today's
  exact behavior — full backward compatibility for any environment that
  hasn't opted in yet.
- `.env.example` and `.github/workflows/ci.yml` are updated to set
  `APP_DATABASE_URL` to the new `crm_app` connection string by default —
  the committed reference configuration becomes secure-by-default, while
  `DATABASE_URL` keeps pointing at the owner role for
  `prisma:generate`/`migrate deploy`/`prisma:seed`.
- The Prisma CLI itself (`migrate deploy`, `db seed`, `generate`) is
  unaffected: it reads the datasource URL from `schema.prisma`'s own
  `env("DATABASE_URL")` directly, never through `PrismaService`.

### Verification the guarantee actually holds

A new e2e spec (`apps/api/test/audit-log-db-grants.e2e-spec.ts`) opens
its own direct `pg` connection as `crm_app` (independent of whatever
`APP_DATABASE_URL` the rest of the suite happens to be configured with)
and asserts, against the real database:
- `INSERT`/`SELECT` on `admin.audit_logs` succeed.
- `UPDATE`/`DELETE` on `admin.audit_logs` fail with a Postgres
  permission-denied error.
- A representative ordinary table (e.g. `identity.users`) allows
  `SELECT`/`INSERT`/`UPDATE`/`DELETE` — proving the story didn't
  accidentally over-restrict a normal table.
- `CREATE TABLE`/`ALTER TABLE` under `crm_app` fails with a
  permission-denied error — proving "cannot alter schema."

Additionally: the full existing `apps/api` e2e suite is run once with
`APP_DATABASE_URL` actually pointed at `crm_app` (not just the new
dedicated spec) to prove no legitimate, existing application code path
was accidentally under-granted.

### Doc/schema comment updates

- `apps/api/prisma/schema.prisma`'s `AuditLog` model comment is updated
  to state the grant is enforced by this migration (naming it), removing
  the now-stale "tracked as a follow-up" language.

## Acceptance criteria

- [x] New `crm_app` Postgres role, created idempotently by a single
      migration; owns no tables.
- [x] `crm_app` has SELECT/INSERT/UPDATE/DELETE on every existing table
      across all 9 schemas, and (via `ALTER DEFAULT PRIVILEGES`) on every
      table any future migration adds.
- [x] `crm_app` is denied `UPDATE`/`DELETE` on `admin.audit_logs`
      specifically; `SELECT`/`INSERT` remain granted.
- [x] `crm_app` cannot `CREATE`/`ALTER`/`DROP` any table (no ownership,
      no schema-`CREATE` grant).
- [x] `APP_DATABASE_URL` (optional, falls back to `DATABASE_URL`) wired
      into both apps' `PrismaService`; existing environments unaffected
      unless they opt in.
- [x] `.env.example`/CI updated to use the restricted role by default
      going forward.
- [x] New e2e spec proves both the append-only guarantee and the
      cannot-alter-schema guarantee directly against Postgres.
- [x] Full existing `apps/api` e2e suite passes with the real app
      actually running under `crm_app` — no legitimate operation broken.
- [x] `AuditLog`'s schema comment updated to reflect the closed gap.

## Verification plan

```
cd apps/api && npx prisma migrate dev --create-only --name add_runtime_db_role_grants   # generate skeleton, then hand-write SQL
cd apps/api && npx prisma migrate deploy   # apply
npx vitest run test/audit-log-db-grants.e2e-spec.ts --no-file-parallelism   # from apps/api, .env sourced, new dedicated spec
# Full sweep with the app actually running under crm_app:
APP_DATABASE_URL="postgresql://crm_app:<dev-password>@localhost:5433/crm?schema=public" \
  npx vitest run e2e-spec --no-file-parallelism   # from apps/api
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
