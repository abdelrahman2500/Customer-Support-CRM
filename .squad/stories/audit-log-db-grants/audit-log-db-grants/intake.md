> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/audit-log-db-grants/audit-log-db-grants/intake.md`

---

## Feature

- **Feature name (display):** Administration — Runtime DB role hardening (audit-log append-only + schema-alter denial)
- **Feature slug (folder under `plans/`):** `audit-log-db-grants`

## Title

```text
Story 115 — Administration: Runtime DB role hardening
```

## Description

```text
docs/architecture/05-auth-and-security.md documents two DB-level
guarantees that have never been implemented, since Story 02:
"admin.audit_logs is append-only, with application DB roles denied
UPDATE and DELETE" and "The runtime DB role cannot alter schema; a
separate migration role is used only by CI/deploy." Today exactly one
Postgres role (crm) is used for schema DDL, all application CRUD, and
the audit-log writes -- confirmed via docker-compose.yml, ci.yml, both
apps' env.validation.ts, and every migration file. This story adds a
new, restricted runtime role (crm_app) via a single idempotent
migration, grants it CRUD on every table across all 9 schemas (with
ALTER DEFAULT PRIVILEGES covering future tables automatically), revokes
UPDATE/DELETE specifically on admin.audit_logs, wires an optional
APP_DATABASE_URL into both apps' PrismaService (falls back to the
existing DATABASE_URL, so no existing environment breaks), and updates
.env.example/CI to use the restricted role by default going forward.
```

## Acceptance criteria

```text
- [ ] New crm_app role, created idempotently by a single migration;
      owns no tables.
- [ ] crm_app has SELECT/INSERT/UPDATE/DELETE on every existing table
      across all 9 schemas, and on every future table via ALTER DEFAULT
      PRIVILEGES.
- [ ] crm_app denied UPDATE/DELETE on admin.audit_logs specifically;
      SELECT/INSERT remain granted.
- [ ] crm_app cannot CREATE/ALTER/DROP any table.
- [ ] APP_DATABASE_URL (optional, falls back to DATABASE_URL) wired into
      both apps' PrismaService; existing environments unaffected unless
      they opt in.
- [ ] .env.example/CI updated to use the restricted role by default.
- [ ] New e2e spec proves both guarantees directly against Postgres.
- [ ] Full existing apps/api e2e suite passes with the app actually
      running under crm_app.
- [ ] AuditLog's schema comment updated to reflect the closed gap.
```

## Dependencies

- Story 02 — monorepo scaffolding (the original, never-enforced
  `AuditLog` doc/schema comment this closes).
- Story 84 — identity-audit-logging (the application-level half of
  audit logging; this story closes the DB-level half it explicitly
  scoped out).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Per-table/per-schema fine-grained permission model beyond
  admin.audit_logs's append-only case.
- Postgres row-level security (RLS).
- Credential-rotation tooling/automation.
- Any change to how prisma migrate deploy/prisma db seed authenticate.
- A docker-entrypoint-initdb.d init script (a migration is used
  instead — see the plan doc's Design section for why).
