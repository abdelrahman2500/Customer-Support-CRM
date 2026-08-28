# agent-workspace-user-role-assignment — plan overview

Entry point for the **agent-workspace-user-role-assignment** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 47  | [47-story-agent-workspace-user-role-assignment.md](./47-story-agent-workspace-user-role-assignment.md) | Agent Workspace: Reassign an Existing User's Role and Department, Admin Self-Service | — | `project-foundation` Story 02/03 (`UserBranchRole`, `TenantContext`, `createUser`'s existing assignment pattern), `agent-workspace-user-admin` Story 32/38 (`UserListView`/`CreateUserView`, `UpdateUserDto`, the existing `useUsersQuery`/`useUpdateUserMutation` hooks this story extends), `agent-workspace-branch-department-admin` Story 45 (the active-only Department picker and own-branch scoping convention reused here), `agent-workspace-role-permission-management` Story 46 (the active-only Role picker reused here, and the `role:assign-permissions`-style "split a more sensitive action into its own permission key" precedent this story's `user:reassign` key follows) |

## Dependency notes

- Extends the existing `IdentityModule` (`identity.service.ts`, `users.controller.ts`, `dto/`) — no new module, no new controller file.
- **No Prisma schema change and no migration** — `UserBranchRole` already carries every column this story needs (`roleId`, `departmentId`, `branchId`); this story only ever runs a plain `UPDATE` on an existing row's columns.
- Adds one permission key, `user:reassign`, kept distinct from the existing `user:update` (which stays scoped to `fullName`/`isActive` only, completely unchanged) — following the exact precedent Story 46 set by splitting `role:assign-permissions` out from `role:update` for the same reason: reassigning a user's role/department is a materially more privilege-affecting action than a plain profile edit.
- **Resolved UserBranchRole semantics: edit-in-place**, operating on the user's first/active `UserBranchRole` row (the same row `login`/`refresh`/`getAuthenticatedUser` already select via `branchRoles[0]`, ordered by `createdAt: "asc"`) — never an additive second row, never a delete-then-recreate. See the story file's Design section for the full evidence trail.
- **Deliberately excludes Branch reassignment to a different branch.** Investigation found this would require rebuilding cross-branch administration capability this codebase has explicitly and repeatedly declined to build (Story 35's `BranchSummary` doc comment, Story 45's own-branch-only scoping, `docs/architecture/04-data-and-multitenancy.md`'s "cross-branch access is an explicit, audited permission, never a default"). This is flagged as a genuine boundary per the planning instruction to flag rather than expand, not a silent scope reduction — see the story file's "Branch reassignment" note.
- The new `GET /identity/users` response gains `roleId`/`departmentId` (additive, derived from the same `branchRoles[0]` selection) since no existing endpoint exposes a user's *singular* current role/department for an edit UI to pre-populate — `roles: string[]` (deduplicated names) was the only prior signal.
- Frontend reuses the existing, unchanged active-only `useRolesQuery()` (Story 34/46) and `useDepartmentsQuery()` (Story 45) pickers — both already scoped correctly (active-only, and for departments, already caller's-own-branch-scoped) for this story's needs, requiring no new query file.
- This is the first story to place an inline `Select` control inside an existing admin-list row (every prior row edit — Users, SLA Policies, Branches/Departments, Roles — used a blur-commit `Input` or a `Button` toggle); no existing precedent was available to transplant, so the row-level `Select` markup is adapted from `CreateUserView`'s existing creation-time `Select` usage instead.
