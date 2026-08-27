> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-user-admin/agent-workspace-user-admin/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — User Management (list, deactivate, rename)

- **Feature slug (folder under `plans/`):** `agent-workspace-user-admin`

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
Agent Workspace — User Management (list, deactivate, rename)
```

---

## Description

```text
`GET/PATCH /identity/users` have existed since Story 03 (`UsersController`) and are already consumed indirectly — `listUsers()` already backs the "assigned agent" dropdown on the Ticket List/Detail/Create screens — but no screen anywhere lets an agent with the right permission actually see the list of user accounts, rename one, or deactivate/reactivate one.

This story adds a new, standalone screen: a list of every user in the branch (email, name, roles, active/inactive state), with inline rename and activate/deactivate actions via the existing `PATCH /identity/users/:id`. User **creation** is explicitly excluded from this story: `POST /identity/users` requires a `branchId`/`roleId`, and no endpoint anywhere lets the frontend list valid branches/departments to populate such a form — creation is deferred until that gap is separately resolved.
```

---

## Acceptance criteria

```text
- A new `/users` route lists every user in the branch (via the existing `GET /identity/users`), showing email, full name, roles, and active/inactive status.
- An agent with the right permission can rename a user's full name inline, saved via the existing `PATCH /identity/users/:id` with `{ fullName }` — never optimistic; a rejected mutation renders inline and leaves the prior value visible.
- An agent with the right permission can deactivate or reactivate a user inline, saved via the existing `PATCH /identity/users/:id` with `{ isActive }`, with the same never-optimistic behavior.
- User creation is NOT implemented by this story — there is no "New user" action anywhere on this screen.
- A rejected mutation distinguishes a 403 (no permission) from a generic failure, matching the existing actionForbidden/actionFailed convention.
- No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or business rule is introduced.
- No protected file (RealtimeGateway, TicketRealtimeListener, BranchNotificationRealtimeListener, NotificationLog/listeners, any SLA-policies file, schema.prisma, migrations, TicketsController/TicketsService/DTOs, IdentityController's auth/* session endpoints, TicketListView, TicketDetailView, CustomerDetailView, DashboardView) is modified.
- English and Arabic translations exist for every new string under a new, dedicated `users.*` namespace; RTL rendering is preserved.
- Component tests cover the list's loading/error/empty/populated states, inline rename, inline activate/deactivate, and 403/generic-failure states.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `project-foundation` Story 03 (`UsersController`, `IdentityService.listUsers`/`updateUser`).

- **Depends on code areas or other stories:**
  - `apps/web/src/lib/tickets-api.ts` — the existing `UserSummary` interface (`id`, `email`, `fullName`) is widened, additively, to match the backend's actual already-returned shape (`isActive`, `roles` — confirmed present in `IdentityService`'s own `UserSummary` type this turn, simply unused by the frontend until now); a new `updateUser` function is added alongside it.
  - `apps/web/src/hooks/use-tickets.ts` — additive only: a new `useUpdateUserMutation`, mirroring `useUpdateTicketMutation`'s never-optimistic invalidation convention; the existing `useUsersQuery` is reused unmodified for the list itself.
  - `apps/api/src/modules/identity/**` — read-only dependency, not modified.

## Extra notes (optional)

- Selected as part of an approved three-story parallel batch (Stories 30/31/32), each an independent workstream advancing a different Core Requirement category with zero required ordering between them.
- **Disclosed file overlap**: `apps/web/src/lib/tickets-api.ts` and `apps/web/src/hooks/use-tickets.ts` already hold the `UserSummary` type and `useUsersQuery`/`listUsers` (added by Story 23) alongside Customer/Contact/Ticket code, per this repository's existing (pre-batch) convention of one shared API-client file and one shared hooks file. Story 30 (`agent-workspace-customer-editing`) also makes small, additive, distinctly-named additions to these same two files. This is the only overlap between any of the three parallel stories — both additions are purely additive (new interfaces/fields/functions, nothing existing removed or changed in place), so the practical conflict risk is low, but it is disclosed rather than hidden. See the plan's "Parallel-batch overlap note."
- Widening `UserSummary` with `isActive`/`roles` is additive and backward-compatible: every existing consumer (`ticket-list-view.tsx`'s/`ticket-detail-view.tsx`'s/`create-ticket-view.tsx`'s assignee dropdowns) only ever destructures `id`/`fullName` and is unaffected by the extra fields.
- **Numbering**: NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` — unchanged by this story.

## Technical hints (optional)

- `UserSummary` (backend, `identity.service.ts`, freshly confirmed this turn): `{ id, email, fullName, isActive, roles: string[] }` — the frontend type was simply narrower than the actual response; this story only widens the type, it does not change the backend.
- `UpdateUserDto` is `{ fullName?, isActive? }` only — confirmed via fresh inspection; no role/branch change is possible through this endpoint, which is exactly why this story's scope excludes anything beyond rename/deactivate/reactivate.
- `CreateUserDto` requires `branchId`/`roleId`, and no `GET /identity/branches`/`GET /identity/departments` endpoint exists anywhere — confirmed via fresh inspection this turn. This is the concrete, disclosed reason user creation is out of scope, not an arbitrary restriction.

## Out of scope

- **User creation** (explicitly, per the approved batch instructions) — blocked on a missing branch/department-listing endpoint.
- Role/permission management or assignment (no mutation endpoint exists for either).
- Password reset (no endpoint exists).
- Audit log viewing (no endpoint exists).
- A persistent cross-screen navigation menu/nav bar.
- Any change to `TicketListView`, `TicketDetailView`, `CustomerDetailView`, or `DashboardView`.
- Any new backend endpoint, DTO field, permission, Prisma model, migration, or business rule.
- Knowledge Base, AI, Customer Portal, Reporting, Integrations, generalized `AutomationRule` engine, SLA policy management.
