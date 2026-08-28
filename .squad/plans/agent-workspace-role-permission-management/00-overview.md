# agent-workspace-role-permission-management — plan overview

Entry point for the **agent-workspace-role-permission-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 46  | [46-story-agent-workspace-role-permission-management.md](./46-story-agent-workspace-role-permission-management.md) | Agent Workspace: Role & Permission Management, Admin Self-Service | — | `project-foundation` Story 02/03 (`Role`/`Permission`/`RolePermission` Prisma models, `PermissionsGuard`), `agent-workspace-roles-permissions-viewer` Story 34 (`GET /identity/roles`, `GET /identity/permissions`, `roles-api.ts`/`use-roles.ts`/`role-list-view.tsx`, extended not replaced), `agent-workspace-user-admin` Story 32/38 (`CreateUserDto.roleId` picker, left untouched), `agent-workspace-branch-department-admin` Story 45 (`includeInactive` query-param convention, `translateDuplicateXName` P2002 pattern, deactivation-semantics precedent, all directly reused) |

## Dependency notes

- Extends the existing `IdentityModule` (`identity.service.ts`, `users.controller.ts`, `dto/`) — no new module, no new controller file.
- Adds one Prisma column (`Role.isActive`) via one migration. `Role.name`'s uniqueness constraint already exists (`@unique`, since Story 02/03) — no new constraint is added; this story only wires a `translateDuplicateRoleName` P2002 translator to the constraint that was always there.
- Adds three permission keys to the existing seed catalog: `role:create`, `role:update`, `role:assign-permissions` — kept as three distinct keys (not collapsed into the shared `role:read` used for reads) because permission assignment is meaningfully more security-sensitive than a plain rename, extending this codebase's existing create/update-key-splitting philosophy one step further.
- Adds an `includeInactive` query parameter to the existing `GET /identity/roles` endpoint — purely additive; `CreateUserView`'s existing role picker is completely untouched and automatically starts seeing only active roles once the migration lands, identical in shape to how Story 45 handled branches/departments.
- Extends the existing `apps/web/src/lib/roles-api.ts`/`apps/web/src/hooks/use-roles.ts` (Story 34) rather than creating new dedicated files — this domain already had its own file pair; Story 46 adds mutation functions/hooks to it.
- Extends the existing `role-list-view.tsx` (Story 34) in place — no second role-management screen, no new route, no nav change (the existing `roles` nav entry is unchanged).
- **Built-in-role protection**: `SuperAdmin` and `Agent` cannot be renamed or deactivated via the new mutation endpoints — grounded directly in `seed.ts`'s literal-name-keyed reconciliation logic (renaming either would cause the next seed run to create a duplicate row) and in the risk of an unrecoverable lockout if `SuperAdmin` were deactivated. Permission **assignment** on these two roles remains fully mutable — that is the whole point of this story (it is the only way to make the seeded, zero-permission `Agent` role usable without direct DB access).
- A disclosed, deliberately-not-fixed edge case: because `PermissionsGuard` matches permissions via `Role.name` embedded in the JWT at issuance (not `Role.id`), renaming a *custom* role invalidates already-issued, unexpired tokens' permission resolution until their next refresh/login. This fails safe (deny, not over-grant) and self-heals; switching the guard to match by role id is explicitly out of scope for this story.
