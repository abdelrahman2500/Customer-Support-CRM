> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/agent-workspace-roles-permissions-viewer/agent-workspace-roles-permissions-viewer/intake.md`

---

## Feature

- **Feature name (display):** Agent Workspace — Roles & Permissions Viewer
- **Feature slug (folder under `plans/`):** `agent-workspace-roles-permissions-viewer`

## Tracker (metadata only)

- **Tracker type:** `github` · **Work item id:** `` · **Status:** ``

---

## Title

```text
Agent Workspace — Roles & Permissions Viewer
```

---

## Description

```text
`UserListView` (Story 32) renders each user's roles as bare name badges with no way to see what a role actually grants. `GET /identity/roles` (already returns each role's full permission-key list embedded) and `GET /identity/permissions` (the full permission catalog) have existed since Story 03 with zero frontend consumer.

This story adds a new, read-only screen: every role in the system with its permissions expandable per row, plus a reference list of every permission that exists. No mutation of any kind — the safest possible next increment, with zero write path to get wrong.
```

---

## Acceptance criteria

```text
- A new `/roles` route lists every role via the existing `GET /identity/roles`, each showing its name and an expand/collapse control.
- Expanding a role shows its actual permission keys (already embedded in the same response — no second request needed per role).
- A separate "All permissions" reference section lists every permission in the system via the existing `GET /identity/permissions`.
- Loading, error (with retry), and empty states are implemented for both the roles list and the permissions reference, independent of each other.
- No mutation of any kind exists on this screen — no create/edit/delete for roles, permissions, or role-permission assignments.
- No new backend endpoint, DTO field, permission, Prisma model, migration, or business rule is introduced.
- No protected file, no `BusinessHoursCalendarsController`-consuming file, no ticket/customer/dashboard/SLA-policy/user file is modified.
- English and Arabic translations exist for every new string under a new, dedicated `roles.*` namespace; RTL rendering is preserved.
- Component tests cover: loading/error/empty for both the roles list and the permissions reference, expand/collapse behavior, and correct rendering of a role's permission keys.
- Typecheck, lint, and build remain clean; existing suites remain unaffected.
```

---

## Dependencies

- **Blocked by:** `project-foundation` Story 03 (`UsersController`'s `GET /identity/roles`/`GET /identity/permissions`).
- **Depends on code areas:** none inside `apps/web` — brand-new files. `apps/api/src/modules/identity/**` is a read-only dependency, not modified.

## Extra notes

- Selected as part of an approved two-story parallel batch (Stories 33/34), independent of each other.
- **Zero file overlap with Story 33**: dedicated new `apps/web/src/lib/roles-api.ts`, `apps/web/src/hooks/use-roles.ts`, `apps/web/src/components/roles/*`, route `(agent)/roles`, `roles.*` i18n namespace — none shared with Story 33's `businessHours.*`/`business-hours/*` files.
- **Design decision — no per-row hook needed at all**: unlike every other list screen so far, this story has zero mutations, so expand/collapse state is tracked once at the parent level (a `Set<string>` of expanded role ids) rather than needing a per-row subcomponent for rules-of-hooks reasons — there is no hook being called per row in the first place.
- **Confirmed this planning pass**: `RoleSummary.permissions` (`identity.service.ts`) is already `role.permissions.map((rp) => rp.permission.key)` — the full permission-key array is already embedded per role in the existing `GET /identity/roles` response; no second per-role request is ever needed.

## Technical hints

- `RoleSummary { id, name, permissions: string[] }`; `PermissionSummary { id, key }` — both confirmed via fresh inspection of `identity.service.ts`.
- `role:read`/`permission:read` permissions already gate these two routes — the same permissions `UsersController`'s own `listRoles`/`listPermissions` methods already require; no new permission.

## Out of scope

- Role creation/editing, permission creation/editing, role-permission assignment (no mutation endpoint exists for any of these).
- User management (Story 32, unmodified), user creation, branch/department management.
- SLA/business-hours, Notification/Audit-log UI, any backend change.
