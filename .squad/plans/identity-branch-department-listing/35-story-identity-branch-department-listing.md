# Story 35 — Backend Foundation: Branch & Department Listing

## Prerequisites

- `project-foundation` Story 02/03: `Branch`/`Department` Prisma models, `IdentityModule`, `TenantContext`, `IdentityService`/`UsersController`'s existing `listUsers`/`listRoles`/`listPermissions` conventions.

## Story Goal

Expose the caller's own branch and its departments via two new read-only `GET` endpoints, using the exact existing service/controller/permission conventions — no new module, no schema change, no mutation.

## Context — Read These Files First

1. `apps/api/src/modules/identity/identity.service.ts` — `listUsers`/`listRoles`/`listPermissions` (the exact pattern `listBranches`/`listDepartments` mirror).
2. `apps/api/src/modules/identity/users.controller.ts` — the controller's own doc comment on branch/department mutation being out of scope.
3. `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG`, `ROLE_GRANTS` (`SuperAdmin: PERMISSION_CATALOG`, `Agent: []`).
4. `apps/api/src/common/auth/permissions.guard.ts` — confirms permissions are resolved fresh from the DB every request, so a new permission key is inert until the seed is re-run.

## Design (resolved during this planning pass)

1. `GET /identity/branches` returns only the caller's own branch (`TenantContext.requireBranchScope()`), not every branch in the organization — no cross-branch listing/branch-switching decision exists yet.
2. `GET /identity/departments` returns every department in that same branch.
3. Both share one new permission, `branch:read` — mirroring how `sla:read` already spans two models (`SlaPolicy`, `BusinessHoursCalendar`).
4. Added to `UsersController` (the existing "Identity & Access management surface" controller) — no new controller file.

## Implementation Tasks

1. `identity.service.ts`: add `BranchSummary`/`DepartmentSummary` interfaces, `listBranches()`, `listDepartments()`.
2. `users.controller.ts`: add `GET /identity/branches`, `GET /identity/departments`, both `@RequirePermissions("branch:read")`.
3. `seed.ts`: add `"branch:read"` to `PERMISSION_CATALOG`.
4. Unit tests: `identity.service.spec.ts` — scoping, empty, and no-active-branch cases for both methods.
5. e2e tests: `identity.e2e-spec.ts` — 401, 200-with-real-branch, 200-with-real-departments, 403-for-Agent.

## Migration / Rollback

None. No schema change. Rollback is a plain code revert plus re-running the seed (idempotent).

## Verification Steps

1. `pnpm --filter @crm/api typecheck`/`lint`/`test`.
2. `pnpm --filter @crm/api prisma:seed` (idempotent — materializes the new permission row).
3. `pnpm --filter @crm/api test:e2e`.
4. `git status` — confirm `apps/web`, `apps/portal`, `schema.prisma`, migrations, and every unrelated module have empty diffs.

## Done Criteria

- [ ] Both endpoints return real, correctly-scoped data.
- [ ] 401/403 enforced correctly.
- [ ] No schema/migration change; no mutation endpoint.
- [ ] Unit + e2e tests pass.
- [ ] No unrelated file touched.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
