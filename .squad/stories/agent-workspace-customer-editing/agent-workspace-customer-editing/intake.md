> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-customer-editing/agent-workspace-customer-editing/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Customer & Contact Editing

- **Feature slug (folder under `plans/`):** `agent-workspace-customer-editing`

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
Agent Workspace — Customer & Contact Editing
```

---

## Description

```text
Customer Detail (Story 26/27) is read-only: an agent can view a customer's name/status/contacts/related tickets, but can never fix a typo, deactivate a customer, or add/edit a contact — despite `PATCH /customers/:id` and `POST/PATCH /customers/:id/contacts` already existing, fully permission-gated, unchanged since Stories 06/25.

This story adds edit capability to the existing Customer Detail screen: an inline edit affordance for the customer's own displayName/isActive, and add/edit forms for contacts. No new backend endpoint, DTO field, permission, or business rule — this is a pure frontend consumption of an already-complete backend contract.
```

---

## Acceptance criteria

```text
- An agent can edit a customer's displayName and isActive status from the existing Customer Detail screen, saved via the existing PATCH /customers/:id.
- An agent can add a new contact to a customer via the existing POST /customers/:id/contacts.
- An agent can edit an existing contact's fullName/email/phone/isPrimary via the existing PATCH /customers/:id/contacts/:contactId.
- All three actions never assume success: the query cache is only invalidated (forcing a real re-fetch) after each real response resolves; a rejected mutation renders inline and leaves the prior state visible.
- A rejected mutation distinguishes a 403 (no permission) from a generic failure, matching the existing actionForbidden/actionFailed convention already used by Ticket Detail.
- No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or business rule is introduced.
- No protected file (RealtimeGateway, TicketRealtimeListener, BranchNotificationRealtimeListener, NotificationLog/listeners, any SLA-policies file, schema.prisma, migrations, TicketsController/TicketsService/DTOs, TicketListView, TicketDetailView, DashboardView) is modified.
- English and Arabic translations exist for every new string under the existing customers.detail.* namespace; RTL rendering is preserved.
- Component tests cover the edit form's loading/success/validation/403/generic-failure states for both the customer fields and contact CRUD, following the exact conventions already used by customer-detail-view.spec.tsx and create-customer-view.spec.tsx.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `customer-management` Story 06 (`PATCH /customers/:id`, `POST/PATCH /customers/:id/contacts`); `agent-workspace-customer-management` Story 26 (`CustomerDetailView`, `useCustomerQuery`).

- **Depends on code areas or other stories:**
  - `apps/web/src/components/customers/customer-detail-view.tsx` — extended, not replaced.
  - `apps/web/src/lib/tickets-api.ts` — additive only: new `updateCustomer`, `createContact`, `updateContact` functions alongside the existing `CustomerSummary`/`ContactSummary`/`CustomerDetail` types (already there since Stories 25/26).
  - `apps/web/src/hooks/use-tickets.ts` — additive only: new `useUpdateCustomerMutation`, `useCreateContactMutation`, `useUpdateContactMutation`, mirroring `useUpdateTicketMutation`'s never-optimistic invalidation convention exactly.
  - `apps/api/src/modules/customers/**` — read-only dependency, not modified.

## Extra notes (optional)

- Selected as part of an approved three-story parallel batch (Stories 30/31/32), each an independent workstream advancing a different Core Requirement category with zero required ordering between them.
- **Disclosed file overlap**: `apps/web/src/lib/tickets-api.ts` and `apps/web/src/hooks/use-tickets.ts` are shared, pre-existing infrastructure files already holding Customer/Contact/Ticket/User types and hooks together (an established repository convention predating this batch, not something this story introduces). Story 32 (`agent-workspace-user-admin`) also makes small, additive, distinctly-named additions to these same two files. This is the only overlap between any of the three parallel stories — see the plan's own "Parallel-batch overlap note" for the full analysis and mitigation. Story 31 (`agent-workspace-sla-policy-admin`) introduces its own dedicated files and has zero overlap with either.
- **Numbering**: NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` — unchanged by this story.

## Technical hints (optional)

- `UpdateCustomerDto` (`displayName?`, `isActive?`) and `UpdateContactDto`/`CreateContactDto` (`fullName`, `email?`, `phone?`, `isPrimary?`) are all confirmed, unchanged since Stories 06/25 — no new field is needed.
- Contacts have no independent permission namespace (`contacts.controller.ts`'s own doc comment): every contact route reuses `customer:create`/`customer:update` — the exact same permission the customer-field edit itself already requires.
- Mirror `create-customer-view.tsx`'s plain-`useState`-form convention (no form/validation library) and `ticket-detail-view.tsx`'s inline-edit-with-blur-commit pattern for the customer's own fields, since both precedents already exist in this codebase.

## Out of scope

- Customer interaction history, notes, attachments (still no such capability anywhere).
- Contact deletion (no `DELETE` endpoint exists for contacts or customers).
- Any change to `TicketListView`, `TicketDetailView`, `DashboardView`, or any SLA/admin/notification screen.
- Any new backend endpoint, DTO field, permission, Prisma model, migration, or business rule.
- Knowledge Base, AI, Customer Portal, Reporting, Integrations, generalized `AutomationRule` engine.
