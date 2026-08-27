> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-unassigned-tickets/agent-workspace-unassigned-tickets/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Unassigned Tickets & Self-Assign

- **Feature slug (folder under `plans/`):** `agent-workspace-unassigned-tickets`

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
Agent Workspace — Unassigned Tickets & Self-Assign
```

---

## Description

```text
Story 28 gave the Agent Workspace a real Dashboard showing an agent's own assigned tickets. A fresh recon found that a large share of real tickets in the branch have no assignee at all (live-verified: several hundred, out of just over 500 total) and no discoverable path exists anywhere in the UI to find or claim one — an unassigned ticket is invisible unless someone happens to scroll past it in the full branch-wide Ticket List.

This story adds a second Dashboard section, "Unclaimed tickets": open tickets with no assignee, each with a one-click "Claim" action that reuses the existing PATCH /tickets/:id assignment mechanism (the same endpoint, DTO field, and ticket:update permission the Ticket Detail screen's assignee picker already uses). No new backend endpoint, DTO field, permission, or business rule; the existing Ticket List is not modified.
```

---

## Acceptance criteria

```text
- The Dashboard shows a second card, "Unclaimed tickets," alongside "My open tickets."
- It fetches GET /tickets with no server-side filter and, client-side, shows only tickets where assignedToUserId is null and status is OPEN or IN_PROGRESS.
- Loading, error (with retry), and empty states are implemented for this section, independent of "My open tickets"'s own state.
- Rows are ordered breached-first, then soonest-remaining-target, then no-target-last, using the existing deriveSlaStatus/slaSortKey — no new SLA rule.
- Each row has a "Claim" button that calls PATCH /tickets/:id with { assignedToUserId: <the current agent's own id> } — the existing endpoint, existing DTO field, existing permission.
- While a claim is pending, that row's button shows a pending state and is disabled; no other row is affected.
- On a successful claim, no navigation occurs; the ticket disappears from "Unclaimed tickets" and appears in "My open tickets" once the already-existing query invalidation causes both sections to refetch — never assumed before the real response.
- On a rejected claim, an inline error renders under that specific row, distinguishing a 403 from a generic failure — the ticket remains in the list, unchanged.
- Already-assigned tickets never appear in this section and have no Claim action here.
- Clicking a row (outside the Claim button) navigates to the real tickets/{id} detail page; clicking the customer name navigates to customers/{id}, without also triggering the row's own navigation.
- The existing Ticket List (TicketListView) is not modified in any way by this story.
- No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or worker change is introduced.
- No protected file (RealtimeGateway, TicketRealtimeListener, BranchNotificationRealtimeListener, NotificationLog/listeners, any SLA-policies file, schema.prisma, migrations, TicketsController/TicketsService/DTOs, IdentityController, TicketListView, TicketDetailView, CustomerDetailView) is modified.
- English and Arabic translations exist for every new string under the existing dashboard.* namespace; RTL rendering is preserved.
- Component tests cover loading/error/empty/populated/scoping/exclusion/ordering/claim-success/claim-error/navigation/EN+AR.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `agent-workspace-ticket-operations-mvp` Story 23 (`PATCH /tickets/:id`, `ticket:update` permission, `useUpdateTicketMutation`); `agent-workspace-real-dashboard` Story 28 (`DashboardView`, `OPEN_STATUSES`, `slaSortKey`, `SlaPresentation`, `priorityBadgeVariant`, `customerNameById` — this story's second section lives inside the same component).

- **Depends on code areas or other stories:**
  - `apps/web/src/components/dashboard/dashboard-view.tsx` — extended with a second section, not replaced.
  - `apps/web/src/hooks/use-tickets.ts` (`useTicketsQuery`, `useUpdateTicketMutation`) — reused unmodified.
  - `apps/api/src/modules/tickets/**` — read-only dependency (`GET /tickets`, `PATCH /tickets/:id`), not modified.

## Extra notes (optional)

- This story was selected via a "Frontend-First Next-Story Recon" performed after Story 28, which found — via a real `GET /tickets` call against the running local API — that the large majority of real tickets in the branch have no assignee and no discoverable claim path, the single largest, most concretely-evidenced workflow gap found across the whole audit history of this project.
- **Numbering**: NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` (Story 24 was implemented directly from a user-supplied specification, no `.squad` representation exists or is fabricated for it) — unchanged by this story.
- Deliberate implementation-time deviation from the plan's literal "Expected Files" list: `UnclaimedTicketRow` (the per-row component that legally calls `useUpdateTicketMutation(ticket.id)` once per instance, per React's rules of hooks) was kept as a local, non-exported function component inside `dashboard-view.tsx` itself, rather than split into a separate file — matching this codebase's own established convention for small per-row/per-field subcomponents living alongside their parent (`SlaCell`/`FilterSelect`/`ListSkeleton` in `ticket-list-view.tsx`; `Field` in `ticket-detail-view.tsx`), and avoiding an awkward circular import between the parent and a would-be sibling file that both need the same SLA-presentation helpers.

## Technical hints (optional)

- `ListTicketsQueryDto.assignedToUserId` is `@IsUUID()`-only — there is no backend way to filter *for* "no assignee." This story does not add one; "Unassigned" is expressed purely client-side over the same unfiltered `GET /tickets` call `CustomerDetailView`/`TicketListView` already make.
- `UpdateTicketDto.assignedToUserId` (`@IsUUID()` optional) and `PATCH /tickets/:id`'s `ticket:update` permission are unchanged since Story 23 — a "claim" is exactly `{ assignedToUserId: <current agent's id> }`, nothing new.
- `useUpdateTicketMutation(id)`'s existing `onSuccess` already invalidates the `["tickets"]` query-key prefix broadly (TanStack Query's default partial-match invalidation), which refreshes **both** of the Dashboard's `useTicketsQuery` calls (`{ assignedToUserId }` and `{}`) with zero new invalidation code.

## Out of scope

- Any change to `TicketListView`'s filters (no "Unassigned" option added there).
- Reassignment of already-assigned tickets through this new section.
- Automatic/rule-based assignment of any kind.
- Any new backend endpoint, DTO field, or permission.
- SLA policy changes, notification changes, customer editing, admin UI, Knowledge Base, AI, Customer Portal, Reporting, Integrations.
