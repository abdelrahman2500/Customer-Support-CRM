> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-role-permission-management/agent-workspace-role-permission-management/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Role & Permission Management (Admin Self-Service)

- **Feature slug (folder under `plans/`):** `agent-workspace-role-permission-management`

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
Agent Workspace — Role & Permission Management, Admin Self-Service
```

---

## Description

```text
A Next-Story Recon after Story 45 (Branch & Department Management) found that Role/Permission management is the last major identity/admin domain still entirely read-only, and the single most consequential remaining gap: the seeded `Agent` role has zero permissions across every domain (confirmed end-to-end — an Agent-role user can log in and call `GET /auth/me`, and nothing else), and there is currently no way to grant it any permission except direct database/seed edits. This has been explicitly flagged as deferred — not resolved — in two separate prior story plans (Story 03 and Story 34) without ever being closed.

A focused investigation (Backend Contract, Frontend `/roles` Screen, Testing/Authorization-Flow) resolved every critical security/product question directly from repository evidence rather than by assumption: `Role.name` already has a real, working global uniqueness constraint (no new one needed); `PermissionsGuard` re-resolves permissions fresh from the database on every single guarded request with zero caching, so revoking a permission from a role takes effect for every holder on their very next request with no session/token changes required; deactivating a Role is fully compatible with this flow since the guard never inspects `Role.isActive`, so deactivation cleanly blocks only future role assignment without touching already-assigned users; and `seed.ts`'s reconciliation logic being keyed by the literal names "SuperAdmin"/"Agent" is direct evidence that those two roles must not be renameable or deactivatable via the API (their permission grants, however, must remain fully mutable — that is the entire point of this story).
```

---

## Acceptance criteria

```text
- A `SuperAdmin` can create a new custom Role (name only) via the existing `/roles` screen, extended in place — no second role-management screen.
- A `SuperAdmin` can rename and activate/deactivate any custom Role. `SuperAdmin` and `Agent` cannot be renamed or deactivated (400 on attempt).
- A `SuperAdmin` can assign or revoke existing catalog Permissions on ANY Role, including `SuperAdmin` and `Agent`, via a full-replace "set permissions" action (checkbox-list UI against the complete permission catalog).
- `Permission` rows themselves remain fully immutable — no create/update/delete, no client-defined permission key is ever accepted; only existing catalog keys may be assigned to a role.
- Duplicate role names are rejected with 409, never a raw 500.
- Deactivating a Role removes it from the default (active-only) `GET /identity/roles` listing (so `CreateUserView`'s role picker can no longer assign it to new users) without touching any existing `UserBranchRole` row.
- Revoking a permission from a role takes effect for every user holding that role on their very next request, with no additional action (proven via a real Agent-role login in an e2e test).
- New mutation permissions (`role:create`, `role:update`, `role:assign-permissions`) are granted only to `SuperAdmin` initially; `Agent`'s grants are unchanged.
- English and Arabic translations exist for every new string; the existing `/roles` nav entry and route are unchanged.
- Backend unit and e2e tests, and frontend component tests (including bilingual rendering), cover the new endpoints/UI, including 401/403/400/409 cases and an end-to-end proof of dynamic permission-revocation.
- `create-user-view.spec.tsx` and `workspace-nav.spec.tsx` require zero new test cases and remain green, unmodified.
- Typecheck, lint, and build remain clean workspace-wide; every existing test suite remains green.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `project-foundation` Story 02/03 (`Role`/`Permission`/`RolePermission` models, `PermissionsGuard`), `agent-workspace-roles-permissions-viewer` Story 34 (existing read-only `/roles` screen, extended in place), `agent-workspace-user-admin` Story 32/38 (`CreateUserDto.roleId` picker, left untouched), `agent-workspace-branch-department-admin` Story 45 (`includeInactive` convention, `translateDuplicate<X>Name` P2002 pattern, and deactivation-semantics precedent, all directly reused).

- **Depends on code areas or other stories:** `apps/api/src/modules/identity/**` (service, controller, new DTOs), `apps/api/prisma/schema.prisma` + one new migration, `apps/api/prisma/seed.ts`. Touches `apps/web/src/lib/roles-api.ts`, `apps/web/src/hooks/use-roles.ts`, `apps/web/src/components/roles/role-list-view.tsx` (+spec), `apps/web/messages/{en,ar}.json`. Does **not** touch `apps/web/src/components/users/create-user-view.tsx`, `apps/web/src/components/workspace/workspace-nav.tsx`, `UserBranchRole`, Branch/Department, or any ticket/customer/SLA code.

## Extra notes (optional)

- This story does not re-litigate the two seeded roles' existence or the overall RBAC model — it only adds mutation on top of what already exists.
- **No README changes** — consistent with every recent story's explicit instruction to leave the README's pre-existing drift for a future documentation-capable story.
- A disclosed, deliberately-not-fixed edge case: `PermissionsGuard` matches permissions via `Role.name` embedded in the JWT at issuance, not `Role.id`. Renaming a *custom* role (built-in roles can't be renamed at all) invalidates already-issued, unexpired tokens' permission resolution until the affected users' next refresh/login — fails safe (deny, never over-grant), self-heals, and is explicitly out of scope to fix in this story.

## Technical hints (optional)

- `setRolePermissions` should mirror `seed.ts`'s own `RolePermission` reconciliation transaction exactly (`deleteMany` then conditional `createMany`, both in one `$transaction`) — full-replace semantics, not incremental assign/revoke routes, to avoid introducing this codebase's first-ever `DELETE` route (a zero-hard-delete convention holds everywhere else in this API).
- `updateRole` must fetch the role first to check `PROTECTED_ROLE_NAMES.has(role.name)` before applying any `name`/`isActive` change — there is no other way to identify the two seeded roles (they have ordinary generated UUIDs, not stable well-known ids).
- The permission-assignment UI should render against the FULL permission catalog (`usePermissionsQuery()`), not just a role's current permissions, so unchecked-but-available permissions are visible and assignable — mirroring `BusinessHoursCalendar`'s existing "replace the whole collection atomically" precedent (Story 33) rather than per-permission assign/revoke calls.

## Out of scope

- Creating, deleting, or renaming `Permission` rows, or any client-defined permission key.
- Renaming or deactivating `SuperAdmin`/`Agent` (their permission assignments remain fully mutable).
- User↔Role/Branch/Department reassignment; any change to `UserBranchRole`.
- Any hard-delete of a Role.
- Fixing the JWT/guard by-name (vs. by-id) matching design.
- Branch/Department, ticket/conversation, Customer Portal, Channels, Knowledge Base, AI, Reporting, Integrations work.
- Any README change or navigation restructuring.
