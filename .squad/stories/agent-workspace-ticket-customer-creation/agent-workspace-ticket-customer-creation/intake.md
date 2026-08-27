> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-ticket-customer-creation/agent-workspace-ticket-customer-creation/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Ticket & Customer Creation

- **Feature slug (folder under `plans/`):** `agent-workspace-ticket-customer-creation`

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
Agent Workspace — Ticket & Customer Creation
```

---

## Description

```text
Close the last basic usability gap in the Agent Workspace: an authenticated agent can currently view, filter/sort, and act on tickets (Story 23) and receive branch-wide realtime notifications (Story 24), but cannot create a new customer or a new ticket from the browser — both exist only as backend REST endpoints (POST /customers, POST /tickets), already implemented, permissioned, and tested since Story 06/07.

This story adds two frontend-only forms — Create Customer and Create Ticket — using exactly the existing backend contracts. It introduces no new backend endpoint, DTO, permission, Prisma model, migration, realtime event, or SLA behavior.

The intended value chain is:

Existing POST /customers, POST /tickets (backend, unmodified) → new Agent Workspace forms (frontend, new) → the agent can originate work, not just manage what already exists.
```

---

## Acceptance criteria

```text
- An authenticated agent can navigate to a "Create Customer" screen from the existing Agent Workspace and submit a form that calls the existing `POST /customers` with the existing `CreateCustomerDto` shape (`displayName`).
- A successful customer creation surfaces the new customer (e.g. by navigating to it or otherwise making it visible) and does not silently discard the result.
- A failed customer creation (validation error or backend rejection) is shown inline, using the existing error-handling convention (never optimistic, never swallowed).
- An authenticated agent can navigate to a "Create Ticket" screen from the existing Agent Workspace and submit a form that calls the existing `POST /tickets` with the existing `CreateTicketDto` shape (`customerId`, `subject`, optional `category`/`priority`; `contactId`/`departmentId`/`assignedToUserId` are not required by this story's minimum scope).
- The agent selects an existing customer for the new ticket using the existing `GET /customers` list (already fetched elsewhere in the workspace) — no new backend search/autocomplete/pagination endpoint is introduced.
- A successful ticket creation navigates the agent to the new ticket's detail page (the existing `tickets/[id]` route) and the ticket list reflects the new ticket on next visit (existing query-invalidation convention).
- A failed ticket creation (validation error or backend rejection, e.g. an out-of-scope customer id) is shown inline, never swallowed, never applied optimistically.
- No new Prisma model, migration, backend controller, backend service, backend DTO, or permission is introduced.
- No customer search/autocomplete backend endpoint, pagination endpoint, bulk import, attachments, comments, or rich text editor is introduced.
- No change to `RealtimeGateway`, `TicketRealtimeListener`, `BranchNotificationRealtimeListener`, `NotificationLog`/its listeners, any SLA-policies file, `schema.prisma`, migrations, or seeded permissions.
- No Customer Portal, Channels, Integrations, AI, Reporting, Administration, `AutomationRule`, or Agent Presence work is introduced.
- No ticket unassignment-to-`null`, no new realtime event, no new SLA behavior.
- English and Arabic translations exist for every new string; RTL rendering is preserved (existing logical-property convention).
- Unit/component tests cover both forms following this repository's existing test conventions (mocked hooks/socket where Story 23/24's own tests already established the pattern).
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `customer-management` Story 06 (`POST /customers`); `ticketing` Stories 07–09 (`POST /tickets`, domain events, history); `agent-workspace-ticket-operations-mvp` Story 23 (workspace shell, `ui/` primitives, TanStack Query hooks, routing conventions); `agent-workspace-notification-display` (Story 24 — implemented directly from a supplied specification; has no `.squad` representation of its own, see "Extra notes").

- **Depends on code areas or other stories:**
  - `apps/api/src/modules/customers/**` (`CustomersController`/`CustomersService`/`CreateCustomerDto`) — read-only dependency, not modified.
  - `apps/api/src/modules/tickets/**` (`TicketsController`/`TicketsService`/`CreateTicketDto`) — read-only dependency, not modified.
  - `apps/web/src/lib/tickets-api.ts`, `apps/web/src/hooks/use-tickets.ts`, `apps/web/src/components/ui/**` — existing frontend conventions this story extends, not replaces.
  - Stories 06, 07–09, 20, 22, 23 must remain compatible and are not reimplemented.

## Extra notes (optional)

- This story was selected after a repository-evidence-based recon following Story 24, which found it to be the only remaining Agent Workspace gap not blocked by an undecided product/business policy (unlike notification recipient targeting, first communication channel, Customer Portal auth, agent presence semantics, etc., all of which need a human product decision this story does not attempt to make).
- **Numbering note:** Story 24 ("Agent Workspace: In-App Notification Display") was implemented directly from a user-supplied specification and was never given a `.squad/plans`/`.squad/stories` representation. `.squad/plans/00-index.md` still ended at NN 23 before this story. This intake is filed as **Story 25** (matching the real, already-shipped story count) rather than reusing NN 24, to avoid colliding with the already-shipped Story 24 — see this feature's `00-overview.md` for the explicit note. No retroactive Story 24 intake/plan is being fabricated by this story.
- Three presentation-level decisions were resolved during this intake/plan rather than escalated, because each has a safe, precedent-based answer already present in the repository (see the plan's "Design" section for the reasoning):
  1. Customer selection for ticket creation uses the existing full `GET /customers` list in a `Select`, mirroring the already-established assigned-agent picker pattern in `TicketDetailView` — no new backend capability.
  2. Customer creation and ticket creation remain two separate, independent flows (matching the two independent, unrelated REST endpoints) — no combined/inline "create a customer while creating a ticket" flow in this story.
  3. Both use dedicated routes (`tickets/new`, `customers/new`), mirroring Story 23's existing routing convention — not a modal/dialog (the installed-but-never-used `@radix-ui/react-dialog` dependency is not activated by this story, avoiding new UI-primitive scope for a first form).

## Technical hints (optional)

- Existing endpoints: `POST /api/v1/customers` (`{ displayName }` → `CustomerSummary`), `POST /api/v1/tickets` (`{ customerId, subject, category?, priority?, contactId?, departmentId?, assignedToUserId? }` → `TicketSummary`). Both already e2e-tested (`apps/api/test/customers.e2e-spec.ts`, `apps/api/test/tickets.e2e-spec.ts`).
- Permissions `customer:create`/`ticket:create` already exist in the seed's `PERMISSION_CATALOG` and are already granted to `SuperAdmin` — no seed change needed.
- Reuse `apps/web/src/lib/tickets-api.ts`'s `apiFetch`/`ApiError` pattern, `apps/web/src/hooks/use-tickets.ts`'s query/mutation shape, and `apps/web/src/components/ui/**` primitives (`Input`, `Select`, `Button`, `Alert`). No new dependency.

## Out of scope

- Customer search/autocomplete backend endpoint; pagination; bulk customer import; bulk ticket creation.
- Attachments, ticket comments, rich text editing.
- Contact creation as part of this flow (`contactId` stays optional/omitted).
- Department/assignment selection at creation time (both stay optional/omitted; already editable afterward via Story 23's ticket detail actions).
- Customer Portal, Channels, Integrations, AI, Reporting, Administration, `AutomationRule`, Agent Presence.
- Ticket unassignment-to-`null`.
- Any new realtime event, room, or SLA behavior.
- Any backend contract change of any kind.
