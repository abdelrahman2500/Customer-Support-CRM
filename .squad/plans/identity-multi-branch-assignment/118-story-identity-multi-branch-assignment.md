# Story 118 — Identity & Access: Multi-branch user assignment + branch switching

## Goal

Let a user actually hold, and switch between, more than one branch/
department/role membership — closing a gap self-disclosed four separate
times (Stories 02, 35, 47, 107) and already anticipated by
`UserBranchRole`'s schema and `JwtAccessTokenClaims`'s own doc comment,
but never actually built.

## Non-goals

- No Customer Portal / Contact change — Contacts have no role/branch
  -membership concept anywhere in this codebase; this is agent/admin
  tokens only.
- No simultaneous cross-branch data visibility. Switching branches is a
  full context change (a new access token with a different active
  `branchId`/`departmentId`) — never viewing more than one branch's data
  at once. `docs/architecture/04-data-and-multitenancy.md`'s "cross
  -branch access is explicit, audited, never a default" stays true:
  every request still resolves exactly one active branch via
  `TenantContext`, unchanged.
- No self-service branch-join request flow — granting a membership stays
  a SuperAdmin-initiated, `user:branch-assign`-gated action, the same
  trust tier as `user:create`/`user:reassign`.
- No change to `createUser`'s existing single-initial-membership
  behavior, or to `updateUserAssignment`'s existing same-branch-only
  scope (both continue to operate on the target user's *first* branch
  membership by creation order, exactly as today).
- No CASL adoption — a separate, narrower, value-free refactor (the
  functional capability CASL would provide, department/assignment
  -scoped checks, is already fully implemented and tested via hand
  -rolled service logic since Stories 68/69).

## Design

### Schema (`apps/api/prisma/schema.prisma`)

`User` gains two plain, nullable, unconstrained columns:

```prisma
activeBranchId     String? @map("active_branch_id")
activeDepartmentId String? @map("active_department_id")
```

No `@relation`/FK — mirrors `AuditLog.branchId`'s own existing "plain
reference column, no FK" precedent in this exact schema. `null` for
every existing user (the default, unchanged by this migration)
preserves today's exact `branchRoles[0]`-wins behavior byte-for-byte.
Resolution code (below) never trusts these columns' referential
integrity directly — it always re-validates against the user's live
`UserBranchRole` rows and silently falls back to `branchRoles[0]` if
the stored active membership no longer exists (self-healing, not a DB
constraint).

### Backend (`apps/api/src/modules/identity`)

**`issueAccessToken`** (private helper) gains a third parameter,
`active: { branchId: string | null; departmentId: string | null }`
(defaulting to `{ branchId: null, departmentId: null }` for the two
existing call sites that pass nothing new — see below). Resolution
becomes: look up a `branchRoles` entry matching `active.branchId`/
`active.departmentId` when `active.branchId` is non-null; otherwise (or
if no match — self-healing), fall back to `branchRoles[0]`, exactly as
today.

- **`login`**/**`refresh`** now pass `{ branchId: user.activeBranchId,
  departmentId: user.activeDepartmentId }` (both already present on the
  same `prisma.user.findUnique` call — no new query) instead of nothing
  — this is what makes a switched branch survive a silent token refresh
  (Story 41) instead of reverting to `branchRoles[0]` on the very next
  one.
- **New `switchActiveBranch(presentedRefreshToken, branchId,
  departmentId)`**: mirrors `refresh()`'s exact validation/rotation
  flow (hash the presented token, look up + validate the
  `RefreshToken` record, load the user + `branchRoles`), additionally:
  1. Validates `(branchId, departmentId)` matches an actual
     `UserBranchRole` the user holds — `NotFoundException` otherwise
     (mirrors this file's "not found over forbidden" convention;
     `ForbiddenException` appears nowhere in this codebase).
  2. Persists `activeBranchId`/`activeDepartmentId` on the `User` row.
  3. Rotates the refresh token exactly like `refresh()` (revoke +
     create, `replacedBy` linkage).
  4. Issues a new access token via `issueAccessToken(..., { branchId,
     departmentId })`.
  5. Records an `auth.branch_switched` audit entry (before/after
     `branchId`/`departmentId` diff) — mirrors Story 84's
     `auth.login`/`auth.logout` convention.
- **New `listMyBranchMemberships()`**: every `UserBranchRole` the caller
  (`TenantContext.userId`) holds, with branch/department/role names
  (joined), flagging which one matches the *current* token's active
  `branchId`/`departmentId` (`TenantContext.branchId`/`.departmentId`).
  No new permission — the caller's own data, mirrors `/auth/me`'s
  existing no-extra-permission precedent.
- **New `grantBranchAssignment(userId, dto: { branchId, departmentId?,
  roleId })`**: resolves the granting admin's own organization (mirrors
  `createBranch`'s exact pattern), validates the target user exists,
  the target `branchId` belongs to that same organization
  (`NotFoundException` otherwise — never trust a client-supplied branch
  id blindly), the target `departmentId` (if given) belongs to that
  target branch, and the target `roleId` is an existing, active role
  (mirrors `updateUserAssignment`'s exact role/department validation,
  lines 428-444 of the pre-Story-118 file). An explicit pre-check
  (`findFirst` on the exact tuple) rejects a duplicate exact assignment
  BEFORE the `create` call — discovered while writing this story's own
  e2e coverage: Postgres unique constraints treat every `NULL` as
  distinct from every other `NULL`, so `@@unique([userId, branchId,
  departmentId, roleId])` alone never rejects a second identical
  branch-wide (no-department) grant, the common case for a cross-branch
  assignment. The already-existing `translateDuplicateUserAssignment`
  helper (same constraint, same message) remains as race-window
  defense-in-depth on the `create` call itself, mirroring `createUser`'s
  own identical "pre-check + P2002 catch" precedent for duplicate
  emails. Records a `user.branch_assignment_granted` audit entry, tagged
  with the ADMIN's OWN acting branch (not the cross-branch target) —
  `AuditLogsService.listAuditLogs` scopes by the caller's own active
  branch, so tagging the target would make the granting admin's own
  action invisible in their own audit trail; the target
  branch/department/role are still fully captured in the entry's `diff`.

New permission: `user:branch-assign`, added only to `PERMISSION_CATALOG`
(SuperAdmin auto-inherits via the full catalog; not added to Agent's
grant list) — mirrors `branch:create`'s exact precedent.

New routes:
- `IdentityController` (the `auth/*` session controller — the cookie
  path constraint above is why this lives here, not in
  `UsersController`): `POST auth/switch-branch` (`@Public()`, reads the
  refresh cookie, sets a new one), `GET auth/me/branches` (regular
  `AuthGuard`, no extra permission).
- `UsersController` (`identity/*`): `POST
  identity/users/:id/branch-assignments`, gated by `user:branch-assign`.

### Frontend (`apps/web`)

- `src/lib/api.ts` gains `switchBranch(branchId, departmentId)` —
  mirrors `refreshAccessToken()`'s exact raw-`fetch`/`credentials:
  "include"`/`setAccessToken` pattern (a `/auth/*`, cookie-authenticated
  call, not routed through the standard `apiFetch` Bearer-token
  wrapper).
- New `src/lib/branch-memberships-api.ts` + `src/hooks/use-branch-memberships.ts`:
  `listMyBranchMemberships()`/`useMyBranchMembershipsQuery()` (a normal
  Bearer-authenticated `GET`, through `apiFetch`, mirroring every other
  dedicated-API-client-file convention in this codebase, e.g.
  `reporting-api.ts`).
- `workspace-nav.tsx`'s header gains a branch-switcher `<select>` next
  to "signed in as", rendered only when `useMyBranchMembershipsQuery()`
  returns more than one row — an existing single-membership user (every
  user today) sees no new UI at all. Selecting a different membership
  calls `switchBranch`, then clears the query cache
  (`clearQueryCache()`, Story 95's existing helper — every branch
  -scoped query is now stale for the new active branch) and reloads the
  current route.

## Acceptance criteria

- [ ] `User.activeBranchId`/`activeDepartmentId` added (nullable, no
      FK); every existing login/refresh/`getAuthenticatedUser`/
      `listUsers` call, for a user who has never switched, behaves
      byte-for-byte identically to before (still `branchRoles[0]`).
- [ ] `POST auth/switch-branch` validates the requested membership,
      persists it, rotates the refresh token, and returns a fresh
      access token whose claims reflect the new active branch/
      department/roles.
- [ ] A switched user's *next* silent `/auth/refresh` call (Story 41)
      still reflects the switched branch, not `branchRoles[0]` — the
      actual correctness bar this story exists to clear.
- [ ] `GET auth/me/branches` lists every membership the caller holds,
      correctly flagging the currently-active one.
- [ ] `POST identity/users/:id/branch-assignments` (SuperAdmin-only via
      `user:branch-assign`) grants an additional membership, validated
      against the granting admin's own organization; a duplicate exact
      tuple 409s; an inactive role/department 400s; a target user in
      another organization's branch 404s.
- [ ] `apps/web`'s workspace nav shows a branch switcher only for a
      user with more than one membership; switching updates the active
      session and reloads branch-scoped data.
- [ ] Unit coverage: `issueAccessToken`'s active-membership resolution
      (explicit match, no match/self-heal, no override); `switchActiveBranch`
      (valid switch, unknown membership, token rotation, audit diff);
      `grantBranchAssignment` (success, cross-org rejection, inactive
      role/department, duplicate tuple).
- [ ] e2e coverage: grant a second branch membership to a user, switch
      to it, confirm the new access token's claims and a subsequent
      refresh both reflect the switched branch; confirm a non
      -SuperAdmin cannot grant; confirm switching to a membership never
      granted 404s.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures (CLAUDE.md §13).

## Verification plan

```
cd apps/api && npx prisma migrate dev --create-only --name add_user_active_branch
cd apps/api && npx prisma migrate deploy
pnpm --filter @crm/api exec vitest run src/modules/identity
npx vitest run test/identity.e2e-spec.ts test/multi-branch-assignment.e2e-spec.ts --no-file-parallelism   # from apps/api, .env sourced
pnpm --filter @crm/web exec vitest run src/components/workspace src/hooks/use-branch-memberships.spec.ts
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full sweep
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
