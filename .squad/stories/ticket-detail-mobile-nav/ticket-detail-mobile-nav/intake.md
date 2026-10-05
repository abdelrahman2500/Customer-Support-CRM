> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-detail-mobile-nav/ticket-detail-mobile-nav/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket detail: mobile/tablet, skeleton, prev/next
- **Feature slug (folder under `plans/`):** `ticket-detail-mobile-nav`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-3.5**, global Story **220**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Ticket detail: mobile/tablet, skeleton, prev/next
```

---

## Description

```
Story 220 — PR-3.5 of the CRM product redesign (roadmap Phase 3; merges
RD-3.12 and RD-3.14 without keyboard shortcuts).

GOAL
The ticket page works on phones and tablets, loads into a skeleton of
its real shape, and lets an agent step to the previous/next ticket in the
order they came from.

CONTEXT
- Below lg the page was one long column: header facts, conversation,
  attachments, then every inspector section.
- The board and list keep their filters in the URL with shared names.

REQUIRED OUTCOME
1. Below lg: a compact header (created/updated move to Details) and a
   sticky Conversation | Details switch; the composer stays with the
   conversation. At 320–390 px status, SLA and the composer are reachable
   without scrolling past the conversation; no horizontal scroll.
2. TicketDetailSkeleton matches the v2 layout.
3. Prev/next: board and list ticket links carry their context
   (?from=board|list + filters); the ticket page shows "n of N" and
   previous/next links in that order (cached query), and Back returns to
   the same view and filters. No context → no prev/next.
```

---

## Acceptance criteria

```
- [ ] Phone/tablet panels; compact header; no overflow in en/ar.
- [ ] Skeleton shaped like the page.
- [ ] Prev/next and Back follow the board/list order and filters.
- [ ] web tests, typecheck, lint, build and Playwright green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** Stories 216, 219.
- **Depends on code areas or other stories:** board/list URL state, the ticket workspace.

## Extra notes (optional)

- Keyboard shortcuts (RD-3.14's other half) are not in this track.

## Technical hints (optional)

- Files: `ticket-neighbours.tsx`, `ticket-detail-view.tsx`, `ticket-header.tsx`.

## Out of scope

- Shortcuts, swipe gestures, crossing page boundaries in the list.
