> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-user-role-assignment/agent-workspace-user-role-assignment/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — User Role & Assignment Management (Admin Self-Service)

- **Feature slug (folder under `plans/`):** `agent-workspace-user-role-assignment`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Agent Workspace — Reassign an Existing User's Role and Department, Admin Self-Service
```

---

## Description

```text
A Next-Story Recon after Story 46 (Role & Permission Management) found the one remaining gap in the identity/admin arc Stories 32→46 have been building toward: a user's `UserBranchRole` assignment is fixed forever at creation time. `updateUser` only ever touches `fullName`/`isActive`; `user-list-view.tsx` renders a user's roles as plain read-only badges with no mutation control.

A focused investigation resolved the two open questions the recon flagged, both from direct repository evidence rather than assumption:

1. `UserBranchRole` semantics — resolved as edit-in-place (modify the user's existing first/active membership row) rather than additive-row or delete-recreate. `createUser` writes exactly one row per user today; `login`/`refresh`/`getAuthenticatedUser` all select `branchRoles[0]` (oldest `createdAt`) as the active context. An additive row would not be reachable under this existing selection rule without the branch-switching UI this codebase has explicitly, repeatedly deferred — so edit-in-place is the only choice that doesn't quietly reopen that deferred direction.
2. Branch reassignment — investigation found this cannot be safely built inside this story's scope: every mutation since Story 45 (`updateBranch`/`updateDepartment`/`updateRole`) is strictly scoped to the caller's own branch, and the architecture doc states "cross-branch access is an explicit, audited permission, never a default." Reassigning a user into a different branch would require building the cross-branch administration capability this codebase has never built. Story 47 therefore covers Role and Department reassignment only, both already within the caller's own branch's authority.

A new, dedicated permission (`user:reassign`) is introduced, following the exact precedent Story 46 set by splitting `role:assign-permissions` out from `role:update` — reassigning a user's role/department is a materially more privilege-affecting action than the profile-only `user:update`.
```

---

## Acceptance criteria

```text
- An admin holding `user:reassign` can change an existing user's Role (any active role in the org-wide catalog) and/or Department (any active department within the caller's own branch) via the existing `/users` screen — no new route, no new screen.
- No Branch field/picker is exposed anywhere in this flow — reassigning a user to a different branch is explicitly out of scope.
- The mutation operates on the user's existing first/active `UserBranchRole` row (edit-in-place) — it never creates a second membership row and never deletes/recreates the existing one.
- Assigning an inactive Role or Department is rejected with 400, never silently allowed.
- Reassigning the last remaining SuperAdmin-role user away from SuperAdmin is rejected with 400.
- The target user must already hold a membership in the caller's own branch, and any target Department must belong to that same branch — both enforced server-side, never just client-side.
- `GET /identity/users` additively exposes each user's current `roleId`/`departmentId` so the edit UI can pre-populate correctly.
- `user:update` is completely unchanged in scope (still only `fullName`/`isActive`).
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and frontend component tests, cover the new endpoint/UI, including 401/403/404/400/409 cases and the last-SuperAdmin guard.
- No Prisma migration is introduced — this story is pure application-layer logic over the existing `UserBranchRole` columns.
- `create-user-view.spec.tsx` and every other existing admin screen's tests remain green, unmodified.
- Typecheck, lint, and build remain clean workspace-wide.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------- | --------------- |
| None                            | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `project-foundation` Story 02/03 (`UserBranchRole`, `TenantContext`), `agent-workspace-user-admin` Story 32/38 (`UserListView`/`CreateUserView`, existing user hooks), `agent-workspace-branch-department-admin` Story 45 (Department picker, own-branch scoping convention), `agent-workspace-role-permission-management` Story 46 (Role picker, the "split a more sensitive action into its own permission key" precedent).

- **Depends on code areas or other stories:** `apps/api/src/modules/identity/**` (service, controller, one new DTO), `apps/api/prisma/seed.ts` (one new permission key). No Prisma schema/migration change. Touches `apps/web/src/lib/tickets-api.ts`, `apps/web/src/hooks/use-tickets.ts`, `apps/web/src/components/users/user-list-view.tsx` (+spec), `apps/web/messages/{en,ar}.json`. Does **not** touch `create-user-view.tsx`, Branch/Department CRUD, Role/Permission CRUD, or any ticket/customer/SLA code.

## Extra notes (optional)

- **No README changes** — consistent with every recent story's standing instruction.
- A disclosed, carried-over edge case from Story 46 (not re-solved here): because `PermissionsGuard` re-resolves permissions from the DB by role name on every request but the JWT's role-name claim is only refreshed at login/token-refresh, a reassigned user's new role takes effect starting from their next token refresh, not instantly on their currently-live token.
- `createUser`'s own existing behavior (assigning a new user to *any* branch, completely unrestricted) is left untouched by this story — a disclosed, pre-existing inconsistency with this story's own own-branch-only scoping, not something this story fixes.

## Technical hints (optional)

- `updateUserAssignment`'s "user is in caller's branch" check should mirror `tickets.service.ts`'s existing private `requireUserInScope(userId, branchId)` helper (`userBranchRole.findFirst({ where: { userId, branchId } })` → `NotFoundException("User not found in this branch")`) rather than inventing new wording.
- The target-department check should mirror `identity.service.ts`'s existing `requireDepartmentInScope` shape (a single `findFirst({ where: { id, branchId } })` that proves both existence and branch-ownership at once).
- `departmentId` needs tri-state handling (`undefined` = no-op, `null` = explicitly clear, a real id = set) — the first DTO field in this codebase needing `@ValidateIf((o) => o.departmentId !== null) @IsUUID()` rather than a plain `@IsOptional() @IsUUID()`.
- This is the first inline `Select`-in-a-row anywhere in this codebase's admin screens (every prior row edit is a blur-commit `Input` or a `Button` toggle) — adapt the markup from `CreateUserView`'s existing creation-time `Select` usage, not from any row-edit precedent (none exists).

## Out of scope

- Reassigning a user to a different Branch.
- Adding a second/additional `UserBranchRole` membership; managing more than a user's first/active row.
- Branch-switching UI, active-context selection, or any change to `branchRoles[0]`/JWT claim logic.
- Redesigning `PermissionsGuard`.
- Role/Permission CRUD (Story 46) or Branch/Department CRUD (Story 45).
- Fixing `createUser`'s existing unrestricted-any-branch behavior.
- Ticket/conversation, Customer Portal, Channels, Knowledge Base, AI, Reporting, Integrations work.
- Any README change.
