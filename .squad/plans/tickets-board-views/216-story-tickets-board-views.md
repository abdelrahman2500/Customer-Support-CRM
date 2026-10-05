# Story 216 — Tickets board: views, columns, cards and toolbar

> CRM product redesign roadmap item **PR-3.1**. Intake: [`../../stories/tickets-board-views/tickets-board-views/intake.md`](../../stories/tickets-board-views/tickets-board-views/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 3; spec `../crm-product-redesign/tickets-kanban-ux.md` §2–§5; decision PD-3.

## Prerequisites

Stories 211 (Board, ListToolbar, SegmentedControl), 212 (unassigned Avatar), 215 (demo data).

## Story Goal

The board becomes the default Tickets view; the table remains as List.

**Non-goals:** moving cards (217), refresh and collisions (218), backend changes, manual ordering.

## Design decisions

1. **View choice** — `TicketsView` reads `?view=`, else localStorage `crm.tickets.view`, else board. The switcher is a SegmentedControl placed in each view's PageHeader.
2. **URL state** — `board-state.ts` parses/serializes with the list's parameter names (`search`, `priority`, `categoryId`, `assignedToUserId`, `unassigned`) plus `sort` and `risk`; `view=board` is written only alongside other state so `/tickets` stays clean.
3. **Data** — one `useInfiniteQuery` per column (`["tickets","board",status,filters]`, 25 per page) using the existing list endpoint; the column count is the server `total`.
4. **At risk** — a client-side filter over loaded cards (breached, or at risk and not on hold), as the API has no SLA-state filter.
5. **Card** — subject link stretched over the card, `aria-describedby` with status/priority/assignee; HIGH/URGENT get a 3px inline-start edge; SLA only for OPEN/IN_PROGRESS when at risk, breached or on hold; an `actions` slot above the link for Story 217.
6. **Closed** folded by default (localStorage `crm.tickets.board.closedCollapsed`); below `lg` one column at a time with a status SegmentedControl, Closed unfolded.

## Tasks

1. `board-state.ts`, `use-ticket-board.ts`, `ticket-card.tsx`, `ticket-board-column.tsx`, `ticket-board-view.tsx`, `tickets-view.tsx`; page renders `TicketsView`.
2. `tickets.board.*` messages in en and ar.
3. Specs for state, card, board and view switching.

## Verification Steps

1. web vitest, typecheck, lint, build.
2. Playwright full suite.
3. Board harness 390/768/1280/1440 × en/ar × light/dark (demo agent).

## Done Criteria

- [ ] Board default, List kept; per-column states; URL filters; parity checks; suites green.
