> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-ticket-detail-reassignment/agent-workspace-ticket-detail-reassignment/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Ticket Detail: Subject & Department Reassignment

- **Feature slug (folder under `plans/`):** `agent-workspace-ticket-detail-reassignment`

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
Agent Workspace — Ticket Detail: Subject & Department Reassignment
```

---

## Description

```text
A Story 41+ recon (re-verified this pass against the current, now-fully-committed repository state) confirmed `PATCH /tickets/:id`'s `UpdateTicketDto` has always accepted `subject` and `departmentId`, but Ticket Detail — the single highest-traffic screen in the Agent Workspace — has never exposed either: the ticket's subject renders as static text with no edit path anywhere, and its department is not read, shown, or editable anywhere in the component at all, not even read-only.

This story closes both gaps using only already-existing frontend infrastructure: `useDepartmentsQuery()` (added by Story 38, already consumed by `CreateUserView`'s own department picker) and the exact "editable heading" pattern `CustomerDetailView` already established for its own display-name field. No new backend endpoint, DTO field, permission, or business rule — this is a pure frontend consumption of an already-complete backend contract.

Confirmed this planning pass: `UpdateTicketDto` has no `contactId` field at all, so contact-linking can only ever be addressed at ticket-creation time (a separate, deliberately sequenced-after story, since it and this one both touch `tickets-api.ts`).
```

---

## Acceptance criteria

```text
- Ticket Detail's subject is editable (blur-commit), saved via the existing `PATCH /tickets/:id` — never optimistic; an empty value is never sent; a rejected mutation renders inline and leaves the prior value visible.
- Ticket Detail's department is editable via a `Select` sourced from the existing `GET /identity/departments` (`useDepartmentsQuery()`), saved via the same existing `PATCH /tickets/:id` — same never-optimistic rule.
- Both new fields use the exact same 403-vs-generic inline error convention every other field on this screen already uses — no new error-handling branch.
- No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or business rule is introduced.
- No change to `create-ticket-view.tsx`/`CreateTicketInput`, any SLA/notification/audit file, or a workspace navigation menu.
- English and Arabic translations exist for every new string; RTL rendering is preserved.
- Component tests cover: subject edit/commit/no-commit-when-unchanged-or-empty, department edit/commit, department-load-error, and confirm the existing 403/generic mutation-error tests remain green unmodified.
- The root `README.md`'s existing one-sentence description of Ticket Detail's editable-field set is extended to mention subject/department — no other README section is touched.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `ticketing` Story 07/09 (`Ticket.departmentId`, `UpdateTicketDto`); `identity-branch-department-listing` Story 35 / `agent-workspace-user-admin` Story 38 (`GET /identity/departments`, `useDepartmentsQuery()` — already implemented, this story is its second consumer).

- **Depends on code areas or other stories:** none inside `apps/api` — `tickets.controller.ts`/`tickets.service.ts`/DTOs are a read-only dependency, not modified. Touches exactly `apps/web/src/lib/tickets-api.ts`, `apps/web/src/components/tickets/ticket-detail-view.tsx` (+its spec), `apps/web/messages/{en,ar}.json`, and one sentence of `README.md`.

## Extra notes (optional)

- Selected via a repo-driven recon that re-verified (not assumed) the gap still exists post-Story-41, that Story 41 introduced no dependency change, and that no stronger candidate emerged since backend was untouched across Stories 38–41.
- **Sequencing with Story 43** ("Ticket Creation — Contact/Department/Assignee", the prior recon's "A3"): both stories touch `apps/web/src/lib/tickets-api.ts` (different interfaces — `UpdateTicketInput` here, `CreateTicketInput` there) — per this project's own established parallel-safety rule, Story 43 must not run concurrently with this one; it should start only after this story merges.
- Workspace navigation menu ("A4") remains explicitly excluded — no repository evidence or product decision in this intake changes that prior, repeated deferral.
- README update is scoped to the single existing sentence that already enumerates Ticket Detail's editable fields. The README's separate, pre-existing staleness (its "through Story 32" header, its "Status by story" list stopping at 32, and its "Known gap: Story 31" note — now inaccurate, since Story 31 is present in the repository as of this session) spans nine already-shipped, unrelated stories (33–41) and is **not** reconciled by this story.

## Technical hints (optional)

- `UpdateTicketDto.subject` (`@IsString() @MinLength(1)`) and `.departmentId` (`@IsUUID()`) confirmed via fresh inspection this planning pass — both optional, both already accepted, unchanged since Story 07/09.
- `useDepartmentsQuery()` (`apps/web/src/hooks/use-tickets.ts`) confirmed already implemented (Story 38), returning `DepartmentSummary[] = {id, branchId, name}[]`, branch-scoped server-side, `staleTime: 5*60_000` — reused verbatim, no new hook.
- `CustomerDetailView`'s displayName field (`customer-detail-view.tsx`) confirmed as the exact existing "editable heading" precedent to mirror for the ticket subject.

## Out of scope

- Ticket creation's contact/department/assignee pickers (Story 43).
- A "clear department to none" control (no equivalent exists for the existing assignee field either).
- Any new backend endpoint/DTO field/permission/Prisma model/migration/business rule.
- A persistent cross-screen navigation menu.
- Reconciling the README's pre-existing, unrelated staleness beyond the one sentence this story's own capability touches.
- Knowledge Base, AI, Customer Portal, Reporting, Integrations, Communication Channels, generalized `AutomationRule` engine.
