# Story 37 — Backend Foundation: Audit Log Read Endpoint

## Prerequisites

- `project-foundation` Story 02: `AuditLog` model, `AuditInterceptor` (global, unmodified by this story).

## Story Goal

Give the `admin` schema its first HTTP surface: a read-only `GET /audit-logs`, in a brand-new `AdminModule`.

## Context — Read These Files First

1. `apps/api/src/common/audit/audit.interceptor.ts` — confirms exactly which fields it writes (`actorId`, `action`, `entityType`, `branchId`, `ipAddress`) and that a `branchId` of `null` only ever means a pre-auth/public action (login), correctly excluded from any specific branch's trail.
2. `apps/api/src/modules/customers/customers.module.ts` — the "provide `TenantContext` directly in this module's own providers" convention this new module follows.
3. `apps/api/src/app.module.ts` — confirms `NotificationsModule`/`IdentityModule` etc. registration pattern; this story adds one new import line for `AdminModule`.

## Design (resolved during this planning pass)

1. **Scope directly by `AuditLog.branchId`** — no relation workaround needed (unlike Story 36): every authenticated mutating request's row already carries the real acting branch.
2. **New, brand-new `AdminModule`** (`apps/api/src/modules/admin/`) — no existing module owns the `admin` schema yet.
3. **New `audit:read` permission**, own value.
4. `AuditInterceptor` itself is not touched — this story only adds a reader.

## Implementation Tasks

1. New `audit-logs.service.ts`: `AuditLogSummary` (mirrors the model exactly — nothing trimmed, unlike `NotificationSummary`), `listAuditLogs()`.
2. New `audit-logs.controller.ts`: `GET /audit-logs`, `@RequirePermissions("audit:read")`.
3. New `admin.module.ts`: registers the above, provides `TenantContext`.
4. `app.module.ts`: add `AdminModule` to imports.
5. `seed.ts`: add `"audit:read"`.
6. Unit tests: new `audit-logs.service.spec.ts` — scoping, ordering, empty, populated-mapping, no-active-branch.
7. e2e tests: new `audit-logs-read.e2e-spec.ts` — 401, a real `POST /customers` producing a real retrievable row, ordering, 403 for Agent.

## Migration / Rollback

None. No schema change. Rollback is a plain code revert (delete the new module, remove the `app.module.ts` import line) plus re-running the seed.

## Verification Steps

1. `pnpm --filter @crm/api typecheck`/`lint`/`test`.
2. `pnpm --filter @crm/api prisma:seed`.
3. `pnpm --filter @crm/api test:e2e`.
4. `git status` — confirm `apps/web`, `apps/portal`, `schema.prisma`, migrations, and every unrelated module have empty diffs.

## Done Criteria

- [ ] Endpoint returns real, correctly-scoped, newest-first data.
- [ ] 401/403 enforced correctly.
- [ ] `AuditInterceptor`'s writing behavior unchanged.
- [ ] No schema/migration change; no mutation endpoint; no frontend.
- [ ] Unit + e2e tests pass.
- [ ] No unrelated file touched.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
