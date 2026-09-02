> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/identity-multi-branch-assignment/identity-multi-branch-assignment/intake.md`

---

## Feature

- **Feature name (display):** Identity & Access — Multi-branch user assignment + branch switching
- **Feature slug (folder under `plans/`):** `identity-multi-branch-assignment`

## Title

```text
Story 118 — Identity & Access: Multi-branch user assignment + branch switching
```

## Description

```text
UserBranchRole's own @@unique([userId, branchId, departmentId, roleId])
constraint already supports multiple rows per user, and
docs/architecture/05-auth-and-security.md states "users can have
different roles by branch/department" as an architectural given -- but
every write path only ever creates/edits exactly one row, and every
read path hard-codes branchRoles[0] as "the" active membership. Four
prior stories (02, 35, 47, 107) each explicitly named this as deferred,
not forgotten. This story adds: a SuperAdmin-only, audited endpoint to
grant an additional branch/department/role membership; a branch
-switching endpoint that persists the switch (via new
activeBranchId/activeDepartmentId columns on User) so it survives a
silent token refresh, not just the immediate access token; a
read-only "my memberships" endpoint; and a small branch-switcher UI in
apps/web's nav, shown only when a user actually has more than one
membership.
```

## Acceptance criteria

```text
- [ ] User.activeBranchId/activeDepartmentId added (nullable, no FK);
      every existing auth flow for a never-switched user is unaffected.
- [ ] POST auth/switch-branch validates, persists, rotates the refresh
      token, and returns a fresh access token reflecting the switch.
- [ ] The switch survives a subsequent silent /auth/refresh call.
- [ ] GET auth/me/branches lists the caller's own memberships, flagging
      the active one.
- [ ] POST identity/users/:id/branch-assignments (SuperAdmin-only,
      user:branch-assign) grants an additional membership, org-scoped,
      with duplicate/inactive-role/inactive-department validation.
- [ ] apps/web nav shows a branch switcher only for >1 membership.
- [ ] Unit + e2e coverage for the above.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures.
```

## Dependencies

- Story 02 — foundation (`UserBranchRole`, `issueAccessToken`, the
  original "future work" disclosure).
- Story 35 — `BranchSummary` (the second disclosure).
- Story 41 — silent refresh (the mechanism this story's persistence
  design must survive).
- Story 47 — `updateUserAssignment` (the third disclosure; stays
  unchanged, same-branch-only).
- Story 84 — audit logging convention (`auth.login`/`auth.logout`,
  mirrored for `auth.branch_switched`/`user.branch_assignment_granted`).
- Story 95 — `clearQueryCache()` (reused on the frontend after a
  switch).
- Story 107 — `createBranch`'s organization-scoping pattern (mirrored
  for `grantBranchAssignment`'s cross-org validation) and the fourth
  disclosure.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Any Customer Portal / Contact change.
- Simultaneous cross-branch data visibility.
- A self-service branch-join request flow.
- Any change to createUser's/updateUserAssignment's existing scope.
- CASL adoption.
