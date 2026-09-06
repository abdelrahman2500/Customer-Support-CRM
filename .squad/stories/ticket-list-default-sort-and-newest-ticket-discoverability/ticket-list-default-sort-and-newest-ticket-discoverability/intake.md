> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-list-default-sort-and-newest-ticket-discoverability/ticket-list-default-sort-and-newest-ticket-discoverability/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `ticket-list-default-sort-and-newest-ticket-discoverability`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Ticket list default sort and newest ticket discoverability
```

---

## Description

The agent ticket list currently defaults to oldest-first creation order. This
makes newly submitted work difficult to discover because the first page is
occupied by the oldest tickets. Change the default list ordering so the most
recently created tickets appear first, with the API and agent UI using the
same default.

The selected default is `createdAt desc`, not `updatedAt desc`: the workflow
needs to surface newly submitted tickets, while updates to older tickets
should not continually displace genuinely new intake. Existing explicit sort
options remain user-controlled.

The change must preserve the existing branch-scoped visibility, pagination,
stable ordering, and query serialization contracts. Treat the ticket `id` as
the deterministic tie-breaker after the requested sort field so records with
equal timestamps do not move unpredictably between pages.

---

## Acceptance criteria

- [ ] With no explicit sort parameters, `GET /tickets` returns tickets by
	`createdAt` descending, then `id` as the stable tie-breaker.
- [ ] The agent ticket list initializes to the same `createdAt desc` default;
	the API and UI must not silently disagree.
- [ ] The default is explicitly documented and tested as `createdAt desc`,
	rather than `updatedAt desc`, because this story targets newest-ticket
	intake discoverability.
- [ ] An explicit user-selected sort field and direction are preserved and
	continue to reach the API unchanged, including toggling sort direction.
- [ ] Changing filters or search resets pagination to the first page and
	clears or invalidates the existing page token as required by the current
	pagination contract.
- [ ] Changing page preserves the active filters, search, and explicit sort
	choice; it must not revert to the default order.
- [ ] Existing branch/departments visibility rules, pagination response shape,
	and stable ordering behavior remain intact.
- [ ] Focused API and web tests cover the default, explicit sort preservation,
	stable tie-breaking, and filter/search/page reset behavior.

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** (tracker ids only; optional short note)
- **Depends on code areas or other stories:** Existing ticket list endpoint,
  `TicketsService.listTickets`, `ListTicketsQueryDto`, ticket list query
  serialization, and `TicketListView` pagination/filter/sort state. Builds on
  the ticket pagination and server-side SLA ordering work already present in
  the repository; no external provider or schema decision is required.

## Extra notes (optional)

- This is a discoverability and workflow correction, not a redesign of the
	ticket list and not a new pagination feature.
- Preserve an explicit user sort across refreshes and page navigation. Only
	the initial/default state should change for users who have not selected a
	sort.

## Technical hints (optional)

- APIs/screens/services: `apps/api/src/modules/tickets/tickets.service.ts`,
  `apps/api/src/modules/tickets/dto/list-tickets-query.dto.ts`,
  `apps/web/src/components/tickets/ticket-list-view.tsx`, and
  `apps/web/src/lib/tickets-api.ts`. Repos/roots: `.`. Primary language:
  `typescript`.

## Out of scope

- `updatedAt desc` as the default ordering.
- SLA ranking, ticket business rules, branch/departments visibility changes,
  or changes to ticket creation/update timestamps.
- New filters, new pagination mechanics, UI redesign, database migrations,
  or unrelated customer-list ordering.
