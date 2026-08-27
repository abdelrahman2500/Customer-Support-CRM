> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-sla-policy-admin/agent-workspace-sla-policy-admin/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — SLA Policy Management

- **Feature slug (folder under `plans/`):** `agent-workspace-sla-policy-admin`

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
Agent Workspace — SLA Policy Management
```

---

## Description

```text
SLA target computation, timer detection, escalation, and per-ticket status display have all been real since Stories 10-17/23, but nobody can see or adjust the actual SLA policies (response/resolution targets by branch/department/category/priority) anywhere in the UI — the full `SlaPoliciesController` CRUD (`POST/GET/GET:id/PATCH:id /sla-policies`) has had zero frontend consumer since Story 10.

This story adds a new, standalone screen: a list of the branch's SLA policies with inline editing of their targets/active-state, and a create form for a new policy. No new backend endpoint, DTO field, permission, or business rule — this is a pure frontend consumption of an already-complete backend contract, introduced as an entirely new route/component surface with zero overlap with the existing ticket/customer/dashboard screens.
```

---

## Acceptance criteria

```text
- A new `/sla-policies` route lists every SLA policy in the branch (via the existing `GET /sla-policies`), showing department/category/priority scoping, response/resolution target minutes, and active/inactive state.
- Each policy's response/resolution target minutes and active state are editable inline, saved via the existing `PATCH /sla-policies/:id` — never optimistic; a rejected mutation renders inline and leaves the prior value visible.
- A "New policy" action opens a create form (department/category/priority optional scoping fields, response/resolution target minutes required) that submits via the existing `POST /sla-policies`, mirroring the existing Create Ticket/Create Customer form conventions (plain `useState`, no form/validation library).
- The list has its own loading/error/empty/populated states, following the same conventions already used elsewhere in the Agent Workspace (Skeleton, Alert, empty-state paragraph).
- No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or business rule is introduced.
- No protected file (RealtimeGateway, TicketRealtimeListener, BranchNotificationRealtimeListener, NotificationLog/listeners, any SLA-computation/timer/escalation-listener file, schema.prisma, migrations, TicketsController/TicketsService/DTOs, TicketListView, TicketDetailView, CustomerDetailView, DashboardView) is modified.
- English and Arabic translations exist for every new string under a new, dedicated `slaPolicies.*` namespace; RTL rendering is preserved.
- Component tests cover the list's loading/error/empty/populated/inline-edit/403/generic-failure states and the create form's submit/validation/failure states.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `sla-policy-foundation` Story 10 (`SlaPoliciesController`, `SlaPolicy` model — read/write endpoints, never previously consumed by any frontend).

- **Depends on code areas or other stories:** none inside `apps/web` — this is a brand-new component/route surface. `apps/api/src/modules/sla-policies/**` is a read-only dependency, not modified.

## Extra notes (optional)

- Selected as part of an approved three-story parallel batch (Stories 30/31/32), each an independent workstream advancing a different Core Requirement category with zero required ordering between them.
- **Zero file overlap with Story 30 or Story 32**: this story deliberately introduces its own dedicated API-client file (`apps/web/src/lib/sla-policies-api.ts`) and hooks file (`apps/web/src/hooks/use-sla-policies.ts`) rather than adding to the existing shared `tickets-api.ts`/`use-tickets.ts` — SLA policies are a genuinely distinct domain with no prior precedent forcing it into those shared files, unlike Customer/Contact (Story 30) and User (Story 32), which already have partial representation there from earlier stories.
- No persistent cross-screen navigation menu exists anywhere in the Agent Workspace today (`WorkspaceNav` has no nav links at all — not even to the existing Tickets/Customers/Dashboard screens); this story does not add one either, consistent with how every existing screen is already reached via a specific in-page button or a direct URL, not a global menu. Adding a persistent nav bar would be a genuinely separate, cross-cutting concern touching shared chrome all three parallel stories would otherwise compete over — explicitly out of scope here.
- **Numbering**: NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` — unchanged by this story.

## Technical hints (optional)

- `CreateSlaPolicyDto` (`departmentId?`, `category?`, `priority?`, `responseTargetMinutes!`, `resolutionTargetMinutes!`) and `UpdateSlaPolicyDto` (all optional, plus `isActive?`) are both confirmed via fresh inspection this turn — a simple flat shape, no nested objects.
- `sla:create`/`sla:read`/`sla:update` permissions already gate these routes and are already granted to the seeded SuperAdmin (proven by this project's own prior live verifications of `SlaPoliciesController`-adjacent endpoints).
- `Business HoursCalendarsController` (calendar + exceptions CRUD) is explicitly **not** part of this story's scope — see Out of scope.

## Out of scope

- Business-hours calendar configuration UI (a separate, larger admin surface — `BusinessHoursCalendarsController` is not consumed by this story).
- Any change to how SLA targets are computed, detected, or escalated (all backend-owned, unchanged).
- A persistent cross-screen navigation menu/nav bar.
- Any change to `TicketListView`, `TicketDetailView`, `CustomerDetailView`, or `DashboardView`.
- Any new backend endpoint, DTO field, permission, Prisma model, migration, or business rule.
- Knowledge Base, AI, Customer Portal, Reporting, Integrations, generalized `AutomationRule` engine, user administration.
