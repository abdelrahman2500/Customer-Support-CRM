# Story 45 — Agent Workspace: Branch & Department Management, Admin Self-Service

> **Note on this file's provenance.** Unlike Stories 42–44, this plan was not written *before* implementation and confirmed with a "STOP HERE" gate. It was produced by a prior multi-agent planning pass (an ad-hoc conversation, not a `squad` CLI run) that reached a complete, approved FINAL PLAN; that plan was then fully implemented; this file was written afterward, directly from the approved plan and the real implemented code/tests, to preserve this repository's established plan/story/intake convention (see the parent `00-overview.md`'s dependency notes). Sections below are phrased in past/present tense describing what was actually decided and built, not as a forward-looking instruction.

## Prerequisites

- `project-foundation` Story 02/03: the `Branch`/`Department` Prisma models and the `IdentityModule`/`UsersController` this story extends.
- `identity-branch-department-listing` Story 35: `GET /identity/branches`, `GET /identity/departments`, and the `branch:read` permission — both endpoints already existed, scoped to the caller's own branch via `TenantContext.requireBranchScope()`, before this story.
- `agent-workspace-user-admin` Story 38: `useDepartmentsQuery()` / the active-only department picker already consumed by `CreateUserView`/`CreateTicketView`/`TicketDetailView` — left completely untouched by this story (see Design).
- `agent-workspace-navigation-menu` Story 44: the `WorkspaceNav` component and its `NAV_ITEMS` array — this story adds one more entry, touching no other part of that component.

---

## Story Goal

Let the caller's own branch and its departments be managed from the Agent Workspace, rather than only listed: rename the caller's own branch and toggle it active/inactive; create new departments within that branch, rename them, and toggle them active/inactive — all still scoped to the caller's own branch only, mirroring the scoping `listBranches`/`listDepartments` already established in Story 35. Branch **creation** and any cross-branch/cross-organization administration remain explicitly out of scope (see Non-Goals).

**Not in scope**: creating a new branch, listing or administering any branch other than the caller's own, deleting a branch or department (soft-deactivation via `isActive` only), removing a department's existing user/ticket/SLA-policy associations, and any change to the existing active-only branch/department pickers or their consumers (`CreateUserView`, `CreateTicketView`, `TicketDetailView`).

---

## Context — Read These Files First

1. `apps/api/src/modules/identity/identity.service.ts` — `listBranches()`/`listDepartments()` (Story 35), the exact scoping pattern (`TenantContext.requireBranchScope()`) this story's new `updateBranch()`/`createDepartment()`/`updateDepartment()` mirror; `CustomersService.createCustomer`'s convention of deriving the tenant-scoping id from `TenantContext`, never from the request body, mirrored by `createDepartment()`.
2. `apps/api/src/modules/identity/users.controller.ts` — the "Identity & Access management surface" controller Story 35 already extended with `GET branches`/`GET departments`; this story adds `PATCH branches/:id`, `POST departments`, `PATCH departments/:id` to the same controller, no new controller file.
3. `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG` (already carrying `branch:read` from Story 35) and `ROLE_GRANTS` (`SuperAdmin`: every permission; `Agent`: none).
4. `apps/api/prisma/schema.prisma` — `Branch`/`Department` models: `Department` already carried `@@unique([branchId, name])` since Story 02/03; `Branch` had no equivalent uniqueness on `name` before this story.
5. `apps/web/src/lib/tickets-api.ts` / `apps/web/src/hooks/use-tickets.ts` — the existing active-only `listBranches`/`listDepartments`/`useDepartmentsQuery()` picker functions this story deliberately does not touch, extend, or share query keys/types with.
6. `apps/web/src/components/workspace/workspace-nav.tsx` — the `NAV_ITEMS` array (Story 44) this story adds one entry to.
7. `apps/web/src/components/users/create-user-view.tsx` — the existing precedent for a department picker sourced from `useDepartmentsQuery()`, referenced when confirming this story's separate management view would not collide with it.

---

## Design (resolved during this planning pass)

1. **No `branch:create` permission and no `createBranch` service method exist.** Branch creation stays out of scope, exactly as the Story 03 plan and the `UsersController` doc comment already stated for the pre-Story-35 state; this story only adds renaming and activate/deactivate for the caller's *own*, already-existing branch. The `UsersController` doc comment was updated to record this explicitly: *"Role/Permission mutation, and Branch **creation**, remain explicitly out of scope... Story 45 adds renaming and activating/deactivating the caller's own branch... and creating/renaming/activating/deactivating departments within the caller's own branch... both still scoped to the caller's own branch only, never another branch."*
2. **Three new permission keys, not one shared with `branch:read`:** `branch:update` (for `PATCH /identity/branches/:id`), `department:create` (for `POST /identity/departments`), `department:update` (for `PATCH /identity/departments/:id`). Reading (`GET` on either resource, including with `includeInactive=true`) continues to use the existing `branch:read` permission from Story 35 — no new read permission introduced.
3. **`updateBranch(id, dto)` scopes by identity comparison against `TenantContext`, not a DB lookup**: `id !== tenantContext.requireBranchScope().branchId` throws `NotFoundException` before any write is attempted — the caller's own branch id is already known and trusted, so no extra query is needed to prove out-of-scope access is rejected.
4. **`createDepartment(dto)` derives `branchId` from `TenantContext` only; `CreateDepartmentDto` has no `branchId` field at all**, and the global `ValidationPipe` (`forbidNonWhitelisted: true`) rejects any client-sent `branchId` outright — mirroring `CustomersService.createCustomer`'s existing convention. `updateDepartment(id, dto)` scopes via `requireDepartmentInScope()`, a `findFirst({ where: { id, branchId } })` check that throws `NotFoundException` when the department isn't in the caller's own branch.
5. **Duplicate names are caught at the Prisma level and translated to `409 ConflictException`, never a raw 500.** `Branch` gained `@@unique([organizationId, name])` in this story's migration (backstopping `translateDuplicateBranchName`); `Department`'s pre-existing `@@unique([branchId, name])` is backstopped the same way by `translateDuplicateDepartmentName`. Both catch Prisma's `P2002` error code specifically.
6. **`includeInactive` is a plain string query param (`?includeInactive=true`), compared as `=== "true"`, not `@Transform`-parsed to boolean** — matching the simplest existing convention available and keeping the two Story 35 `GET` handlers' signatures additive-only. Default behavior (param omitted) is unchanged: only active rows returned, so every existing caller of `GET /identity/branches`/`GET /identity/departments` (the active-only pickers) sees identical behavior to before this story.
7. **A dedicated frontend API/hook pair (`branches-api.ts`, `use-branches.ts`), not an extension of `tickets-api.ts`/`use-tickets.ts`.** This story's management view needs `includeInactive=true` results (to show and reactivate a branch/department it has itself deactivated), which is a different shape of the same resource than the active-only picker `tickets-api.ts#listBranches`/`use-tickets.ts#useDepartmentsQuery` already serve to `CreateUserView`/`CreateTicketView`/`TicketDetailView`. Following this codebase's existing "no query key serves two different filter shapes of one resource" convention, this story introduces its own query keys (`["managed-branch"]`, `["managed-departments"]`) and its own types (`ManagedBranch`, `ManagedDepartment`) rather than risk polluting the existing pickers' cached, active-only results. `tickets-api.ts`/`use-tickets.ts` are untouched.
8. **`ManagedBranch` deliberately has no `timezone` field**, even though `UpdateBranchDto` accepts one: `IdentityService#listBranches` only ever `select`s `{ id, name, isActive }`, so the real `GET` response never returns `timezone` — the frontend type was written to match the real response shape rather than the DTO's full acceptance surface, to avoid an always-`undefined` field. Consequently the UI exposes rename and activate/deactivate for the branch, not a timezone field.
9. **One combined screen (`/branches` → `BranchDepartmentsView`), the caller's own branch above, its departments below** — the same "parent record header + child list section" shape `BusinessHoursView` already established (calendar header, exceptions list below), not two separate routes.
10. **Blur-commit `Input` for renaming (branch name, department name); a button toggling `isActive` — never a checkbox/switch — for activate/deactivate**, mirroring this codebase's existing blur-commit convention (`ticket-detail-view.tsx`'s category field, `customer-detail-view.tsx`'s displayName field) and its existing activate/deactivate button convention (`UserRow`'s deactivate/reactivate button in `agent-workspace-user-admin`). Neither mutation is ever applied optimistically: only a successful response invalidates the relevant query key, forcing a re-fetch of the authoritative record (the mutation response itself is only `{ id }`, mirroring every other mutation endpoint in this codebase, e.g. `updateTicket`).
11. **A one-field inline `AddDepartmentForm` below the departments table**, not a separate route/page — the smallest UI surface for a one-field create, mirroring `CreateUserView`'s submit/error-handling pattern (disabled-until-non-empty submit button, inline error message showing the backend's own message when it's an `ApiError`, generic fallback otherwise) but rendered inline rather than as a full page.
12. **A tenth `WorkspaceNav` entry, `branches` → `/branches`, inserted after `business-hours` and before `users`**, in the same operational-then-administrative ordering Story 44 established, following the exact same plain-`<a href>` convention (no `next/link`, no active-page highlighting, always rendered unconditionally for every authenticated user — same rationale Story 44 recorded: no client-side permission-gating pattern exists anywhere in this codebase, and the seeded `Agent` role has zero permissions to key one off).
13. **No 403-vs-generic distinction beyond what every other mutation on this screen already does**: `mutation.error instanceof ApiError && mutation.error.status === 403` renders a permission-specific inline message; anything else renders a generic failure message — the same pattern used throughout the Agent Workspace (`ticket-detail-view.tsx`, `branch-departments-view.tsx`'s own `MyBranchFields`/`DepartmentRow`).
14. **README was not touched.** No sentence in the root `README.md` was updated to mention this capability — consistent with how this story was actually implemented (confirmed via `git status`), though unlike Story 42's explicit single-sentence README update, no equivalent update was made here for the branches screen.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — added `isActive Boolean @default(true) @map("is_active")` to both `Branch` and `Department`; added `@@unique([organizationId, name])` to `Branch` (`Department`'s `@@unique([branchId, name])` already existed).
2. **`apps/api/prisma/migrations/20260828090000_add_branch_department_is_active_and_branch_name_unique/migration.sql`** — `ALTER TABLE` adding `is_active` (`NOT NULL DEFAULT true`) to `identity.branches` and `identity.departments`; `CREATE UNIQUE INDEX branches_organization_id_name_key ON identity.branches(organization_id, name)`.
3. **`apps/api/prisma/seed.ts`** — added `"branch:update"`, `"department:create"`, `"department:update"` to `PERMISSION_CATALOG` (granted to `SuperAdmin` via the existing "every permission" grant, none to `Agent`); updated the branch-seeding comment to note the new `@@unique([organizationId, name])` constraint, while deliberately keeping the existing find-then-create (not upsert) idempotency approach to avoid asserting an `isActive`/`timezone` update on every re-run.
4. **`apps/api/src/modules/identity/dto/update-branch.dto.ts`** (new) — `UpdateBranchDto { name?: string; timezone?: string; isActive?: boolean }`, all optional/validated (`@IsString`/`@IsBoolean`).
5. **`apps/api/src/modules/identity/dto/create-department.dto.ts`** (new) — `CreateDepartmentDto { name: string }` (`@IsString @IsNotEmpty`) — no `branchId` field.
6. **`apps/api/src/modules/identity/dto/update-department.dto.ts`** (new) — `UpdateDepartmentDto { name?: string; isActive?: boolean }`.
7. **`apps/api/src/modules/identity/identity.service.ts`**:
   - `BranchSummary`/`DepartmentSummary` interfaces gained `isActive: boolean`.
   - `listBranches(includeInactive = false)` / `listDepartments(includeInactive = false)`: the `where` clause conditionally drops the `isActive: true` filter when `includeInactive` is `true`; default behavior unchanged.
   - `updateBranch(id, dto)`: identity-compares `id` against `TenantContext`'s own branch id (`NotFoundException` otherwise), applies only the DTO fields present, catches `P2002` via `translateDuplicateBranchName` → `ConflictException`.
   - `createDepartment(dto)`: creates with `branchId` from `TenantContext`, `name` from the DTO; catches `P2002` via `translateDuplicateDepartmentName` → `ConflictException`.
   - `updateDepartment(id, dto)`: `requireDepartmentInScope(id)` (a `findFirst({ id, branchId })` check, `NotFoundException` if not found), then applies present fields, same duplicate-name translation.
8. **`apps/api/src/modules/identity/users.controller.ts`**:
   - `listBranches`/`listDepartments` gained an optional `@Query("includeInactive") includeInactive?: string` parameter, forwarded as `includeInactive === "true"`.
   - Added `PATCH branches/:id` (`@RequirePermissions("branch:update")`), `POST departments` (`@RequirePermissions("department:create")`), `PATCH departments/:id` (`@RequirePermissions("department:update")`), each returning `{ id: string }`.
   - Updated the controller's own top-of-file doc comment to record Story 45's scope (quoted in Design item 1).
9. **Tests**:
   - `apps/api/src/modules/identity/identity.service.spec.ts`: new `describe` blocks for `listBranches`/`listDepartments`'s `includeInactive` behavior, `updateBranch`, `createDepartment`, `updateDepartment` — covering scoping, not-found-out-of-scope, and the no-active-branch propagation case for each new method (per `git diff --stat`, +221 lines).
   - `apps/api/test/identity.e2e-spec.ts`: new cases covering 401 on every new/changed route with no token; 403 for an Agent-role user lacking `branch:update`/`department:create`/`department:update`; renaming the branch; deactivating/reactivating the branch (and confirming `includeInactive=true` still surfaces it while the default listing hides it); creating a department (confirming any client-sent `branchId` is impossible — no such field exists on the DTO, and `forbidNonWhitelisted: true` would reject it regardless — and the created row's `branchId` is the admin's own branch); renaming, deactivating, and reactivating a department; a duplicate department name within the branch rejected with `409`; and a regression case confirming a user's existing department assignment is not stripped when that department is later deactivated (per `git diff --stat`, +316 lines).

### Frontend

10. **`apps/web/src/lib/branches-api.ts`** (new) — `ManagedBranch { id, name, isActive }`, `ManagedDepartment { id, branchId, name, isActive }`, `UpdateBranchInput`, `CreateDepartmentInput`, `UpdateDepartmentInput`; `getManagedBranch()` (`GET /identity/branches?includeInactive=true`, returns the first element or `null`), `listManagedDepartments()` (`GET /identity/departments?includeInactive=true`), `updateBranch(id, input)` (`PATCH /identity/branches/:id`), `createDepartment(input)` (`POST /identity/departments`), `updateDepartment(id, input)` (`PATCH /identity/departments/:id`) — every mutation returns `{ id }` only.
11. **`apps/web/src/hooks/use-branches.ts`** (new) — `managedBranchQueryKey = ["managed-branch"]`, `managedDepartmentsQueryKey = ["managed-departments"]` (deliberately distinct from `use-tickets.ts`'s picker query keys); `useManagedBranchQuery()`, `useManagedDepartmentsQuery()`, `useUpdateBranchMutation(id)`, `useCreateDepartmentMutation()`, `useUpdateDepartmentMutation(id)` — every mutation hook invalidates its query key on success only, never applies optimistically.
12. **`apps/web/src/components/branches/branch-departments-view.tsx`** (new) — `BranchDepartmentsView` (`MyBranchSection` + `DepartmentsSection`); `MyBranchSection` handles loading/error/retry and renders `MyBranchFields` (blur-commit name `Input`, active/inactive `Badge`, activate/deactivate `Button`, inline 403-vs-generic error); `DepartmentsSection` handles loading/error/empty states and renders a `Table` of `DepartmentRow`s (same blur-commit-name + activate/deactivate-button + inline-error shape as the branch) plus `AddDepartmentForm` (disabled-until-non-empty submit, inline error showing the backend's own `ApiError` message or a generic fallback, resets on success).
13. **`apps/web/src/app/[locale]/(agent)/branches/page.tsx`** (new) — renders `<BranchDepartmentsView />`.
14. **`apps/web/src/components/workspace/workspace-nav.tsx`** (modified) — one new `NAV_ITEMS` entry, `{ href: "branches", labelKey: "nav.branches" }`, inserted after `business-hours` and before `users`.
15. **i18n** — `apps/web/messages/en.json`/`ar.json`: `workspace.nav.branches` (`"My Branch"` / `"فرعي"`); a new top-level `branches` namespace with `myBranch.*` (heading, nameLabel, active/inactive, activate/deactivate, actionForbidden/actionFailed, loadError, retry) and `departments.*` (heading, error/retry/empty, active/inactive, activate/deactivate, nameLabel, createPlaceholder/createSubmit/createSubmitting/createFailed, actionForbidden/actionFailed, columns.name/columns.status) — additive only, no existing key changed.
16. **Tests**:
    - `apps/web/src/components/workspace/workspace-nav.spec.tsx` (modified) — the existing nav-links test's expected-links table gained `["nav.branches", "/en/branches"]`; the test description was updated from "nine" to "ten" top-level screens; every other existing test unmodified.
    - `apps/web/src/components/branches/branch-departments-view.spec.tsx` (new) — covers: loading states (branch section, departments section); error+retry for both sections; the empty-departments state; rendering the branch's name/active badge and the departments table's rows; committing a branch rename on blur (and not committing when unchanged); toggling the branch's active state; committing a department rename on blur (and not committing when unchanged); toggling a department's active state; inline 403-vs-generic mutation-error messages for both branch and department updates; the create-department form (disabled-until-content submit, submitting exactly `{ name }`, showing the backend's own message on a rejected `ApiError` submission while preserving the entered value, a generic fallback for a non-`ApiError` rejection, and a pending/disabled state while in flight); and bilingual (English/Arabic) rendering of the headings.

---

## Edge Cases & Failure Modes

- **A caller attempts to `PATCH` a branch id that is not their own**: `updateBranch` throws `NotFoundException` before any write — verified by an identity comparison against `TenantContext`, not a DB round-trip.
- **A caller attempts to `PATCH` a department id outside their own branch**: `requireDepartmentInScope` throws `NotFoundException` the same way.
- **Duplicate branch name within the same organization, or duplicate department name within the same branch**: both are caught via Prisma's `P2002` code and translated to `409 ConflictException` — never a raw 500.
- **A department is deactivated while a user is still assigned to it**: the user's existing department assignment is not stripped or altered — covered by an explicit regression test (`identity.e2e-spec.ts`).
- **`includeInactive` omitted or any value other than the literal string `"true"`**: treated as `false` — only active rows returned, identical to pre-Story-45 behavior for every existing caller.
- **A rejected branch/department mutation (403 or otherwise)**: renders the same inline 403-vs-generic message convention every other mutation on this screen already uses; the name field reverts to its last known-good value via `onError`.
- **Create-department submission rejected**: the entered name is preserved (not cleared) and the backend's own `ApiError` message is shown inline, falling back to a generic message for a non-`ApiError` rejection.
- **No token on any new/changed route**: `401`, verified for `PATCH branches/:id`, `POST departments`, `PATCH departments/:id`.
- **Agent-role user (no `branch:update`/`department:create`/`department:update`)**: `403` on each respective new route.

---

## Test Plan

1. **Backend unit** (`identity.service.spec.ts`): scoping, not-found/out-of-scope, and no-active-branch propagation for `listBranches`/`listDepartments`'s `includeInactive` behavior, `updateBranch`, `createDepartment`, `updateDepartment`.
2. **Backend e2e** (`identity.e2e-spec.ts`): 401/403 coverage for every new/changed route; full rename/deactivate/reactivate lifecycle for both branch and department; duplicate-name 409; the "department deactivation does not strip an existing user's assignment" regression case; confirmation that `CreateDepartmentDto` cannot accept a client-sent `branchId`.
3. **Frontend component** (`branch-departments-view.spec.tsx`): loading/error/empty states, rename/commit/no-commit-when-unchanged for both branch and department, activate/deactivate toggling, inline 403-vs-generic errors, the create-department form's full interaction surface, bilingual heading rendering.
4. **Frontend regression** (`workspace-nav.spec.tsx`): the existing nav-links test extended with the new `branches` entry; every other existing test in the file unmodified.
5. **Full workspace regression**: `apps/web`, `apps/api`, `apps/worker` suites, plus typecheck/lint/build across the workspace.

---

## Migration / Rollback

One migration: `20260828090000_add_branch_department_is_active_and_branch_name_unique` — adds `is_active` (default `true`) to `identity.branches` and `identity.departments`, and a unique index on `identity.branches(organization_id, name)`. Both column additions are backward-compatible (default `true`, `NOT NULL`); the new unique index could in principle fail to apply against pre-existing duplicate branch names within one organization, but the seed data does not produce any. Rollback is a reverse migration dropping the column/index, plus a plain code revert of every file listed in Implementation Tasks.

---

## Verification Steps

1. `pnpm --filter @crm/api typecheck`/`lint`/`test`; `pnpm --filter @crm/web typecheck`/`lint`/`test`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/api prisma:seed` (idempotent — materializes the three new permission rows).
3. `pnpm --filter @crm/api test:e2e`.
4. Live infra (if available): rename the seeded branch, deactivate/reactivate it, create/rename/deactivate/reactivate a department, and confirm the active-only pickers (`CreateUserView`, `CreateTicketView`, `TicketDetailView`) never surface a deactivated branch/department while the new `/branches` screen does (via `includeInactive=true`).
5. `git status`; confirm `apps/portal` and every module unrelated to identity/branches have empty diffs.

## Done Criteria

- [x] `Branch`/`Department` gained `isActive`; `Branch` gained `@@unique([organizationId, name])`; one migration covers both.
- [x] `branch:update`, `department:create`, `department:update` permission keys exist in the seed catalog; no `branch:create` key was added.
- [x] `PATCH /identity/branches/:id`, `POST /identity/departments`, `PATCH /identity/departments/:id` exist, each scoped to the caller's own branch, each returning `{ id }`.
- [x] `GET /identity/branches`/`GET /identity/departments` gained an additive, default-`false` `includeInactive` query parameter; every existing caller's behavior is unchanged.
- [x] Duplicate branch/department names are rejected with `409`, never a raw 500.
- [x] A dedicated `/branches` Agent Workspace screen exists, letting the caller rename/activate/deactivate their own branch and create/rename/activate/deactivate departments within it.
- [x] `WorkspaceNav` gained one new persistent link to `/branches`.
- [x] The existing active-only branch/department pickers (`tickets-api.ts`, `use-tickets.ts`, and their consumers) are completely unchanged.
- [x] English and Arabic translations exist for every new string.
- [x] Backend unit + e2e tests and frontend component tests exist and (per the story's own record) passed; `workspace-nav.spec.tsx`'s existing tests remain green.
- [x] Typecheck/lint/build clean, workspace-wide (per the story's own record).
- [ ] Committed to git — **not yet done as of this writing (2026-08-28)**; the working tree still shows this story's changes as uncommitted modifications/untracked files.

---

## Non-Goals (explicit)

- Creating a new branch, or any cross-branch/cross-organization branch administration — no `branch:create` permission and no `createBranch` service method were introduced; a caller can only ever manage their own, already-existing branch.
- Deleting a branch or department — only soft activation/deactivation via `isActive` exists.
- Removing or altering a user's, ticket's, or SLA policy's existing association with a department when that department is deactivated.
- Any change to the existing active-only branch/department pickers (`tickets-api.ts`, `use-tickets.ts`'s `useDepartmentsQuery()`) or their consumers (`CreateUserView`, `CreateTicketView`, `TicketDetailView`).
- A `timezone` field on the branch-management UI — the real `GET /identity/branches` response never returns one, even though `UpdateBranchDto` accepts one.
- Active-page highlighting or a `next/link`-based nav (mirrors Story 44's own non-goals — no such precedent exists anywhere in this codebase).
- Any README change.
- Any role/permission-catalog administration UI, or any change to `role:read`/`permission:read`.

---

**Recorded as the FINAL PLAN this story was actually planned and built against. Implementation is complete; the change has not yet been committed to git as of 2026-08-28.**
