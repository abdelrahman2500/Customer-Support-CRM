> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-customer-management/agent-workspace-customer-management/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Customer List & Detail

- **Feature slug (folder under `plans/`):** `agent-workspace-customer-management`

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
Agent Workspace — Customer List & Detail
```

---

## Description

```text
Story 25 gave the Agent Workspace customer *creation*, but there is still no way to see a customer again afterward: no customer list screen, no customer detail screen, no contacts view. The backend has fully supported this since Story 06 (GET /customers, GET /customers/:id with embedded contacts, GET /customers/:id/contacts) — tested, permissioned, unmodified since. This story is the read/view mirror-image of Story 23's ticket list/detail, applied to the Customers domain that already has the backend to support it.

The intended value chain is:

Existing GET /customers, GET /customers/:id (backend, unmodified) -> new Agent Workspace customer list + detail screens (frontend, new) -> an agent can look up a customer they (or a colleague) already created, the same way they can already look up a ticket.
```

---

## Acceptance criteria

```text
- An authenticated agent can navigate to a "Customers" list screen showing the customers returned by the existing `GET /customers`, following the same loading/error/empty-state conventions as the existing Ticket List.
- An authenticated agent can open a customer's detail screen (an existing customer id) and see that customer's information plus its contacts, loaded from the existing `GET /customers/:id` (contacts already embedded in that response — no second request is added unless the repository proves the embedded shape insufficient).
- Contacts are displayed read-only — no create/edit/delete affordance for contacts is introduced.
- No customer edit affordance is introduced (`PATCH /customers/:id` stays unused by the frontend).
- Wherever the existing Ticket List or Ticket Detail already displays a resolved customer name, a "View customer" navigation path to that customer's detail screen is added, without modifying any existing backend behavior or the shape of what's already displayed.
- No search, no pagination, no bulk import — matching the Ticket List's own existing, accepted limitation.
- Unauthenticated access to either new route redirects to login, exactly like every existing Agent Workspace route.
- No new backend endpoint, DTO, controller, service method, Prisma model, migration, permission, or realtime event is introduced.
- No protected file (RealtimeGateway authorization, TicketRealtimeListener, BranchNotificationRealtimeListener, NotificationLog/listeners, any SLA-policies file, schema.prisma, migrations) is modified.
- English and Arabic translations exist for every new string; RTL rendering is preserved.
- Component tests exist for both new screens, following the exact mocking/rendering conventions already used by `ticket-list-view.spec.tsx`/`ticket-detail-view.spec.tsx`.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `customer-management` Story 06 (`GET /customers`, `GET /customers/:id`, contacts endpoints); `agent-workspace-ticket-operations-mvp` Story 23 (Ticket List/Detail UI patterns, `ui/` primitives, query-hook conventions, routing conventions); `agent-workspace-ticket-customer-creation` Story 25 (the `customers/new` route this story becomes a sibling of, and the `useCustomersQuery` cache this story's list screen also reuses).

- **Depends on code areas or other stories:**
  - `apps/api/src/modules/customers/**` (`CustomersController`/`CustomersService`) — read-only dependency, not modified.
  - `apps/web/src/lib/tickets-api.ts`, `apps/web/src/hooks/use-tickets.ts`, `apps/web/src/components/ui/**`, `apps/web/src/components/tickets/ticket-list-view.tsx` / `ticket-detail-view.tsx` — existing frontend conventions this story mirrors, not replaces.
  - Stories 06, 23, 25 must remain compatible and are not reimplemented.

## Extra notes (optional)

- This story was selected after a repository-evidence-based recon following Story 25, which found "an existing, fully-tested backend capability (Customer detail + contacts) with zero frontend consumer" to be the single lowest-risk, most dependency-ready, most already-decided remaining Agent Workspace gap — stronger on every axis than notification-targeting evolution, agent presence, search/pagination infrastructure, or starting any new domain (Channels/Portal/KB/AI/Reporting/Administration/Integrations/Automation), all of which require a new product or technical decision this story does not make.
- Presentation-level decisions resolved by direct precedent, not escalated: list/detail as dedicated routes (`customers/page.tsx`, `customers/[id]/page.tsx`), mirroring Story 23's ticket routes exactly; no search/pagination (mirrors the Ticket List's own accepted limitation); contacts shown read-only, using the customer-detail response's already-embedded `contacts` array (no second request); customer editing and contact CRUD explicitly deferred, mirroring how Story 23 shipped ticket *viewing* before Story 25 added ticket *creation* — view-before-edit is this repository's own established sequencing.

## Technical hints (optional)

- `CustomersService.getCustomer(id)` already returns `CustomerSummary & { contacts: ContactSummary[] }` — the plan should confirm this and reuse it directly rather than adding a second `GET /customers/:id/contacts` call.
- Reuse `apps/web/src/lib/tickets-api.ts`'s `apiFetch`/`ApiError` pattern and `apps/web/src/hooks/use-tickets.ts`'s query-hook shape (`useCustomersQuery` already exists for the list; a new `useCustomerQuery(id)` is needed for detail).
- The existing `TicketListView`'s `customerNameById.get(ticket.customerId)` cell and `TicketDetailView`'s customer-name line are the two existing "displays a resolved customer name" spots the new "View customer" link attaches to.

## Out of scope

- Customer editing (`PATCH /customers/:id` frontend usage).
- Contact creation, editing, deletion.
- Customer search, pagination, bulk import.
- Attachments, comments, rich text.
- Any change to ticket creation, existing backend endpoints, Prisma schema/migrations, realtime, SLA, or notification behavior.
- Customer Portal, Channels, AI, Reporting, Administration, Integrations, `AutomationRule`, Agent Presence.
