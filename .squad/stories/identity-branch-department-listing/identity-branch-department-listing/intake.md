> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/identity-branch-department-listing/identity-branch-department-listing/intake.md`

---

## Feature

- **Feature name (display):** Backend Foundation — Branch & Department Listing
- **Feature slug:** `identity-branch-department-listing`

## Title

```text
Backend Foundation: Branch & Department Listing
```

## Description

```text
Branch and Department have existed since Story 02 and are already used for tenant scoping everywhere, but no endpoint has ever exposed them for a frontend to list. This blocks two real, previously-identified frontend gaps: Story 32's deliberately-deferred user creation (CreateUserDto requires a real branchId/roleId) and a department picker on ticket creation.

This story adds two read-only endpoints to the existing IdentityModule: GET /identity/branches (the caller's own branch only) and GET /identity/departments (every department in that branch). No mutation, no new model, no migration — a new "branch:read" permission key is added to the existing, intentionally-extensible permission catalog (seed.ts), mirroring how "sla:read" already covers two closely-related models (SlaPolicy, BusinessHoursCalendar).
```

## Acceptance criteria

```text
- GET /identity/branches returns the caller's own branch (scoped via TenantContext.requireBranchScope(), exactly like every other scoped endpoint) as a single-element array.
- GET /identity/departments returns every department within that same branch.
- Both routes require the new "branch:read" permission; an Agent-role token (which has no permissions) receives 403.
- An unauthenticated request receives 401.
- No new Prisma model, migration, or business rule. No mutation endpoint of any kind.
- apps/web, apps/portal, schema.prisma/migrations, and every unrelated backend module are untouched.
- Unit tests (identity.service.spec.ts) and e2e tests (identity.e2e-spec.ts) cover authenticated/unauthenticated/authorized/forbidden/populated/empty-ish cases.
```

## Dependencies

- **Blocked by:** `project-foundation` Story 02/03 (`Branch`/`Department` models, `IdentityModule`, `TenantContext`).
- **Depends on code areas:** `apps/api/src/modules/identity/identity.service.ts`, `users.controller.ts`, `apps/api/prisma/seed.ts` (new permission key only — no schema change).

## Extra notes

- Part of an approved three-story parallel backend-foundation batch (35/36/37), each owning a disjoint module: identity (35), notifications (36), admin/audit (37).
- Explicit, deliberate departure from the "no backend changes" constraint that governed Stories 30–34 — approved for this batch specifically.
- Adding "branch:read" to `PERMISSION_CATALOG` is an extension of an existing, intentionally-open-ended catalog (seed.ts's own comment: "those land with the stories that introduce those domains"), not a new permission model.

## Out of scope

- Branch/department mutation, cross-branch listing, branch-switching UI, any frontend consumer of these endpoints (a future, separate story).
