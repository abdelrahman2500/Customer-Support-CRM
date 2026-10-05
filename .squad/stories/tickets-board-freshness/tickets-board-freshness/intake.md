> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/tickets-board-freshness/tickets-board-freshness/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Tickets board: freshness and verification
- **Feature slug (folder under `plans/`):** `tickets-board-freshness`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-3.3**, global Story **218**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Tickets board: freshness and verification
```

---

## Description

```
Story 218 — PR-3.3 of the CRM product redesign (roadmap Phase 3;
tickets-kanban-ux.md §6, §11; decision PD-4: realtime broadcast DEFERRED).

GOAL
The board stays honest about other agents' work without a realtime
backend change, and the whole move flow is covered end to end.

CONTEXT
- Realtime has per-ticket rooms only; no branch-level ticket events.
- The web QueryClient turns refetchOnWindowFocus off globally.
- The API has no versioning: the last write wins.

REQUIRED OUTCOME
1. Column queries refetch every 30s while the tab is visible (never in
   the background) and on window focus; "Show more" pages survive; no
   refetch while a card is dragged or a move is saving.
2. Change cue: a card someone else moved in, created, re-assigned or
   re-prioritised pulses once after the refetch (static ring with reduced
   motion); never the agent's own moves, "Show more" or filter changes.
3. Collision: if the ticket changed since the board last refreshed, the
   move still applies and a toast says "This ticket was also changed by
   someone else; your move was applied."
4. Playwright `agent-moves-ticket-on-board.spec.ts`: menu, keyboard,
   confirm/Escape, collision, and an external change arriving on focus.
```

---

## Acceptance criteria

```
- [ ] 30s/focus refetch, paused during drag/save (unit-tested with timers).
- [ ] Cue appears for others' changes only; clears after a moment.
- [ ] Collision toast on an overridden change.
- [ ] Playwright suite green including the new spec.
- [ ] web tests, typecheck, lint, build green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 216, 217.
- **Depends on code areas or other stories:** the board column queries and `useMoveTicketMutation`.

## Extra notes (optional)

- The branch-level relay design stays documented in tickets-kanban-ux.md §6 for a later track.

## Technical hints (optional)

- Files: `use-ticket-board.ts`, `board-moves.ts`, `ticket-board-column.tsx`, `apps/e2e/tests/agent-moves-ticket-on-board.spec.ts`.

## Out of scope

- Realtime broadcast, optimistic concurrency/versioning, backend changes.
