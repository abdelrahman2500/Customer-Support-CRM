# Story 34 — Agent Workspace: Roles & Permissions Viewer

## Prerequisites

- `project-foundation` Story 03 completed: `UsersController`'s `GET /identity/roles`/`GET /identity/permissions`, `role:read`/`permission:read` permissions.

---

## Story Goal

Give the Agent Workspace a real, read-only roles-and-permissions screen over the already-existing `GET /identity/roles`/`GET /identity/permissions`, as an entirely new, independent route/component surface with zero mutation.

**Not in scope**: role/permission creation, editing, or assignment (no such endpoint exists); user management (Story 32, unmodified); any new backend endpoint/DTO/permission/model/migration.

---

## Context — Read These Files First

1. `apps/api/src/modules/identity/users.controller.ts` and `identity.service.ts`'s `listRoles`/`listPermissions` — confirmed this planning pass: `RoleSummary { id, name, permissions: string[] }` (permission **keys**, already embedded per role), `PermissionSummary { id, key }`.
2. `apps/web/src/components/users/user-list-view.tsx` (Story 32) — the loading/error/empty/`Table` conventions this story's list mirrors; the read-only `Badge`-per-item rendering (`user.roles.map(...)`) this story extends to permission keys.

---

## Design (resolved during this planning pass)

1. **No per-row hook needed** — this story has zero mutations, so expand/collapse state for "which roles are expanded" is tracked once at the parent level (`useState<Set<string>>`), not via a per-row subcomponent; there is no hook being called per row to begin with.
2. **Two independent sections on one page**: a roles list (expandable per role to reveal its already-embedded permission keys) and a separate "All permissions" reference list (`GET /identity/permissions`) — each with its own independent loading/error/empty state.
3. **Dedicated new files**, zero overlap with Story 33 or any existing screen.

---

## Implementation Tasks

### 1 — API client

File: `apps/web/src/lib/roles-api.ts` (new)

- `RoleSummary { id, name, permissions: string[] }`, `PermissionSummary { id, key }`.
- `listRoles()`, `listPermissions()`.

### 2 — Hooks

File: `apps/web/src/hooks/use-roles.ts` (new)

- `useRolesQuery()`, `usePermissionsQuery()` — read-only, `staleTime` matching `useUsersQuery`'s existing convention (infrequently-changing reference data).

### 3 — View + route

- `apps/web/src/components/roles/role-list-view.tsx` (new): roles list with expand/collapse, permissions reference section.
- `apps/web/src/app/[locale]/(agent)/roles/page.tsx` (new).

### 4 — i18n

New top-level `roles.*` namespace in `apps/web/messages/{en,ar}.json`.

### 5 — Tests

New `role-list-view.spec.tsx` mirroring `user-list-view.spec.tsx`'s conventions, plus expand/collapse and permissions-reference-specific cases.

---

## Edge Cases & Failure Modes

- **A role has zero permissions**: an empty-state message inside its expanded row, not an error.
- **No roles or no permissions exist** (should not occur given seed data, handled defensively): empty-state paragraph for that section only.
- **One section fails while the other succeeds**: each renders its own independent loading/error/empty/populated state.

---

## Test Plan

1. Component tests as listed in Task 5.
2. Regression: full existing `apps/web` suite remains green (new files only). `apps/api`/`apps/worker` unaffected — run for confirmation only.

---

## Migration / Rollback

None. Rollback is a plain code revert (delete the new files/route).

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`; workspace-wide `pnpm typecheck`/`lint`. Build only if no shared dev-server contention exists at verification time.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): real `GET /identity/roles`/`GET /identity/permissions` against real seeded data, confirming the actual shape matches what the UI renders.
4. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, and every other existing `apps/web` file have empty diffs.
5. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] `/roles` lists every real role via the real `GET /identity/roles`, expandable to show its real permission keys.
- [ ] An "All permissions" section lists every real permission via the real `GET /identity/permissions`.
- [ ] No mutation of any kind exists on this screen.
- [ ] No new backend endpoint, DTO field, permission, Prisma model, migration, or business rule.
- [ ] No existing `apps/web` file is modified — this story only adds new files.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass; existing tests remain green.
- [ ] Typecheck/lint clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
