# Story 46 — Agent Workspace: Role & Permission Management, Admin Self-Service

## Prerequisites

- `project-foundation` Story 02/03: the `Role`/`Permission`/`RolePermission` Prisma models and `PermissionsGuard`, this story extends.
- `agent-workspace-roles-permissions-viewer` Story 34: the existing read-only `/roles` screen (`role-list-view.tsx`, `roles-api.ts`, `use-roles.ts`) and the `GET /identity/roles`/`GET /identity/permissions` endpoints this story extends in place.
- `agent-workspace-user-admin` Story 32/38: `CreateUserDto.roleId` and its role picker (`useRolesQuery()`), left completely untouched by this story.
- `agent-workspace-branch-department-admin` Story 45: the `includeInactive` query-param convention, the `translateDuplicate<X>Name` P2002-translation pattern, and the deactivation-semantics precedent ("blocks future assignment, never cascades") — all directly reused here.

---

## Story Goal

Let a `SuperAdmin` create custom Roles, rename/activate/deactivate them, and assign or revoke existing catalog Permissions on any Role (including the two seeded ones, `SuperAdmin` and `Agent`) — by extending the existing read-only `/roles` viewer, not building a second screen. This closes the last major identity/admin domain still fully read-only, and is the only way to make the seeded, zero-permission `Agent` role functional without direct database access.

**Not in scope**: creating/deleting/renaming Permission rows or accepting client-defined permission keys; user↔role/branch/department reassignment (`UserBranchRole` is untouched); renaming or deactivating the two seeded roles `SuperAdmin`/`Agent` (permission *assignment* on them remains fully allowed); any hard-delete of a Role; any change to Branch/Department, tickets, customers, or navigation.

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — the `Role`/`Permission`/`RolePermission` models: `Role.name` is already a plain, global `@unique` column (not composite); neither `Role` nor `Permission` has `isActive` today; `RolePermission` is a pure join table with composite `@@id([roleId, permissionId])`, both FKs `onDelete: Cascade`.
2. `apps/api/src/modules/identity/identity.service.ts` — the exact current `listRoles()`/`listPermissions()` (`RoleSummary.permissions` is already a flattened `string[]` of permission keys, via `include: { permissions: { include: { permission: true } } }`), and Story 45's `translateDuplicateBranchName`/`translateDuplicateDepartmentName` — the exact pattern `translateDuplicateRoleName` mirrors.
3. `apps/api/src/modules/identity/users.controller.ts` — the current `GET roles`/`GET permissions` routes and the class doc comment stating Role/Permission mutation is "explicitly out of scope — see the Story 03 plan," which this story updates.
4. `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG`, `ROLE_GRANTS`, and the exact `Role`/`Permission`/`RolePermission` seeding logic (upsert for `Role`/`Permission`, delete-then-recreate transaction for `RolePermission`) — `setRolePermissions` mirrors this transaction shape exactly.
5. `apps/api/src/common/auth/permissions.guard.ts` — confirms permissions are resolved fresh from the DB on **every** guarded request, matched via `role.name` against the JWT's `roles: string[]` claim, with zero caching anywhere in the auth path. This is the evidence behind this story's deactivation and permission-revocation semantics (Design items 3 and 9 below).
6. `apps/web/src/components/roles/role-list-view.tsx` and its spec — the existing read-only viewer this story extends in place (two independent sections: roles table with expand/collapse, and an "all permissions" reference list).
7. `apps/web/src/components/branches/branch-departments-view.tsx` — Story 45's "parent section + child list" structural precedent, and its `MyBranchFields`/`DepartmentRow` blur-commit-rename + activate/deactivate-button conventions, reused here for `RoleRow`.

---

## Design (resolved during this planning pass)

1. **`Role.name`'s uniqueness constraint already exists** (`@unique`, since Story 02/03) — this story does not add one, only wires a `translateDuplicateRoleName` P2002 translator to the constraint that was always there, since no mutation route previously existed to trigger it.
2. **Three new permission keys, kept distinct**: `role:create`, `role:update` (rename/activate/deactivate only), `role:assign-permissions` (kept separate from `role:update` because assigning permissions is meaningfully more security-sensitive than a plain rename — extending this codebase's existing create/update key-splitting philosophy one step further). Reads keep using the existing `role:read`/`permission:read` keys, unchanged.
3. **Deactivating a Role blocks only future assignment, never cascades.** Verified directly against `PermissionsGuard`'s actual code (not assumed): the guard never checks `Role.isActive` — it only matches `role.name` against the JWT claim. So an already-assigned user's live permission resolution is completely unaffected by their role being deactivated afterward, mirroring Story 45's Branch/Department precedent exactly, now confirmed compatible by direct inspection. Deactivation only removes a role from `GET /identity/roles`'s default (active-only) listing, so `CreateUserView`'s picker can no longer assign it to new users.
4. **Permission revocation is provably, fully dynamic — zero mutation to `UserBranchRole` needed.** `PermissionsGuard` executes a fresh `prisma.permission.findMany(...)` on every guarded request with no caching anywhere in the auth path (confirmed by grepping the entire API for `redis|cache` — none touches auth). Revoking a permission from a Role takes effect for every user holding it on their very next request.
5. **`SuperAdmin` and `Agent` cannot be renamed or deactivated.** Grounded in `seed.ts`'s reconciliation logic, which is keyed by the literal strings `"SuperAdmin"`/`"Agent"` — renaming either in the DB would cause the next `prisma:seed` run to create a duplicate role under the original name. Deactivating `SuperAdmin` also risks an unrecoverable lockout. `updateRole` rejects (`400 BadRequestException`) any attempt to change `name`/`isActive` on these two roles specifically. **Permission assignment on both remains fully allowed** — `setRolePermissions` has no such restriction, since granting `Agent` its first real permissions is the entire point of this story.
6. **A newly created Role starts with zero permissions**; permissions are assigned via a separate call. There is no existing precedent anywhere in this codebase for a single form submission creating a parent record and a many-to-many assignment simultaneously — a deliberate two-step create-then-assign flow was chosen over inventing one.
7. **Permission assignment is full-replace, not incremental assign/revoke.** `PATCH /identity/roles/:id/permissions` accepts the complete desired `permissionKeys: string[]` and replaces the role's `RolePermission` rows atomically (delete-then-recreate, in a transaction) — mirroring `seed.ts`'s own reconciliation pattern and `BusinessHoursCalendar`'s existing "replace the whole collection atomically" precedent (Story 33), rather than adding per-permission assign/revoke routes (which would also require inventing this codebase's first-ever `DELETE` route for the revoke half — a break from a repo-wide, zero-hard-delete convention).
8. **Role is not branch-scoped.** Unlike Branch/Department, `Role`/`Permission` have no `branchId`/`organizationId` at all — `listRoles`/`createRole`/`updateRole`/`setRolePermissions` never call `TenantContext.requireBranchScope()`; only `@RequirePermissions` gates these routes. This is a genuine, disclosed structural difference from Story 45, confirmed by the schema (no such field exists on `Role`) and by today's `listRoles` already listing every role globally.
9. **`includeInactive` query param on `GET /identity/roles`**, identical convention to Story 45: default `false` (active-only, serving `CreateUserView`'s picker unchanged), `true` for the management screen's `useManagedRolesQuery()`.
10. **Disclosed, deliberately-not-fixed edge case**: `PermissionsGuard` matches on `Role.name` embedded in the JWT at issuance, not `Role.id`. Renaming a *custom* role (built-in roles can't be renamed at all, per item 5) invalidates already-issued, unexpired tokens' permission resolution until the affected users' next refresh/login — failing safe (deny, never over-grant), self-healing, but a real, disclosed availability blip. Switching the guard/JWT to match by role id is a larger architectural change and explicitly out of scope here.
11. **`RoleRow` becomes a dedicated per-row component** (Rules-of-Hooks, same convention as `DepartmentRow`/`UserRow`), rendering: a blur-commit `name` `Input` (plain text + a "System role" badge instead, for `SuperAdmin`/`Agent`, as a client-side courtesy only — the backend is the actual source of truth), an active/inactive `Badge` + activate/deactivate `Button` (omitted for the two seeded roles), and — when expanded — a checkbox list rendered against the **full** permission catalog (`usePermissionsQuery()`), each box checked if `role.permissions.includes(permission.key)`, toggling one sends the complete updated array via `useSetRolePermissionsMutation(role.id)`.
12. **Error handling extends the existing 403-vs-generic split to a 3-way split**: `403` → the existing forbidden copy; any other `ApiError` (a `400` from a rejected seeded-role rename, or a `409` duplicate name) → the backend's own `error.message` shown verbatim (exactly how create-forms already surface a duplicate-name 409 today); anything else → the existing generic failure copy. This is a minimal, precedent-consistent extension, not a new pattern.
13. **A "Create Role" inline form** at the bottom of the roles table, one field (`name`), mirroring `AddDepartmentForm`'s exact shape — not a separate `/roles/new` route, since a role (like a department) is a small, single-field record at creation time.
14. **`roles-api.ts`/`use-roles.ts` are extended in place**, not replaced with new dedicated files — this domain already had its own file pair since Story 34, so there's no "shared legacy file" problem to solve the way Story 45 had with `tickets-api.ts`.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — add `isActive Boolean @default(true) @map("is_active")` to `Role`.
2. **`apps/api/prisma/migrations/20260829090000_add_role_is_active/migration.sql`** — `ALTER TABLE "identity"."roles" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;`.
3. **`apps/api/prisma/seed.ts`** — add `"role:create"`, `"role:update"`, `"role:assign-permissions"` to `PERMISSION_CATALOG` (no `ROLE_GRANTS` edit needed — `SuperAdmin: PERMISSION_CATALOG` picks them up automatically; `Agent: []` unchanged).
4. **`apps/api/src/modules/identity/dto/create-role.dto.ts`** (new) — `CreateRoleDto { name: string }` (`@IsString @IsNotEmpty`).
5. **`apps/api/src/modules/identity/dto/update-role.dto.ts`** (new) — `UpdateRoleDto { name?: string; isActive?: boolean }`.
6. **`apps/api/src/modules/identity/dto/set-role-permissions.dto.ts`** (new) — `SetRolePermissionsDto { permissionKeys: string[] }` (`@IsArray @IsString({ each: true })`, no `@ArrayNotEmpty` — an empty array is a valid, legitimate "revoke everything" request).
7. **`apps/api/src/modules/identity/identity.service.ts`**:
   - `RoleSummary` gains `isActive: boolean`.
   - `listRoles(includeInactive = false)`: conditionally drops the `isActive: true` filter, mirroring `listBranches`/`listDepartments`.
   - New `PROTECTED_ROLE_NAMES = new Set(["SuperAdmin", "Agent"])` constant.
   - `createRole(dto)`: creates with `name` only; P2002 → `ConflictException` via new `translateDuplicateRoleName`.
   - `updateRole(id, dto)`: 404 if unknown id; 400 (`BadRequestException`) if the target is a protected role and `dto.name`/`dto.isActive` is present; otherwise conditional-spread update; P2002 → `ConflictException`.
   - `setRolePermissions(id, dto)`: 404 if unknown role id; validates every `permissionKeys` entry exists in `Permission` (400 listing any unknown keys); replaces `RolePermission` rows for that role in one `$transaction` (`deleteMany` + conditional `createMany`), allowed on every role including protected ones.
8. **`apps/api/src/modules/identity/users.controller.ts`**:
   - `GET roles` gains `@Query("includeInactive") includeInactive?: string`, forwarded as `includeInactive === "true"`.
   - New `POST roles` (`@RequirePermissions("role:create")`), `PATCH roles/:id` (`@RequirePermissions("role:update")`), `PATCH roles/:id/permissions` (`@RequirePermissions("role:assign-permissions")`), each returning `{ id: string }`.
   - Update the class doc comment: Role/Permission mutation is no longer entirely out of scope — Story 46 adds Role create/rename/activate-deactivate and permission assignment (for any role including `SuperAdmin`/`Agent`); Permission rows themselves remain immutable/read-only, and `SuperAdmin`/`Agent` cannot be renamed/deactivated.
9. **Tests** (see Test Plan below) in `identity.service.spec.ts` and `identity.e2e-spec.ts`.

### Frontend

10. **`apps/web/src/lib/roles-api.ts`** (modified) — `RoleSummary` gains `isActive: boolean`; add `listManagedRoles()` (`GET /identity/roles?includeInactive=true`), `createRole(input)`, `updateRole(id, input)`, `setRolePermissions(id, input)` — every mutation returns `{ id }` only, matching this codebase's universal mutation-response shape.
11. **`apps/web/src/hooks/use-roles.ts`** (modified) — add `useManagedRolesQuery()` (key `["managed-roles"]`), `useCreateRoleMutation()`, `useUpdateRoleMutation(id)`, `useSetRolePermissionsMutation(id)` — every mutation hook invalidates `["managed-roles"]` on success only, never optimistic. `useRolesQuery()`/`usePermissionsQuery()` unchanged.
12. **`apps/web/src/components/roles/role-list-view.tsx`** (modified) — roles section switches to `useManagedRolesQuery()`; `RoleRow` becomes a dedicated component with blur-commit rename (skipped for protected roles), activate/deactivate toggle (skipped for protected roles), and a permission-checkbox list against the full catalog; add `AddRoleForm` (one-field inline create, mirrors `AddDepartmentForm`); extend error handling to the 3-way split (§ Design item 12).
13. **i18n** — `apps/web/messages/en.json`/`ar.json`: extend the existing `roles.list.*` block with `createHeading`/`createPlaceholder`/`createSubmit`/`createSubmitting`/`createFailed`, `systemRole`, `active`/`inactive`/`activate`/`deactivate`, `actionForbidden`/`actionFailed`, `permissionsAssignHeading` — additive only, no existing key renamed or removed.
14. **Tests** — `apps/web/src/components/roles/role-list-view.spec.tsx` (modified, see Test Plan).

---

## Edge Cases & Failure Modes

- **Attempting to rename or deactivate `SuperAdmin`/`Agent`**: `400 BadRequestException`, never a raw 500 or a silent no-op.
- **Duplicate role name on create or rename**: `409 ConflictException` via the existing `Role.name` unique constraint, now wired to a translator.
- **Unknown permission key(s) in `setRolePermissions`**: `400 BadRequestException` naming exactly which key(s) are invalid; no partial write occurs (the validation runs before the transaction).
- **Revoking every permission from a role** (`permissionKeys: []`): valid; the role ends up with zero grants (this is exactly how `Agent` starts today) — no special-case rejection.
- **A user's role is deactivated while they're logged in**: no effect on their session — deactivation never touches `UserBranchRole` or permission resolution, only future-assignment visibility.
- **A permission is revoked from a role a logged-in user holds**: their very next request re-resolves permissions fresh from the DB and reflects the change immediately — no logout/refresh required.
- **A custom role is renamed while a holder has a live access token**: that user's permission checks fail (403) on every route until their token is refreshed/reissued — a disclosed, fail-safe, self-healing edge case, not fixed by this story.
- **No token on any new route**: `401`. **Agent-role user (lacks `role:create`/`role:update`/`role:assign-permissions`)**: `403` on each respective route.

---

## Test Plan

1. **Backend unit** (`identity.service.spec.ts`): `createRole` (success, duplicate → 409); `updateRole` (success, not-found → 404, protected-role rename/deactivate → 400, duplicate → 409); `setRolePermissions` (success with exact transaction-call assertions, empty-array revoke-all, unknown-key → 400, not-found → 404, explicitly allowed on `SuperAdmin`/`Agent`); `listRoles` includeInactive default/true behavior.
2. **Backend e2e** (`identity.e2e-spec.ts`): 401/403 per new route/permission key; SuperAdmin full lifecycle (create → rename → assign permissions → deactivate → confirm excluded from default listing, included with `includeInactive=true` → reactivate); duplicate name → 409; unknown permission key → 400; protected-role rename/deactivate → 400; **assign a new permission to `Agent`, then log in as a real Agent-role user and confirm the newly granted route now returns 200 on the very next request** (the core end-to-end proof of dynamic permission resolution).
3. **Frontend component** (`role-list-view.spec.tsx`): all existing tests preserved unweakened; plus create-role form (disabled-until-filled, exact payload, duplicate-name 409 message preserved, generic fallback, pending state); rename-on-blur + no-op-when-unchanged for a custom role; activate/deactivate toggle for a custom role; protected-role UI (no editable name field, no activate/deactivate button for `SuperAdmin`/`Agent`); permission-checkbox toggle (add and remove) asserting the exact `permissionKeys` array sent; 3-way error-message split; bilingual rendering of new strings.
4. **Regression**: `create-user-view.spec.tsx` and `workspace-nav.spec.tsx` require zero new test cases and must remain green unmodified.
5. **Full workspace regression**: `apps/api`, `apps/web`, `apps/worker` suites, plus typecheck/lint/build across the workspace.

---

## Migration / Rollback

One migration: `20260829090000_add_role_is_active` — adds `is_active` (`NOT NULL DEFAULT true`) to `identity.roles`. Purely additive and backward-compatible; both seeded rows (`SuperAdmin`, `Agent`) backfill to `true` automatically. No existing constraint is added or altered (the `name` unique index already existed). Rollback, if ever needed, is a reverse migration dropping the column plus a plain code revert of every file in Implementation Tasks — no down-migration tooling exists in this repo by established convention, and this change is safely forward-only.

---

## Verification Steps

1. `pnpm --filter @crm/api typecheck`/`lint`/`test`; `pnpm --filter @crm/web typecheck`/`lint`/`test`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/api prisma:seed` (idempotent — adds the three new permission rows to the catalog, backfills `Role.isActive` for seeded rows).
3. `pnpm --filter @crm/api test:e2e` — requires Docker/Postgres reachable (unreachable in this session's environment as of this writing; disclose honestly if still unreachable at implementation time rather than fabricating results).
4. Live infra (if available): create a custom role, assign it two permissions, deactivate it, confirm it disappears from `CreateUserView`'s role picker while still visible/reactivatable on `/roles`; revoke a permission from `Agent` mid-session for a logged-in Agent user and confirm the very next request reflects it.
5. `git status`; confirm every module unrelated to identity/roles has an empty diff.

## Done Criteria

- [ ] `Role.isActive` added via migration; `Role.name`'s pre-existing uniqueness now backed by a `409` translator.
- [ ] `role:create`, `role:update`, `role:assign-permissions` exist in the seed catalog; `Agent` unchanged; `SuperAdmin` covers them automatically.
- [ ] `POST /identity/roles`, `PATCH /identity/roles/:id`, `PATCH /identity/roles/:id/permissions` exist; no `DELETE` route added anywhere.
- [ ] `SuperAdmin`/`Agent` cannot be renamed or deactivated; permission assignment works on all roles including these two.
- [ ] `GET /identity/roles` defaults to active-only; `includeInactive=true` surfaces inactive roles; `CreateUserView` unchanged.
- [ ] Permission revocation is proven dynamic end-to-end (e2e test).
- [ ] `/roles` screen extended in place with create/rename/activate-deactivate/permission-assignment, following established admin-CRUD conventions.
- [ ] English and Arabic translations exist for every new string.
- [ ] All listed backend/frontend tests exist and pass; `create-user-view.spec.tsx`/`workspace-nav.spec.tsx` remain green, unmodified.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status --short` clean at the end (implementation not yet committed).

---

## Non-Goals (explicit)

- Creating, deleting, or renaming `Permission` rows, or accepting any client-defined permission key — the catalog stays code-defined.
- User↔Role/Branch/Department reassignment; any change to `UserBranchRole`.
- Renaming or deactivating `SuperAdmin`/`Agent` (permission assignment on them is explicitly in scope; rename/deactivate is not).
- Any hard-delete of a Role.
- Fixing the by-name (vs. by-id) JWT/`PermissionsGuard` matching design — disclosed as a known edge case, not addressed here.
- Any change to Branch/Department, tickets, customers, or navigation.
- Ticket/conversation work, Customer Portal, Channels, Knowledge Base, AI, Reporting, Integrations.
- Any README change.
- Any unrelated refactoring.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
