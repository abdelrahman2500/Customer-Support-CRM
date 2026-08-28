> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

> **Note on this file's provenance.** Recorded after the fact, alongside the sibling plan/story files — see `.squad/plans/agent-workspace-branch-department-admin/00-overview.md`'s dependency notes. This story was planned via a prior multi-agent ad-hoc conversation (not the `squad` CLI), fully implemented, and then documented here to preserve this repository's established intake/plan/story convention. Content below reflects the actual approved FINAL PLAN and the real implementation, not a forward-looking request.

- Folder: `.squad/stories/agent-workspace-branch-department-admin/agent-workspace-branch-department-admin/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Branch & Department Management (Admin Self-Service)

- **Feature slug (folder under `plans/`):** `agent-workspace-branch-department-admin`

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
Agent Workspace — Branch & Department Management, Admin Self-Service
```

---

## Description

```text
A multi-agent Next-Story recon (after Story 44) identified Branch & Department Management as the next candidate: the schema, the `isActive` soft-deactivation convention (established on User/Customer/SlaPolicy), and the admin-CRUD pattern (proven on Users/SLA Policies/Business Hours) all already existed, and Story 35 had already shipped read-only `GET /identity/branches`/`GET /identity/departments` scoped to the caller's own branch — only mutation was missing.

A 7-track parallel planning pass (Backend Contract, Permissions & Security, Frontend, Database & Migration, Testing, Architecture/Product, Repository/History) then found the candidate was NOT fully decision-free as first assumed: Branch *creation* had no home in the existing tenancy model (no `organizationId` anywhere in `TenantContext`, no precedent for a caller acting outside their own branch), and deactivation-cascade semantics were undefined. A second, narrower round of product decisions resolved this explicitly: no `POST /identity/branches` — only rename/activate-deactivate of the caller's own, already-existing branch, plus full create/rename/activate-deactivate for Departments within that branch; deactivation blocks future selection only, never cascades/reassigns/strips existing references; `Branch.name` gained a `[organizationId, name]` uniqueness constraint; permission keys `branch:update`/`department:create`/`department:update` (deliberately no `branch:create`); and inactive entities are filtered server-side by default (`includeInactive=true` for the new management screen only), so the three existing active-only pickers (`CreateUserView`, `CreateTicketView`, `TicketDetailView`) needed zero changes.

A second 5-track validation pass (Backend/Security, Database, Frontend, Testing, Architecture) confirmed these decisions were internally consistent and implementable with no further hidden dependency, resolving two remaining implementation details directly from repository evidence: the `Branch.name` uniqueness constraint is organization-scoped (`@@unique([organizationId, name])`), not global, since scoping it costs nothing extra and matches every other uniqueness constraint in this schema; and the out-of-scope-branch-id case on `PATCH /identity/branches/:id` returns `404`, not `403`, for consistency with every other scoped-resource mutation already in this codebase.
```

---

## Acceptance criteria

```text
- The caller can rename their own, already-existing Branch (`PATCH /identity/branches/:id`, scoped to the caller's own branch id only — any other id is rejected with 404) and toggle it active/inactive.
- The caller can create a new Department within their own Branch (`POST /identity/departments`, `branchId` always derived from `TenantContext`, never accepted from the client), rename an existing one, and toggle it active/inactive (`PATCH /identity/departments/:id`, scoped to the caller's own branch, out-of-scope ids rejected with 404).
- No `POST /identity/branches` endpoint and no `branch:create` permission exist anywhere.
- Duplicate branch names within the same organization, and duplicate department names within the same branch, are rejected with 409, never a raw 500.
- Deactivating a Branch or Department blocks it from future selection only — it is never removed from, and never triggers any change to, any existing Ticket, SLA Policy, User, or UserBranchRole that already references it.
- `GET /identity/branches`/`GET /identity/departments` default to active-only (unchanged behavior for every existing caller); a new `includeInactive=true` query parameter lets the new management screen see and reactivate inactive rows.
- The existing active-only branch/department pickers (`apps/web/src/lib/tickets-api.ts`, `apps/web/src/hooks/use-tickets.ts`, and their consumers `CreateUserView`, `CreateTicketView`, `TicketDetailView`) are completely unchanged.
- A new Agent Workspace screen (`/branches`) exists, presented as "My Branch" (not organization-wide branch administration), letting the caller manage their own branch and its departments.
- One new persistent nav link is added to `WorkspaceNav`, following the exact existing convention (plain `<a href>`, no active-page highlighting, no client-side permission gating).
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and frontend component tests (including bilingual rendering), cover the new endpoints/UI, including 401/403/404/409 cases and a regression proving deactivation does not cascade.
- Typecheck, lint, and build remain clean workspace-wide; every existing test suite remains green.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `project-foundation` Story 02/03 (`Branch`/`Department` Prisma models, `IdentityModule`), `identity-branch-department-listing` Story 35 (`GET /identity/branches`/`GET /identity/departments`, `branch:read`), `agent-workspace-user-admin` Story 38 (`useDepartmentsQuery()` picker, left untouched), `agent-workspace-navigation-menu` Story 44 (`WorkspaceNav`, extended with one new link).

- **Depends on code areas or other stories:** `apps/api/src/modules/identity/**` (service, controller, DTOs), `apps/api/prisma/schema.prisma` + a new migration, `apps/api/prisma/seed.ts`. Touches `apps/web/src/lib/branches-api.ts` (new), `apps/web/src/hooks/use-branches.ts` (new), `apps/web/src/components/branches/**` (new), `apps/web/src/app/[locale]/(agent)/branches/page.tsx` (new), `apps/web/src/components/workspace/workspace-nav.tsx` (+1 line), `apps/web/messages/{en,ar}.json`. Does **not** touch `apps/web/src/lib/tickets-api.ts`, `apps/web/src/hooks/use-tickets.ts`, `create-user-view.tsx`, `create-ticket-view.tsx`, `ticket-detail-view.tsx`, or any Role/Permission/Ticket-message code.

## Extra notes (optional)

- This story is the direct output of a two-round planning process (a 7-track parallel investigation, followed by explicit product decisions resolving the two genuine ambiguities it surfaced, then a 5-track validation pass) — it does not re-litigate those decisions.
- **No README changes** — consistent with every recent story's explicit instruction to leave the README's pre-existing drift for a future documentation-capable story.
- Confirmed during planning: the seeded `Agent` role receives none of the three new permission keys (`branch:update`, `department:create`, `department:update`); only `SuperAdmin` receives them, automatically, via the existing `ROLE_GRANTS.SuperAdmin = PERMISSION_CATALOG` catalog-reference behavior.
- Two implementation-time discoveries, resolved in favor of the real backend contract rather than the original plan sketch: `GET /identity/branches` never returns `timezone` (so the frontend `ManagedBranch` type and UI omit it, even though `UpdateBranchDto` accepts one), and all three mutation endpoints return only `{ id: string }` (so the frontend relies on query invalidation, not the mutation response, for the authoritative updated record) — both consistent with this codebase's existing mutation-endpoint conventions.

## Technical hints (optional)

- `updateBranch`'s own-branch-only check is a direct identity comparison against `TenantContext.requireBranchScope().branchId` (no DB lookup needed, since the caller's own branch id is already fully trusted from JWT claims) — `updateDepartment`'s equivalent check (`requireDepartmentInScope`) is a `findFirst({ where: { id, branchId } })`, mirroring `sla-policies.service.ts`'s existing helper shape, since a Department's identity isn't already known from claims the way Branch's is.
- Every mutation in this codebase hand-rolls its own private `UNIQUE_CONSTRAINT_VIOLATION = "P2002"` translator rather than sharing one — `identity.service.ts` follows `customers.service.ts`'s exact pattern rather than importing from it.
- `branches-api.ts`/`use-branches.ts` are new, dedicated files (not additions to `tickets-api.ts`/`use-tickets.ts`), following this codebase's established "distinct domain, own file" convention already used by SLA policies/roles/business hours/audit logs/notifications.

## Out of scope

- Creating a new Branch, or any cross-branch/cross-organization branch administration (no `branch:create` permission, no `createBranch` method, no branch-switching UI).
- Hard-deleting a Branch or Department — only soft activation/deactivation via `isActive`.
- Any cascade, reassignment, warning, or modification of existing Ticket/SLA-policy/UserBranchRole/User data when a Branch or Department is deactivated.
- Any change to the existing active-only branch/department pickers or their consumers.
- Role/Permission mutation, TicketMessage/conversation work, any README change, and any navigation change beyond the single new link.
- Server-side write-path validation rejecting an inactive branch/department id at other, unrelated assignment points (e.g. `CreateUserDto.branchId`) — a pre-existing gap this story does not fix, to avoid pulling unrelated modules into this story's scope.
