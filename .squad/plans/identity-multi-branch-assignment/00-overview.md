# identity-multi-branch-assignment — plan overview

Entry point for the **identity-multi-branch-assignment** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 118 | [118-story-identity-multi-branch-assignment.md](./118-story-identity-multi-branch-assignment.md) | Identity & Access — Multi-branch user assignment + branch switching | — | Story 02/35/47/107 (the four prior stories that each explicitly deferred this) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 117, from a
  clean slate — every previously-identified backlog candidate had
  shipped. This is the fourth gap found this session by the same
  pattern (a documented mechanism/guarantee named in the architecture
  docs, or explicitly flagged as deferred in a prior story's own doc
  comment, that was never actually built) that also surfaced Stories
  115, 116, and 117.
- **The gap, confirmed directly, self-disclosed four separate times**:
  `UserBranchRole`'s own `@@unique([userId, branchId, departmentId,
  roleId])` constraint already supports multiple rows per user, and
  `docs/architecture/05-auth-and-security.md` states "users can have
  different roles by branch/department" as an architectural given — but
  every write path (`createUser`, `updateUserAssignment`) only ever
  creates/edits exactly one row, and every read path (`login`,
  `refresh`, `getAuthenticatedUser`, `listUsers`) hard-codes
  `branchRoles[0]` as "the" active membership. Four prior stories each
  explicitly named this as deferred, not forgotten:
  - Story 02/foundation's `issueAccessToken`: *"a user can hold roles in
    multiple branches/departments; this foundation story has no
    branch-switching UI yet... future work, not a gap introduced here."*
  - Story 35's `BranchSummary`: *"no story has decided a cross-branch
    listing/branch-switching UI yet."*
  - Story 47's `updateUserAssignment`: *"reassigning a user to a
    different branch is explicitly out of scope."*
  - Story 107's `UsersController`: *"a cross-branch listing/switching UI
    remains a separate, future story."*
  Even `JwtAccessTokenClaims`'s own doc comment (`packages/shared/src/jwt.ts`)
  already anticipated this: *"Active branch for this session, or null
  if not yet selected/applicable."*
- **Why not externally blocked**: purely internal Identity & Access
  work, using already-decided primitives (JWT claims, `TenantContext`,
  the existing `UserBranchRole` schema, the existing audit-log
  convention). No external provider/credential decision needed.
- **Design decisions this story makes** (resolving what the four prior
  stories deferred, not re-deferring it further):
  - **Persisting the "active" choice durably across token refresh** —
    the one correctness gap the initial Recon's own sketch did not
    address: `refresh()` re-derives the active membership from the
    *database* on every call (never from anything encoded in the
    opaque refresh-token record itself), so a "switch branch" action
    that only reissues one access token would silently revert to
    `branchRoles[0]` on the next silent refresh (Story 41). Two new
    plain, unconstrained nullable columns on `User` —
    `activeBranchId`/`activeDepartmentId` — record the last explicit
    switch; `null` (every existing user, unchanged) preserves today's
    exact `branchRoles[0]`-wins behavior. Mirrors `AuditLog.branchId`'s
    own existing "plain reference column, no FK" precedent (self-healing
    is handled in code — see below — not by a DB constraint): if a
    user's stored active membership is later removed, resolution
    silently falls back to `branchRoles[0]` rather than erroring.
  - **The switch-branch endpoint lives under `/auth`, not `/identity`**
    — the refresh-token cookie `IdentityController.setRefreshCookie`
    sets is scoped to `path: "/api/v1/auth"`; a route outside that
    prefix would never actually receive the cookie the switch itself
    needs to identify the caller and rotate. `POST /auth/switch-branch`
    mirrors `POST /auth/refresh`'s exact shape (reads the cookie,
    `@Public()`, no Bearer token required — the refresh token alone is
    the credential), additionally validating the requested membership
    and persisting it as the new `activeBranchId`/`activeDepartmentId`
    before reissuing.
  - **Granting an additional membership is a separate, SuperAdmin-only,
    audited action** — `POST identity/users/:id/branch-assignments`,
    gated by a new `user:branch-assign` permission (mirrors
    `branch:create`'s exact "new key, SuperAdmin-only via the full
    catalog, not added to Agent's grant list" precedent) — cross-branch
    access must stay "an explicit, audited permission, never a default"
    (`docs/architecture/04-data-and-multitenancy.md`), so this is
    deliberately not folded into `updateUserAssignment` (which stays
    same-branch-only, unchanged). The target branch is validated to
    belong to the *granting admin's own organization* (mirrors
    `createBranch`'s exact organization-scoping pattern) — this
    codebase has exactly one real `Organization` row today, but the
    check is still the correct trust boundary, not a client-supplied
    branch id trusted blindly.
  - **`GET /auth/me/branches`** lists the caller's own memberships
    (branch/department/role names, and which one is currently active)
    — plain `AuthGuard`-gated, no extra permission (mirrors `/auth/me`'s
    own precedent: this is the caller's own data, not another user's).
- **Scope-narrowing decisions** (see the story doc's own Non-Goals for
  the full list): no portal/customer-side change (Contacts have no
  role/branch-membership concept at all); no simultaneous cross-branch
  data visibility (switching is a full context change, never viewing
  two branches' data at once); no self-service branch-join request flow
  (grants stay admin-initiated, the same trust tier as `user:create`);
  no change to `createUser`'s single-initial-membership behavior; no
  CASL adoption (a separate, disclosed-but-narrower, value-free
  refactor the same Recon considered and rejected).
