> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/tickets-board-views/tickets-board-views/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Tickets board: views, columns, cards and toolbar
- **Feature slug (folder under `plans/`):** `tickets-board-views`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-3.1**, global Story **216**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Tickets board: views, columns, cards and toolbar
```

---

## Description

```
Story 216 — PR-3.1 of the CRM product redesign (roadmap Phase 3;
tickets-kanban-ux.md §2–§5; decision PD-3: the board is the default view).

GOAL
/tickets opens on a four-column status board (Open, In progress,
Resolved, Closed) of scannable cards, with the existing table kept as the
secondary "List" view.

CONTEXT
- GET /tickets takes status, priority, categoryId, assignedToUserId,
  unassigned, search, sortBy (createdAt | updatedAt | slaUrgency), sortDir,
  page, pageSize (<= 100) and returns {items,total,...}; items embed
  slaTarget. No rank field (no manual ordering — roadmap NG).
- @crm/ui already ships Board/BoardColumn, ListToolbar, SegmentedControl
  (Story 211) and the unassigned Avatar (Story 212).

REQUIRED OUTCOME
1. Board/List switcher; URL `view` wins, then the browser's last choice,
   then the board.
2. One paged query per column (25 per page, "Show more"), each with its
   own loading, error-with-retry and empty message; counts from `total`.
3. Toolbar: search (the list's behaviour), quick views All / Mine /
   Unassigned / At risk, priority / assignee / category filters, sort
   (SLA urgency default, updated, newest, oldest); all in the URL with the
   list's parameter names.
4. Cards: stretched subject link with a description; urgency edge only for
   HIGH/URGENT; SLA only when it matters on active tickets; relative time;
   assignee avatar (unassigned variant).
5. Closed folded by default (remembered); phones show one column at a
   time with a status switcher.
```

---

## Acceptance criteria

```
- [ ] /tickets renders the board by default; the List view still works.
- [ ] Columns, counts, empties, errors and Show more behave per column.
- [ ] Filters and quick views round-trip through the URL.
- [ ] en/ar, RTL, light/dark, 390–1440 px without overflow.
- [ ] web tests, typecheck, lint, build and Playwright green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 211, 212, 215.
- **Depends on code areas or other stories:** `@crm/ui` Board, ListToolbar, SegmentedControl.

## Extra notes (optional)

- Moving cards (drag, keyboard, Move to) is Story 217; freshness is Story 218.

## Technical hints (optional)

- Files: `apps/web/src/components/tickets/board/**`, `tickets-view.tsx`, `use-ticket-board.ts`.

## Out of scope

- Moving cards, refresh/collisions, backend changes, manual ordering.
