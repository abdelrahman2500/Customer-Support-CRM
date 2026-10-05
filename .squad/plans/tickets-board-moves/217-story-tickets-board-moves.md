# Story 217 — Tickets board: moving cards

> CRM product redesign roadmap item **PR-3.2**. Intake: [`../../stories/tickets-board-moves/tickets-board-moves/intake.md`](../../stories/tickets-board-moves/tickets-board-moves/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 3; spec `../crm-product-redesign/tickets-kanban-ux.md` §5; decisions PD-2, PD-5.

## Prerequisites

Story 216 (the board, its column queries and the card `actions` slot).

## Story Goal

Cards move between status columns by pointer, keyboard or menu, optimistically and accessibly.

**Non-goals:** freshness and collisions (218), manual ordering, realtime broadcast, backend changes.

## Design decisions

1. **One entry point** — every path calls `requestMove(ticket, to, via)`: same column → "Move cancelled."; Resolved/Closed → the card's confirm popover (PD-5); otherwise `performMove`.
2. **Sensors** — `MouseSensor` (6px) and `TouchSensor` (200ms, 8px tolerance) on the whole card wrapper (a click still opens the ticket); `KeyboardSensor` only on the handle, so Enter on the subject link still navigates. Drag is disabled below `md`.
3. **Keyboard columns** — a custom coordinate getter jumps to the nearest column centre in the arrow's visual direction (dnd-kit passes the rect's top-left, so it centres the rect). Columns follow `dir`, so ← is "next" in Arabic without special-casing.
4. **Collision** — `pointerWithin`, falling back to `rectIntersection` for the keyboard.
5. **Data** — `useMoveTicketMutation`: cancel + snapshot `["tickets","board"]`; `removeFromPages` / `insertIntoPages` (sorted with a comparator mirroring the API's order); rollback on error, 404 also removes the card; invalidate `["tickets"]`, `["ticket", id]` and its history on settle.
6. **Announcements** — dnd-kit's built-in region is assertive and not configurable, so its announcements are silenced and every message (picked up, over, moved, cancelled, failed) goes through the board's own polite region. Screen-reader instructions keep dnd-kit's described-by mechanism.
7. **Focus** — after a keyboard/menu/confirmed move, focus goes to the moved card's handle (menu button on phones) in its new column (`focusRequest` keyed by id + status, so the source card does not take it). A menu pick runs after the menu finished closing, so the popover never overlaps it.
8. **Feedback** — `DragOverlay` with a level-3 `TicketCard` (`motion-safe:scale-[1.02]`, no drop animation with reduced motion); source card dashed and faded; target column `ring-2 ring-accent` + tint (not `outline`: tailwind-merge drops the bare `outline` next to `outline-2`); counts preview ±1.
9. **Icons** — `DragHandleIcon` (GripVertical) and `MoreActionsIcon` (Ellipsis) in `@crm/ui`.

## Tasks

1. Add `@dnd-kit/core` + `@dnd-kit/utilities` to `apps/web`.
2. `board-moves.ts`, `use-move-ticket.ts`, `board-card.tsx`; droppable column; view wiring; messages en/ar.
3. Specs: move rules, hook (real QueryClient), board interactions.

## Verification Steps

1. web/ui vitest, typecheck, lint, build; Playwright full suite.
2. Move harness as the demo agent: menu, keyboard (both directions), pointer, confirm/cancel, phone menu-only — en/ar × light/dark.
3. Board layout harness 390–1440.

## Done Criteria

- [ ] Three move paths; confirm; rollback; announcements; focus; parity checks; suites green.
