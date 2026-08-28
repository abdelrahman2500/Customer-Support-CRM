# Story 47 — Agent Workspace: Reassign an Existing User's Role and Department, Admin Self-Service

## Prerequisites

- `project-foundation` Story 02/03: `UserBranchRole`, `TenantContext`, and `createUser`'s existing assignment-writing transaction, all extended here.
- `agent-workspace-user-admin` Story 32/38: `UserListView`/`CreateUserView`, `UpdateUserDto`, and the existing `useUsersQuery()`/`useUpdateUserMutation()` hooks this story extends in place.
- `agent-workspace-branch-department-admin` Story 45: the active-only Department picker (`useDepartmentsQuery()`) and the own-branch scoping convention (`TenantContext.requireBranchScope()` + `findFirst({ where: { id, branchId } })`) this story reuses exactly.
- `agent-workspace-role-permission-management` Story 46: the active-only Role picker (`useRolesQuery()`), and the precedent of splitting a more security-sensitive action into its own permission key (`role:assign-permissions` vs. `role:update`) that this story's `user:reassign` key follows.

---

## Story Goal

Let an admin (holding a new, dedicated permission) change an **existing** user's Role and/or Department — both within the caller's own branch — from the existing `/users` screen. This closes the one remaining gap in the identity/admin arc Stories 32→46 have built: today a user's `UserBranchRole` assignment is fixed forever at creation time; `updateUser` only ever touches `fullName`/`isActive`.

**Not in scope**: reassigning a user to a **different Branch** (see Design item 2 — this would require cross-branch administration capability this codebase has never built and has explicitly declined to build at every prior opportunity); adding a second/additional `UserBranchRole` membership (see Design item 1); branch-switching UI or any change to how `branchRoles[0]` is selected for auth purposes; Role/Permission CRUD (Story 46, untouched) or Branch/Department CRUD (Story 45, untouched).

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `UserBranchRole`'s exact shape: `@@unique([userId, branchId, departmentId, roleId])` (all four columns together, not any subset — nothing prevents multiple rows per user, though only `createUser` ever writes one, exactly once, today), `departmentId String?` (nullable — a role can be branch-wide with no department).
2. `apps/api/src/modules/identity/identity.service.ts` — `createUser`'s transaction (the only production write site for `UserBranchRole`, deliberately unrestricted to any branch — its own doc comment says so explicitly); `updateUser` (confirm it touches only `fullName`/`isActive`); `issueAccessToken`/`getAuthenticatedUser`/`login`/`refresh` (all four independently re-derive `branchRoles` via `include: { branchRoles: { include: { role: true }, orderBy: { createdAt: "asc" } } }` and take `[0]` as "active" — the single most important piece of evidence behind this story's Design decisions); `listUsers` (already scoped to the caller's own branch via `TenantContext.requireBranchScope()`, unlike `createUser`).
3. `apps/api/src/modules/tickets/tickets.service.ts` — its private `requireUserInScope(userId, branchId)` helper (`userBranchRole.findFirst({ where: { userId, branchId } })` → `NotFoundException("User not found in this branch")`) and its own, differently-shaped `requireDepartmentInScope(departmentId, branchId)` (takes `branchId` as an explicit parameter, unlike `identity.service.ts`'s own private version which pulls it from `TenantContext`) — both are the exact patterns this story's new scoping checks mirror.
4. Story 45/46's exact scoping/validation/error-translation patterns in `identity.service.ts`: `updateBranch`'s identity-comparison scope check, `updateDepartment`'s `requireDepartmentInScope`, `setRolePermissions`'s "fetch all requested rows, compare counts, name the missing ones in a 400" existence-validation pattern (the closest template for validating a target role/department exist and are active), and every `translateDuplicate<X>Name` P2002 translator.
5. `apps/web/src/components/users/user-list-view.tsx` and its spec — the existing screen this story extends; `UserRow`'s current two mutations (blur-commit rename, activate/deactivate toggle) and its purely-read-only `roles: string[]` badge rendering.
6. `apps/web/src/components/users/create-user-view.tsx` — the only existing precedent for a Branch/Department/Role `Select` anywhere in this codebase (used at creation time, never for editing an existing row) — this story's inline row-level `Select` markup is adapted from here, since no row-level `Select` precedent exists anywhere else.
7. `docs/architecture/04-data-and-multitenancy.md` — *"Users may belong to multiple branches/departments with different roles"* (the multi-role architecture this story's edit-in-place decision deliberately does not disturb) and *"Cross-branch access is an explicit, audited permission, never a default"* (the principle behind excluding Branch reassignment from this story, Design item 2).

---

## Design decisions

### 1. UserBranchRole semantics — resolved as edit-in-place

**Decision: modify the user's existing first/active `UserBranchRole` row in place (a plain `UPDATE` on its `roleId`/`departmentId` columns). Never add a second row. Never delete-then-recreate.**

Evidence, not assumption:
- `createUser` writes exactly one `UserBranchRole` row per user, and no other production code path writes a second one — in practice, every user has exactly one row today.
- `login`, `refresh`, and `getAuthenticatedUser` all three independently re-fetch `branchRoles` ordered `createdAt: "asc"` and take `[0]` as the token's/session's active context. This is load-bearing, real behavior, not an incidental detail.
- **Additive-row semantics rejected**: a second row would not match this story's own goal ("modify an existing assignment," not "grant an additional one"), and — because it wouldn't be `branchRoles[0]` — would create a membership the affected user could never actually operate under without the branch-switching UI this codebase has explicitly, repeatedly deferred (`issueAccessToken`'s own comment: *"no branch-switching UI yet... future work"*). This isn't a stylistic preference; an additive row would be a real, silent bug under the existing auth-selection rule.
- **Delete-then-recreate rejected**: a freshly created replacement row gets a new `createdAt`, which could change which row is `[0]` if a user ever holds more than one (not producible today, but not schema-prevented) — a plain `UPDATE` has zero such risk and preserves the row's identity/history.
- If a user is ever found holding more than one `UserBranchRole` row, this story edits only the first/active one (`orderBy: { createdAt: "asc" }`, take index 0) — managing any additional memberships is explicitly out of scope, tied to the separately-deferred multi-role/branch-switching direction.

### 2. Branch reassignment — excluded, evidence-grounded, not silently reduced

The story's plain-language goal names "Role, Branch, and Department." Investigation shows reassigning a user **to a different Branch** cannot be built inside this story's own scope discipline: `createUser` today assigns a new user to *any* branch, completely unrestricted, by explicit, documented design — but every mutation built since (`updateBranch`, `updateDepartment`, `updateRole`, Stories 45/46) is strictly scoped to the caller's own branch, and the architecture doc states outright: *"Cross-branch access is an explicit, audited permission, never a default."* Letting this story move a user **into** a different branch would mean building exactly the cross-branch administration capability this codebase has declined to build at every prior opportunity (Story 35, 45) — i.e., real "active-context selection"/"branch switching" territory, which the approved scope explicitly prohibits expanding into.

**Resolution: Story 47 covers Role reassignment (org-wide catalog, matching Story 46) and Department reassignment (within the user's — and caller's — own current branch, matching Story 45's scoping). It does not cover reassigning a user to a different Branch.** This is a disclosed boundary, not an invented shortcut — `createUser`'s existing any-branch behavior is left completely untouched and unexplained by this story (a pre-existing inconsistency in the codebase, noted but not fixed here, since fixing it is unrelated to this story's own goal).

### 3. Permission model

New key: **`user:reassign`**. `user:update` is completely untouched — it keeps meaning exactly what it means today (`fullName`/`isActive` only). `user:reassign` is granted to `SuperAdmin` automatically (existing `ROLE_GRANTS.SuperAdmin = PERMISSION_CATALOG` reference — zero manual edit needed); `Agent` unchanged (`[]`).

**Why a distinct key, not folded into `user:update`**: the `Permission.key` field's own doc comment in `schema.prisma` already anticipates this exact shape (`key String @unique // e.g. "ticket:reassign"`), and Story 46 already established the precedent for splitting a materially more privilege-affecting action into its own key (`role:assign-permissions` vs. `role:update`). Reassigning a user's role/department is the same category of risk — it can grant a user a different department's ticket visibility or a more powerful role entirely — so it follows the identical reasoning and naming shape.

### 4. Read-side change required to make the edit UI possible

`GET /identity/users` (`listUsers`) today returns only `roles: string[]` — deduplicated role **names**, no singular current role/department, no `UserBranchRole` row id. There is no way for a frontend edit control to know what to pre-select. `UserSummary` gains `roleId: string` and `departmentId: string | null`, both derived from the same `branchRoles[0]` selection already used elsewhere (requires adding `orderBy: { createdAt: "asc" }` to `listUsers`'s existing nested `include`, which currently has none — a small, disclosed, necessary addition for correctness/consistency with `login`/`refresh`).

### 5. Existence, active-state, and scoping validation

Mirrors `setRolePermissions`'s "fetch, compare, name what's missing" pattern and `updateDepartment`'s `requireDepartmentInScope`:
- Target role: `role.findUnique({ where: { id: dto.roleId } })` → 404 if missing; `role.isActive === false` → 400 ("Cannot assign an inactive role").
- Target department (when `dto.departmentId` is a real id, not `null`): `department.findFirst({ where: { id: dto.departmentId, branchId } })` → 404 if missing/out-of-scope (this single query both validates existence AND that the department belongs to the caller's own branch — mirroring `requireDepartmentInScope` exactly); `isActive === false` → 400.
- Target user must already hold a membership in the caller's own branch: `userBranchRole.findFirst({ where: { userId: id, branchId }, orderBy: { createdAt: "asc" } })` → 404 ("User not found in this branch," reusing `tickets.service.ts`'s own `requireUserInScope` wording) if none.

### 6. Last-SuperAdmin lockout guard (recommended, evidence-adjacent)

Unlike Branch self-deactivation (proven harmless in Story 45, since nothing checks `Branch.isActive` in the auth path), reassigning a user's role **does** eventually change their real, effective permissions once their token refreshes. If the target membership's current role is `SuperAdmin` and the requested change would move it away, and no *other* active user holds an active `SuperAdmin` membership anywhere in the system, reject with `400 BadRequestException("Cannot reassign the last SuperAdmin user")` — mirroring Story 46's "protect against unrecoverable lockout" philosophy (which protects the `SuperAdmin` *role record* from deactivation) applied here to protect the last living holder of it.

### 7. Disclosed, carried-over edge case (unchanged from Story 46, not re-litigated)

`PermissionsGuard` matches permissions via `Role.name` embedded in the JWT at issuance, re-resolved fresh from the DB on every request. Reassigning a user's role takes effect for that specific user starting from their next token refresh/login — not instantly on their currently-live token, since the JWT's `roles: string[]` claim doesn't change until reissued. This is the same fail-safe (deny-direction is irrelevant here since it's a grant, not a deny) self-healing dynamic already disclosed and accepted in Story 46; not re-solved or re-litigated here.

---

## Backend implementation tasks

1. **`apps/api/src/modules/identity/dto/update-user-assignment.dto.ts`** (new):
```ts
export class UpdateUserAssignmentDto {
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() roleId?: string;
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.departmentId !== null)
  @IsUUID()
  departmentId?: string | null;
}
```
2. **`apps/api/prisma/seed.ts`** — add `"user:reassign"` to `PERMISSION_CATALOG` (grouped with the existing `user:*` keys); no `ROLE_GRANTS` edit needed.
3. **`apps/api/src/modules/identity/identity.service.ts`**:
   - `UserSummary` gains `roleId: string`, `departmentId: string | null`.
   - `listUsers()`'s nested `branchRoles` include gains `orderBy: { createdAt: "asc" }`; mapped result derives `roleId`/`departmentId` from `user.branchRoles[0]`.
   - New `updateUserAssignment(id: string, dto: UpdateUserAssignmentDto): Promise<{ id: string }>` implementing Design items 5–6, then `prisma.userBranchRole.update({ where: { id: membership.id }, data: { ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}), ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}) } })`, P2002 → `ConflictException("This user already has this exact assignment")`.
4. **`apps/api/src/modules/identity/users.controller.ts`** — new `PATCH users/:id/assignment` (`@RequirePermissions("user:reassign")`), body `UpdateUserAssignmentDto`, returns `{ id }`. Update the class doc comment to record this story's addition (mirroring how the comment was updated for Stories 45/46).
5. **Tests** — see Test Plan.

## Frontend implementation tasks

6. **`apps/web/src/lib/tickets-api.ts`** — `UserSummary` gains `roleId: string`, `departmentId: string | null` (additive); new `updateUserAssignment(id, input: { roleId?: string; departmentId?: string | null }): Promise<{ id: string }>`.
7. **`apps/web/src/hooks/use-tickets.ts`** — new `useUpdateUserAssignmentMutation(id: string)`, never-optimistic, invalidates `["users"]` on success.
8. **`apps/web/src/components/users/user-list-view.tsx`** — `UserRow` gains two inline `Select` controls (role, department), populated from the existing, **unchanged** `useRolesQuery()`/`useDepartmentsQuery()` (both already active-only, and departments already scoped to the caller's own branch — exactly matching this story's needs with zero picker changes). `onValueChange` commits immediately via `useUpdateUserAssignmentMutation(user.id).mutate(...)` (mirrors the existing activate/deactivate button's immediate-commit-on-click, not the blur-commit text-input pattern, since a `Select` has no natural "blur to confirm" moment). Error handling extends the existing 403-vs-generic split to also show a `400`'s real message verbatim (mirroring Story 46's 3-way pattern) for the inactive-role/department and last-SuperAdmin cases.
9. **i18n** — extend the existing `users` namespace in `en.json`/`ar.json` (additive): `list.roleLabel`, `list.departmentLabel`, `list.noDepartment`, plus reuse of the existing `list.actionForbidden`/`actionFailed` keys for the 403/generic cases and a new `list.actionFailed` fallback already covers the true-generic path (the 400 cases render the backend's own message verbatim, needing no new translation key).
10. **Tests** — `user-list-view.spec.tsx` (modified, see Test Plan).

---

## API contract

`PATCH /identity/users/:id/assignment` — `@RequirePermissions("user:reassign")` — body `{ roleId?: string; departmentId?: string | null }` — returns `{ id: string }`.
- 401 no token. 403 caller lacks `user:reassign`.
- 404 if `:id` isn't a user with a membership in the caller's own branch.
- 404 if `roleId` doesn't exist; 404 if `departmentId` doesn't exist or isn't in the caller's own branch.
- 400 if the target role/department is inactive; 400 if this would reassign the last SuperAdmin user away from SuperAdmin.
- 409 on a genuine P2002 (defensive — unlikely in the single-row-per-branch common case).

`GET /identity/users` — unchanged route/permission (`user:read`), response additively gains `roleId`/`departmentId` per user.

---

## Validation/scoping rules (summary)

Own-branch-only, on both the target user and the target department (role is org-wide, matching Story 46). No branch field accepted in the DTO at all — Branch reassignment is not exposed as an option, not merely unvalidated.

---

## Error behavior

| Condition | Status | Message |
|---|---|---|
| No token | 401 | — |
| Missing `user:reassign` | 403 | "Missing required permission" (existing guard message, unchanged) |
| User has no membership in caller's branch | 404 | "User not found in this branch" |
| Unknown `roleId` | 404 | "Role not found" |
| Unknown/out-of-branch `departmentId` | 404 | "Department not found" |
| Inactive role | 400 | "Cannot assign an inactive role" |
| Inactive department | 400 | "Cannot assign an inactive department" |
| Last SuperAdmin reassigned away | 400 | "Cannot reassign the last SuperAdmin user" |
| Duplicate exact assignment (P2002) | 409 | "This user already has this exact assignment" |

---

## UI behavior

Two new inline `Select`s per user row (role, department — department shows a "No department" option mirroring `CreateUserView`'s `UNSET_DEPARTMENT` sentinel), pre-populated from `user.roleId`/`user.departmentId`, committing immediately on change. No branch field/picker rendered at all (Design item 2). Errors render inline below the row, extending the existing 403-vs-generic split to a 3-way split (403 → forbidden copy; any other `ApiError` → its own message verbatim; else → generic fallback), matching Story 46's established pattern.

---

## i18n

Additive-only keys under the existing `users` namespace in both `en.json`/`ar.json`: `list.roleLabel`, `list.departmentLabel`, `list.noDepartment`. No existing key renamed, removed, or restructured.

---

## Unit tests (`identity.service.spec.ts`)

`updateUserAssignment`: success (role only, department only, both, clear department to `null`); 404 user-not-in-caller's-branch; 404 unknown role; 404 unknown/out-of-branch department; 400 inactive role; 400 inactive department; 400 last-SuperAdmin guard (and a companion test proving it does NOT fire when another active SuperAdmin exists); 409 on P2002. `listUsers`: `roleId`/`departmentId` correctly derived from `branchRoles[0]` (add a case with a mocked multi-row `branchRoles` array to prove `[0]`-selection, not just the single-row common case).

## E2E tests (`identity.e2e-spec.ts`)

401/403 for `user:reassign`. SuperAdmin lifecycle: create an Agent user → reassign their department → reassign their role → confirm both via `GET /identity/users`. Inactive-role/department rejection (deactivate a role/department first via Stories 46/45's own endpoints, then attempt to assign it). Last-SuperAdmin guard (attempt to reassign the seeded SuperAdmin away when they're the only one — expect 400; then create a second SuperAdmin-role user and prove the same reassignment now succeeds). **Disclosed limitation, not fabricated**: a true cross-branch attempt cannot be tested end-to-end today — there is no second-branch fixture anywhere in this suite (no branch-create endpoint exists, exactly the same limitation Story 46 already disclosed for duplicate-branch-name testing) — this path is covered only at the unit level via a mocked `TenantContext`.

## Component tests (`user-list-view.spec.tsx`)

Renders the role/department `Select`s pre-populated with the user's current values; committing a role change and a department change (including clearing to "No department") fires the mutation with the exact payload; 403/400/409 inline messages (400 and 409 shown verbatim, 403 the existing forbidden copy); regression — every existing test (rename, activate/deactivate, loading/error/empty) remains green, unweakened.

## Regression requirements

`create-user-view.spec.tsx` needs zero new test cases (creation flow untouched). `workspace-nav.spec.tsx`, `role-list-view.spec.tsx`, `branch-departments-view.spec.tsx` untouched and must remain green.

---

## Migration requirements

**None.** No Prisma schema change of any kind — this story is pure application-layer logic over existing columns.

---

## Edge cases

- User with zero `UserBranchRole` rows in the caller's branch → 404, never a crash.
- `departmentId: null` explicitly clears a department (branch-wide role) — distinct from omitting the field (no-op).
- Reassigning a role/department to the exact value it already holds → succeeds as a no-op update (P2002 only fires on a genuine duplicate against a *different* row, which shouldn't be reachable in the single-row-per-branch case, but the translator exists defensively).
- A user reassigning their own role mid-session → no effect on their own already-issued token until refresh (Design item 7).

---

## Security risks/mitigations

- **Privilege escalation via assignment** — mitigated by a dedicated `user:reassign` permission, `SuperAdmin`-only initially, never bundled into plain `user:update`.
- **Cross-branch privilege escalation** — mitigated by scoping both the target user and target department to the caller's own branch, and by not exposing a branch field in the DTO at all (Design item 2).
- **Total SuperAdmin lockout** — mitigated by the last-SuperAdmin guard (Design item 6).
- **Assigning an inactive role/branch/department** — explicitly rejected with 400 (Design item 5), closing the gap `createUser` itself never validated.

---

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e   # requires Docker/Postgres — unreachable in this session's environment; disclose honestly if still unreachable at implementation time
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

---

## Done criteria

- [ ] `user:reassign` permission key exists; `user:update` unchanged in scope; `SuperAdmin` covers it automatically; `Agent` unchanged.
- [ ] `PATCH /identity/users/:id/assignment` exists, scoped to the caller's own branch, with no branch field accepted.
- [ ] `GET /identity/users` additively exposes `roleId`/`departmentId`.
- [ ] Inactive-role/department assignment rejected with 400; last-SuperAdmin reassignment rejected with 400.
- [ ] `/users` screen lets an admin change an existing user's role/department via inline Selects; no branch picker rendered.
- [ ] All listed tests exist and pass; `create-user-view.spec.tsx` and other admin screens' specs remain green, unmodified.
- [ ] No Prisma migration introduced.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean (not yet committed).

---

## Non-Goals (explicit)

- Reassigning a user to a different Branch (Design item 2).
- Adding a second/additional `UserBranchRole` membership (Design item 1).
- Branch-switching UI, active-context selection, or any change to `branchRoles[0]` selection logic.
- Redesigning `PermissionsGuard` or JWT claim shape.
- Role/Permission CRUD (Story 46) or Branch/Department CRUD (Story 45) — both untouched.
- Fixing `createUser`'s existing unrestricted-any-branch behavior (a disclosed, pre-existing inconsistency, not this story's job).
- Ticket/conversation work, Customer Portal, Channels, Knowledge Base, AI, Reporting, Integrations.
- Any README change.

---

## Dependencies

See Prerequisites. Hard sequencing: backend (DTO → service → controller) must land and be typechecked before the frontend `Select` controls can be wired against a real endpoint.

## Known blockers

Docker Desktop unreachable in this session's environment — e2e cannot be executed here; the suite is designed and will be disclosed as not-run, not fabricated, exactly as for Stories 45/46.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
