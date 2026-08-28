> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-ticket-creation-fields/agent-workspace-ticket-creation-fields/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Ticket Creation: Contact / Department / Assignee

- **Feature slug (folder under `plans/`):** `agent-workspace-ticket-creation-fields`

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
Agent Workspace — Ticket Creation: Contact / Department / Assignee
```

---

## Description

```text
A Story 42+ recon (re-verified from scratch against the current, fully-committed repository — Story 42 confirmed clean and merged, zero backend commits since) confirmed `CreateTicketDto.contactId`/`departmentId`/`assignedToUserId` are still the last unconsumed fields on the ticket domain's backend contract: `create-ticket-view.tsx`'s own doc comment still states they are never sent, and `CreateTicketInput` is still exactly `{customerId, subject, category?, priority?}`.

This story closes all three, entirely with already-existing frontend infrastructure: `useCustomerQuery` (Story 26, whose `GET /customers/:id` already embeds `contacts` — no second endpoint), `useDepartmentsQuery` (Story 38, already proven by `CreateUserView` and, as of Story 42, `TicketDetailView`), and `useUsersQuery` (Story 23, already proven by `TicketDetailView`'s assignee picker). No new backend endpoint, DTO field, permission, or business rule.

Confirmed this planning pass: `UpdateTicketDto` has no `contactId` field, so this is the only possible path to ever link a contact to a ticket — department and assignee are already editable post-creation (the latter since Story 23, the former since Story 42), so this story's value for those two is "pick it up front" rather than "the only way," while for contact it is the *only* way.
```

---

## Acceptance criteria

```text
- Ticket creation gains an optional contact picker, populated from the selected customer's real, already-embedded contacts (`GET /customers/:id`) — no new backend endpoint.
- Switching the selected customer resets any previously chosen contact — a contact belonging to a different customer is never submittable.
- Ticket creation gains optional department and assignee pickers, sourced from the existing `GET /identity/departments`/`GET /identity/users`.
- Submitting without touching any of the three new fields produces the exact same `POST /tickets` payload as today (verified by the existing, unmodified exact-payload-equality test).
- Each of the three optional pickers shows its own inline load-error message on failure, independent of the others and of the rest of the form.
- No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or business rule. No automatic-assignment/routing logic — `assignedToUserId` is a manual pick only.
- No change to `ticket-detail-view.tsx`, `workspace-nav.tsx`, or any backend file.
- English and Arabic translations exist for every new string; RTL rendering is preserved.
- Component tests cover: conditional contact-picker rendering, customer-switch contact reset, zero-contacts customer, the exact-payload base case (unmodified), and each picker's independent load-error state.
- The root `README.md`'s existing "Ticket & customer creation" bullet is updated to describe the new capability — no other README section is touched.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `ticketing` Story 07/25 (`CreateTicketDto`); `agent-workspace-customer-management` Story 26 (`useCustomerQuery`, embedded contacts); `identity-branch-department-listing` Story 35 / `agent-workspace-user-admin` Story 38 (`useDepartmentsQuery`); `agent-workspace-ticket-operations-mvp` Story 23 (`useUsersQuery`); `agent-workspace-ticket-detail-reassignment` Story 42 (already-merged sibling, closed the `PATCH`-side half of this same DTO-completion effort).

- **Depends on code areas or other stories:** none inside `apps/api` — `tickets.controller.ts`/`tickets.service.ts`/DTOs are a read-only dependency, not modified. Touches `apps/web/src/lib/tickets-api.ts`, `apps/web/src/hooks/use-tickets.ts` (one line — an `enabled` guard on the existing `useCustomerQuery`), `apps/web/src/components/tickets/create-ticket-view.tsx` (+its spec), `apps/web/messages/{en,ar}.json`, and one `README.md` paragraph.

## Extra notes (optional)

- Re-derived from scratch, not assumed from the prior recon: git status/log, `.squad/plans`, the actual `CreateTicketDto`/`CreateTicketInput`/`create-ticket-view.tsx`/`create-ticket-view.spec.tsx` contents, and the `useCustomerQuery`/`useDepartmentsQuery`/`useUsersQuery` hook definitions were all read directly during this planning pass, not recalled from memory.
- **Sequencing, not parallel-safety**: this story and Story 42 both touch `apps/web/src/lib/tickets-api.ts` — Story 42 is already merged and not concurrent, so there is no live conflict; this is a historical note, not an active constraint. No other story is currently in-flight touching any of this story's files.
- **One small, backward-compatible hook change is required and disclosed up front**: `useCustomerQuery(id)` currently has no `enabled` guard; calling it with an empty `customerId` (before any customer is chosen) would fire a real, invalid `GET /customers/` request. Confirmed via `grep` that `CustomerDetailView` is the only other consumer and always passes a truthy id, so adding `enabled: Boolean(id)` is safe and zero-behavior-change for it.
- Workspace navigation menu ("A4") and any Customer Portal/Communication Channel work remain explicitly out of scope and unresolved by this story — those require a separate product decision this recon does not make.

## Technical hints (optional)

- `CreateTicketDto.contactId`/`.departmentId`/`.assignedToUserId` (all `@IsOptional() @IsUUID()`) confirmed via fresh inspection this planning pass — unchanged since Story 07/25.
- `CustomerDetail` (`tickets-api.ts`) already has `contacts: ContactSummary[]` embedded — confirmed via fresh inspection.
- The existing `create-ticket-view.spec.tsx` test asserting `toHaveBeenCalledWith({customerId, subject, category})` is an **exact**-equality check — the conditional-spread payload design must keep it passing unmodified.

## Out of scope

- Automatic assignment/routing logic.
- Any change to Ticket Detail, workspace navigation, Customer Portal, Communication Channels, role/permission mutation.
- Any new backend endpoint/DTO field/permission/Prisma model/migration/business rule.
- Reconciling the README's pre-existing, unrelated staleness beyond the one paragraph this story's own capability touches.
