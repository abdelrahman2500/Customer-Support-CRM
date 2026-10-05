> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/tickets-board-moves/tickets-board-moves/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Tickets board: moving cards
- **Feature slug (folder under `plans/`):** `tickets-board-moves`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-3.2**, global Story **217**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Tickets board: moving cards
```

---

## Description

```
Story 217 — PR-3.2 of the CRM product redesign (roadmap Phase 3;
tickets-kanban-ux.md §5; decisions PD-2 `@dnd-kit/core`, PD-5 confirm
before Resolved/Closed).

GOAL
Agents change a ticket's status by moving its card: pointer drag, keyboard
drag, or a "Move to" menu that works at every width.

CONTEXT
- PATCH /tickets/:id { status } exists; every transition is allowed; no
  rank field (no manual ordering), no optimistic concurrency.
- Moving into Resolved/Closed notifies the customer (portal notification
  log, possibly email).
- The board (Story 216) keeps one infinite query per column under
  ["tickets","board",status,filters]; cards have an `actions` slot.

REQUIRED OUTCOME
1. `@dnd-kit/core` (+ utilities): mouse (6px), touch (200ms press) and
   keyboard sensors; ←/→ jump between columns, mirrored by layout in RTL.
2. "⋯" menu on every card with "Move to" the other statuses; the only
   path on phones.
3. Optimistic move (cancel, snapshot, remove from source, insert at the
   sorted position in the target, adjust totals); rollback on error with
   copy keyed by 403 / 404 (card removed) / 400 / network; invalidate
   lists and the ticket afterwards.
4. Inline confirm popover for Resolved/Closed ("The customer is
   notified."), focus on the confirm action; Escape/Cancel leaves the card.
5. Polite localized announcements (picked up, over, moved, cancelled,
   failed); focus returns to the moved card after a keyboard/menu move.
6. Drag feedback: lifted overlay (level 3, 1.02 scale unless reduced
   motion), dashed placeholder, target ring + tint, count preview ±1.
```

---

## Acceptance criteria

```
- [ ] Menu, keyboard and pointer moves work in en and ar, light and dark.
- [ ] Resolved/Closed confirm; cancel sends nothing.
- [ ] Failed moves roll back with the right message.
- [ ] Phones move through the menu only, and the switcher follows the card.
- [ ] web/ui tests, typecheck, lint, build and Playwright green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Story 216.
- **Depends on code areas or other stories:** the board components, `updateTicket`.

## Extra notes (optional)

- Freshness (30s refetch, change cue, collision toast) is Story 218.

## Technical hints (optional)

- Files: `apps/web/src/components/tickets/board/**`, `apps/web/src/hooks/use-move-ticket.ts`.

## Out of scope

- Manual ordering, realtime broadcast (PD-4), unassign, backend changes.
