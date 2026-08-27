> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-customer-ticket-navigation/agent-workspace-customer-ticket-navigation/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Customer-to-Ticket Navigation

- **Feature slug (folder under `plans/`):** `agent-workspace-customer-ticket-navigation`

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
Agent Workspace — Customer-to-Ticket Navigation
```

---

## Description

```text
Story 26 gave the Agent Workspace a customer detail screen, and Story 26 also added a ticket -> customer "View customer" link. But the loop is still one-directional: once on a customer's detail page, an agent cannot see that customer's other tickets, cannot navigate to them, and cannot start a new ticket for that specific customer without re-picking them from a generic list. This story closes that dead end using only already-existing data and contracts — no new backend endpoint, no customerId query parameter on GET /tickets, no schema change.

The intended value chain is:

Existing GET /tickets (already returns customerId per ticket, already fully fetched unpaginated) + existing POST /tickets (already accepts customerId) -> a "Related Tickets" section on the existing Customer Detail screen (frontend, new) + a customerId query-parameter prefill on the existing Create Ticket screen (frontend, new) -> an agent can move freely between a ticket and its customer in both directions, and start a new ticket for a customer they're already looking at.
```

---

## Acceptance criteria

```text
- An authenticated agent viewing a customer's detail page sees a "Related tickets" section listing only tickets whose customerId matches that customer, derived by filtering the already-fetched, unpaginated GET /tickets result client-side — no backend customerId filter parameter is introduced.
- Each related ticket links to the existing ticket detail route (tickets/{id}).
- The related-tickets section has its own loading, error, empty, and populated states, following the same conventions already used elsewhere in the Agent Workspace (Skeleton, Alert, empty-state paragraph).
- A "New ticket" action on the customer detail page navigates to the existing tickets/new route with the current customer's id passed as a `customerId` query parameter.
- The existing Create Ticket screen, when loaded with a valid `customerId` query parameter matching a customer in the already-fetched customer list, pre-selects that customer in the existing customer picker.
- The agent can still change the pre-selected customer before submitting.
- When the query parameter is absent, missing, or does not match any loaded customer, Create Ticket's existing behavior (empty/unselected picker) is unchanged — no crash, no invented fallback behavior.
- No new backend endpoint, DTO, permission, Prisma model, migration, realtime event, or SLA behavior is introduced. `POST /tickets`/`GET /tickets` contracts are unchanged.
- No protected file (RealtimeGateway, TicketRealtimeListener, BranchNotificationRealtimeListener, NotificationLog/listeners, any SLA-policies file, schema.prisma, migrations) is modified.
- English and Arabic translations exist for every new string; RTL rendering is preserved.
- Component tests cover both the Customer Detail related-tickets section and Create Ticket's prefill behavior, following the exact conventions already used by the existing view specs.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `agent-workspace-ticket-operations-mvp` Story 23 (`GET /tickets`, `TicketListView` row conventions); `agent-workspace-ticket-customer-creation` Story 25 (`CreateTicketView`, `POST /tickets`); `agent-workspace-customer-management` Story 26 (`CustomerDetailView`, the ticket→customer "View customer" link this story completes the loop for).

- **Depends on code areas or other stories:**
  - `apps/web/src/components/customers/customer-detail-view.tsx` — extended, not replaced.
  - `apps/web/src/components/tickets/create-ticket-view.tsx` — extended, not replaced.
  - `apps/web/src/hooks/use-tickets.ts` (`useTicketsQuery`, `useCustomersQuery`) — reused unmodified.
  - `apps/api/src/modules/tickets/**` — read-only dependency (`GET /tickets`, `POST /tickets`), not modified.
  - Stories 23, 25, 26 must remain compatible and are not reimplemented.

## Extra notes (optional)

- This story was selected after a fresh, explicitly frontend-first recon following Story 26, which applied an "agent workflow test" (walk through handling a real ticket end to end) and found customer→ticket navigation to be the first genuine dead end — not cosmetic polish, and not blocked by any product or technical decision.
- **Numbering**: NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` (Story 24 was implemented directly from a user-supplied specification, no `.squad` representation exists or is fabricated for it) — unchanged by this story.
- Client-side filtering of the existing unpaginated `GET /tickets` result is the deliberate, sufficient mechanism for this story at the repository's current data volume — mirroring the exact precedent `TicketListView`'s own client-side name-resolution joins already established. A backend `customerId` filter parameter remains a small, separate, later mechanical option if the unpaginated list ever becomes a real problem; not needed now and not built by this story.

## Technical hints (optional)

- `TicketListItem.customerId` (already returned by `GET /tickets`, unchanged since Story 23) is the only field needed to filter client-side.
- `useTicketsQuery({})` (no filters) already fetches the full branch ticket list — reuse it directly rather than adding a new hook.
- Reading the `customerId` query parameter in `CreateTicketView` uses Next.js's standard `useSearchParams()` (`next/navigation`) — the first use of that hook in this codebase, but a standard, well-established API, not a new pattern requiring justification.
- The customer detail page's existing route is `apps/web/src/app/[locale]/(agent)/customers/[id]/page.tsx`; the ticket-creation route is `apps/web/src/app/[locale]/(agent)/tickets/new/page.tsx` — neither route file itself needs to change, since both already just wrap their view components.

## Out of scope

- Customer editing, contact CRUD, customer search/autocomplete.
- Ticket search, ticket pagination, a backend `customerId` filter parameter, any new API endpoint.
- Prisma/migration changes, realtime events, worker changes.
- Notification Center, notification recipient targeting, agent presence.
- Channels, Customer Portal, AI, Reporting, Administration, Integrations, `AutomationRule`.
- Attachments, comments, bulk operations, unassignment-to-`null`.
