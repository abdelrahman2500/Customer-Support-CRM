> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/audit-log-read-endpoint/audit-log-read-endpoint/intake.md`

---

## Feature

- **Feature name (display):** Backend Foundation — Audit Log Read Endpoint
- **Feature slug:** `audit-log-read-endpoint`

## Title

```text
Backend Foundation: Audit Log Read Endpoint
```

## Description

```text
AuditLog has been written by the globally-registered AuditInterceptor since Story 02 for every mutating request, but nothing has ever read it back — there is no admin module, no controller, no way for anyone to see the audit trail.

This story adds a new AdminModule with GET /audit-logs, read-only, scoped directly by AuditLog.branchId (unlike the notification endpoint, no relation workaround is needed here: every authenticated mutating request's row already carries the real acting branch). A new "audit:read" permission is added to the existing catalog. AuditInterceptor itself is not modified.
```

## Acceptance criteria

```text
- GET /audit-logs returns every AuditLog row for the caller's branch, ordered newest-first, requiring the new "audit:read" permission.
- Unauthenticated → 401; Agent-role (no permission) → 403.
- A real mutating request (e.g. POST /customers) made during the test produces a real, retrievable row — proving the already-existing AuditInterceptor and the new read path connect correctly.
- No new Prisma model, migration, or change to AuditInterceptor's writing behavior. No mutation endpoint. No frontend UI.
- apps/web, apps/portal, schema.prisma/migrations, and every unrelated backend module are untouched.
- Unit tests (audit-logs.service.spec.ts) and a new e2e spec cover empty/populated/scoping/ordering/permission cases.
```

## Dependencies

- **Blocked by:** `project-foundation` Story 02 (`AuditLog` model, `AuditInterceptor`).
- **Depends on code areas:** new `apps/api/src/modules/admin/**`, one new import line in `app.module.ts`, `apps/api/prisma/seed.ts` (new permission key only).

## Extra notes

- Part of the approved 35/36/37 backend-foundation batch — owns a brand-new `admin` module exclusively; zero file overlap with Stories 35/36 beyond the one shared `app.module.ts` import line (additive, non-conflicting) and the shared `seed.ts` permission-catalog array (also additive).

## Out of scope

- Semantic before/after diffs (AuditLog.diff remains unpopulated — a separate, larger story per AuditInterceptor's own doc comment), audit-log mutation/deletion (never possible — append-only by design), a frontend Audit Log Viewer (future, separate story).
