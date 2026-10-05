# crm-product-redesign — Tickets Kanban UX specification

Companion to [`00-overview.md`](./00-overview.md) (Phase 3, Stories PR-3.1–PR-3.3) and [`visual-direction.md`](./visual-direction.md).

The goal is that implementation can follow this document without guessing. Product decisions are marked **PD-n**; their outcomes are in the overview §9.

Status: **approved 2026-10-05** (PD-2 `@dnd-kit/core`, PD-3 board default, PD-4 realtime broadcast **deferred**, PD-5 confirm, PD-6 demo dataset).

---

## 1. What the backend already supports (verified 2026-10-05)

| Need | Existing capability | File |
|---|---|---|
| Change status | `PATCH /api/v1/tickets/:id` `{ status }`. Permission `ticket:update`, which the seeded Agent role holds. Returns `{ id }`. | `apps/api/src/modules/tickets/tickets.controller.ts:52`, `dto/update-ticket.dto.ts` |
| Transition rules | Fully permissive: any status may move to any status, including CLOSED → OPEN (`assertValidTicketStatusTransition`). | `tickets/ticket-status-transitions.ts:31` |
| Side effects | `resolvedAt` is set when entering RESOLVED/CLOSED and cleared on reopen. `ticket.updated` drives: history entry, webhook, portal NotificationLog (and possibly a portal email), and realtime to room `ticket:{id}`. No CSAT, SLA or automation effect from a status change. | `tickets.service.ts:405-474`, listeners |
| List per column | `GET /tickets?status=X` (or `statuses[]`), with `priority`, `categoryId`, `assignedToUserId`, `unassigned`, `customerId`, `search`, `sortBy` (`createdAt`/`updatedAt`/`slaUrgency`), `sortDir`, `page`, `pageSize` (default 25, max 100). The response carries `total`. Each item embeds `slaTarget` (targets + `onHoldSince`). | `list-tickets-query.dto.ts`, `tickets.service.ts:253-364` |
| Scope | Branch-scoped; department-visibility roles see their department plus unassigned-department tickets. There is no ownership check: anyone who can see a ticket can move it. | `tickets.service.ts:908-1027` |
| Realtime | Only per-ticket rooms. **There is no branch-level `ticket.updated`/`ticket.created` broadcast.** | `realtime/ticket-realtime.listener.ts` |

What does **not** exist:
- a rank/position field (no manual ordering inside a column);
- optimistic concurrency (last write wins);
- a department filter on the list;
- per-status counts for Agents (`/reports/ticket-volume` needs `report:read`);
- an unassign (`assignedToUserId: null` is rejected).

**Conclusion: the board needs no new API.** It reads one list query per column and moves cards with the existing PATCH. The optional realtime broadcast (PD-4) is **deferred**, so the board keeps itself fresh by refetching (§6).

## 2. Information architecture

- **Route:** `/[locale]/tickets` keeps its URL.
  - A new query param `view=board|list` selects the view. The default is `board` (**PD-3**, approved).
  - The last chosen view is remembered per browser in `localStorage` (a convenience only; the URL always wins).
- **Views:**
  - **Board** (new, primary): status columns.
  - **List**: the existing table, kept and restyled. It is genuinely better for bulk scanning, sorting by dates and paging through history. Its URL params and specs keep working.
- **Shared toolbar** (both views). The filters live in the URL through the existing `useUrlFilters`:
  - **search**: placeholder "Search by subject or category..." is kept, and it still commits on blur and on Enter, so `agent-resolves-ticket` keeps working;
  - **quick views** (segmented): All · Mine · Unassigned · At risk (client-side SLA filter on the loaded cards, label "in loaded tickets") — maps to `assignedToUserId=me`, `unassigned=true`;
  - **filters**: priority, assignee (Combobox incl. "Me"), category;
  - **sort** inside columns: SLA urgency (default) · Recently updated · Newest · Oldest;
  - a **result summary** (`role=status`): "128 tickets" (the sum of the column totals);
  - **clear all**.
- **Board-only controls:** a "Columns" menu to show or hide Resolved and Closed (both shown by default; Closed starts collapsed, see §4).
- The status filter is hidden on the board, because the columns are the status. In the list view it stays.

## 3. Board layout

```
┌ Tickets ─────────────────────────────── [Board | List]   [+ New ticket] ┐
│ [Search…………]  (All|Mine|Unassigned|At risk)  Priority▾ Assignee▾ Category▾  Sort: SLA urgency▾   128 tickets · Clear │
├───────────────┬───────────────┬───────────────┬──────┤
│▔▔▔▔ info ▔▔▔▔▔│▔▔ progress ▔▔▔│▔▔ success ▔▔▔▔│ ▔▔▔  │  ← status spine (3px)
│ ● Open     42 │ ◐ In prog. 31 │ ✓ Resolved 50 │Closed│
│ ┌───────────┐ │ ┌───────────┐ │ ┌───────────┐ │  5   │  ← collapsed rail,
│ │card       │ │ │card       │ │ │card       │ │  ▸   │    click to expand
│ └───────────┘ │ └───────────┘ │ └───────────┘ │      │
│ …             │ …             │ …             │      │
│ [Show 17 more]│               │               │      │
└───────────────┴───────────────┴───────────────┴──────┘
```

- **Columns** follow the fixed status order: Open → In progress → Resolved → Closed. Under `dir="rtl"` they lay out right-to-left with no special code (flex in logical order). Column width is `minmax(272px, 1fr)`, with a 12px gap.
- **Column header:**
  - the status icon and localized label (from the RD-1.14 presentation map);
  - the count in a pill (`tabular-nums`; the column query's `total`, which respects every filter);
  - a 3px top spine in the status tone;
  - on Open, a menu with "Sort this column". Columns share one sort by default.
- **Column body:**
  - scrolls vertically on its own, so the board fits the viewport height (`calc(100dvh - header - toolbar)`) and the page itself never scrolls sideways at ≥ 1280;
  - cards are 8px apart.
- **Closed column** is collapsed by default to a 56px rail (icon, vertical label, count). Clicking expands it, and the state is remembered. Collapsing keeps the board at three readable columns at 1280 with the sidebar expanded.
- **Volume:**
  - each column loads 25 cards (`pageSize=25`) through `useInfiniteQuery`, with "Show N more" at the end (the count is `total` minus loaded);
  - no infinite scroll, so focus order stays predictable;
  - virtualization is not needed at this volume. It would be revisited only if a column routinely exceeds about 300 loaded cards (§10).

## 4. Card anatomy

```
┌───────────────────────────────────────┐
▌ #1A2B3C4D · Billing          ⋯  ⠿     │  ← urgency edge (HIGH/URGENT only), short id,
▌ Customer can't download invoice for  │    category, menu (⋯), drag handle (⠿)
▌ March after plan change              │  ← subject, 2 lines max, title attr = full
▌ ACME Corp · Sara Nabil               │  ← customer · contact (when known)
▌ [▲ High] [⏱ Breached 2h]   (SN)●  4m │  ← priority, SLA chip, assignee avatar, updated
└───────────────────────────────────────┘
```

- The **whole card is a link** to `/tickets/:id`: a semantic `<a>` that wraps the content, so Enter opens it. The drag handle and the "⋯" menu are separate buttons, so they don't nest inside the link.
- **Fields, in priority order:**
  1. **subject** (`body-sm`, weight 500, 2-line clamp);
  2. **customer name** (`ink-muted`);
  3. **priority**: shown as a badge only for HIGH/URGENT; LOW/MEDIUM show just an icon with an accessible label, to keep noise down. HIGH/URGENT also get the urgency edge;
  4. **SLA chip**: on-track is hidden (no noise), while at-risk, breached and on-hold show the `SlaIndicator` compact chip with the governing target;
  5. **assignee**: `Avatar` sm with a presence dot, or a dashed "Unassigned" avatar. The name is in the accessible name and the tooltip;
  6. **updated**: relative time ("4m"), with the absolute time in the `<time title>`;
  7. **short id** and **category** on the meta line (`caption`).
- **The card's accessible name** is the subject. Its description is "Status · Priority · Assignee · SLA" (via `aria-describedby`), so a screen-reader user hears the facts without reading every chip.
- **The card menu** contains:
  - Open;
  - Move to → (the other statuses);
  - Assign to me (if not already mine; hidden otherwise, not disabled);
  - Copy link.

  It uses the same handlers as the ticket header (Story 202). Moves into Resolved/Closed from the menu use the same confirmation as a drag (§5).
- **States:**
  - hover: level 2;
  - focus-visible: ring;
  - selected via keyboard pickup: accent ring plus level 3;
  - saving: spinner in place of the drag handle, card at 60% opacity;
  - failed: reverts to its column with a toast.

## 5. Moving cards

**Interactions** (all of them call one `moveTicket(id, toStatus)`; drag uses `@dnd-kit/core`, PD-2):

1. **Pointer drag** with the handle or the whole card (≥ md). The activation distance is 6px for mouse and a 200ms press for touch, so a scroll or tap is never mistaken for a drag.
2. **Keyboard drag** on the handle (`"Move {subject}"`):
   - Space or Enter picks the card up;
   - ←/→ move to the previous/next column, mirrored in RTL so "next" is always the reading direction;
   - Space or Enter drops; Escape cancels.
3. **"Move to" menu** on the card's "⋯" button, available at every breakpoint. This is the screen-reader and touch-friendly path, and the only path on phones.

**Drag feedback:**
- the lifted card follows the pointer at level 3, scaled 1.02, with no rotation;
- a placeholder outline stays in the source column;
- the target column gets an accent outline and a soft tint;
- the column count previews +1/−1;
- with reduced motion, there is no scale and the drop is instant.

**There is no reordering inside a column.** Order is the selected sort. A card dropped into a column lands at its sorted position, and the column briefly highlights it. Manual rank would need a schema change and is out of scope (§9).

**Data flow** (TanStack Query):
1. `onMutate`: cancel the affected column queries; snapshot them; remove the card from the source pages; insert it into the target's first page at its sort position; adjust both `total`s.
2. `mutationFn`: `PATCH /tickets/:id { status }`, the existing `updateTicket` client.
3. `onError`: restore the snapshots, then toast with copy keyed by the error:
   - 403: "You don't have permission to move this ticket.";
   - 404: "This ticket is no longer available." — and remove the card;
   - 400: the transition message;
   - network: the shared message.
4. `onSettled`: invalidate both columns, `["tickets"]` (list view, dashboard) and `["ticket", id]`.

**Confirmation and undo:**
- Moves between Open and In progress are immediate, with no confirmation.
- Moves into **Resolved** or **Closed** notify the customer (portal notification log, and possibly email). They therefore show a compact inline confirm popover anchored to the card: "Resolve this ticket? The customer is notified." [Resolve] [Cancel]. Enter confirms; focus goes to Resolve. Escape or Cancel returns the card to its source column with no request. There is no undo toast (**PD-5**, approved).

**Announcements** (polite live region, localized):
- "Picked up {subject}. Use arrow keys to choose a status, Space to drop."
- "{subject} is over In progress."
- "Moved {subject} to Resolved."
- "Move cancelled."
- "Couldn't move {subject}: {reason}."

**Focus:** after a keyboard or menu move, focus goes to the moved card's handle in its new column, and that column scrolls it into view.

## 6. Freshness (no realtime backend change — PD-4 deferred)

- The agent's **own** moves update instantly (optimistic, §5).
- **Other agents' changes** arrive through refetching only:
  - every column query refetches every **30s** while the tab is visible (`refetchInterval: 30_000`, `refetchIntervalInBackground: false`) and on window focus;
  - refetches never reset scroll position, "Show more" pages or an in-progress drag;
  - a column does not refetch while one of its cards is being dragged or saved.
- **Change cue:** when a refetch shows a card that changed status, assignee or priority since the last render (and the change was not the agent's own), the card settles into its new place with the drop-settle motion and a brief accent pulse. A newly created ticket appears at its sorted position with the same pulse. The vocabulary is shared with the ticket-header cues of RD-3.13 (PR-3.4). With reduced motion, only the pulse colour remains.
- **Conflicts:** the last write wins (the API has no versioning). If the agent moves a card that another agent changed after the last refetch, the agent's PATCH is authoritative. When the refetch after the move shows a different status from the one the drag started in, the toast says "This ticket was also changed by someone else; your move was applied."
- **Deferred design (for a later track):** a branch-level relay (room `branch:{branchId}:tickets` receiving `ticket.created`/`ticket.updated` with the `TicketSummary`, authorized like `branch:{id}:notifications`, department-filtered server-side) would replace polling with in-place live updates. It is not built in this track.

## 7. Responsive behaviour

| Width | Behaviour |
|---|---|
| **≥ 1280** | Full board; Closed collapsed by default. All three move paths. |
| **768–1279** | The board scrolls horizontally in its own container with scroll-snap per column (the page does not scroll sideways). Columns are 280px. Pointer and touch drag (press-and-hold) and the menu. While dragging near the container's edge, it auto-scrolls. |
| **< 768** | **Column switcher**: a segmented control with status, count and spine colour, sticky under the toolbar, showing one column as a full-width list. Swiping between columns is not used (it conflicts with scrolling and is not discoverable). Moving uses the "Move to" menu only, with no drag. Filters collapse into a "Filters (n)" Sheet. |

Arabic: the column order, switcher order, arrow keys, auto-scroll edges and drag offsets all follow `dir`.

## 8. States

| State | Design |
|---|---|
| Initial load | Column skeletons: header plus 3 card skeletons shaped like real cards (no generic bars). |
| Column error | The column body shows a compact ErrorState ("Couldn't load Open tickets" + Retry). The other columns keep working. |
| Empty column | A quiet empty state in the column, with copy per status (e.g. Open: "No open tickets — nice work."; Resolved: "Nothing resolved yet."). |
| Empty board after filtering | A board-level EmptyState: "No tickets match these filters" + Clear filters. The `isFiltered` vocabulary from QueryStateCard. |
| Background refetch | A `FetchingIndicator` in the toolbar meta. Cards never flash or reorder because of a refetch unless the data changed. |
| Offline | Refetches pause while offline (TanStack Query's online manager) and resume on reconnect. Dragging stays enabled; a failed PATCH reverts with the network message. |
| Saving / failed move | §4–§5. |
| No permission | Not pre-hidden (the UI has no permission model and that decision stands). A 403 reverts and toasts. |

## 9. Backend / API implications

| Item | Needed? | Notes |
|---|---|---|
| Status change endpoint | **No** | Use `PATCH /tickets/:id`. |
| Per-column queries and counts | **No** | One `GET /tickets?status=X&pageSize=25` per column. `total` gives the count and respects filters and visibility. Four parallel requests per filter change; acceptable. |
| Assignee names on cards | **No** | Resolved client-side from `useUsersQuery` (already loaded for filters). |
| **Branch-level realtime relay** | **Deferred — PD-4** | Not built in this track. The board refetches every 30s and on focus (§6). |
| Department filter on the list | Optional, deferred | Only if a "Team" filter is wanted. Additive DTO field. |
| Manual ordering (rank) | **Not recommended** | Needs a schema migration, rank maintenance and a reorder API. Sorting by SLA urgency is the better workflow for support. |
| Optimistic concurrency | Not recommended now | Last-write-wins plus realtime correction is enough for the demo and current scale. |
| Unassign via drag or menu | Not available | PATCH rejects a null assignee (Story 204 finding). |
| Demo dataset | **Approved — PD-6** | An idempotent dev-only seed, so the board looks real in a demo (§10). |

## 10. Performance and scale

- Up to 4 × 25 cards are rendered initially. "Show more" adds 25 per click, up to the API's `pageSize` maximum of 100 per request.
- Cards are memoized. The drag overlay renders a lightweight clone.
- Above about 300 loaded cards in a column, virtualization would be needed (`@tanstack/react-virtual`). That is out of scope until it is observed, and is recorded as a risk.
- **The demo dataset (PD-6)** creates about 120 tickets across all statuses, priorities, categories and assignees, with SLA targets that produce on-track, at-risk, breached and on-hold examples, real-sounding subjects in en and ar, and a few messages and notes per ticket. It runs from `apps/api` as `pnpm prisma:seed:demo` and never runs in CI.

## 11. Testing

- **Unit (Vitest):**
  - card anatomy (priority/SLA visibility rules, accessible name and description);
  - column states (loading, error, empty, filtered-empty);
  - URL/view parsing;
  - `moveTicket` optimistic update, rollback per error code, and invalidations;
  - the Move-to menu path end to end;
  - the confirm popover for Resolved/Closed;
  - announcements;
  - RTL arrow mapping (a pure function);
  - the mobile switcher.
- **Playwright (new `agent-moves-ticket-on-board.spec.ts`):**
  - create a ticket over the API, then find it on the board by search;
  - pointer drag Open → In progress, then reload and assert the column;
  - keyboard move In progress → Resolved with confirmation, then reload;
  - the Move-to menu at a 390px viewport;
  - an RTL run at `/ar/tickets`.

  `agent-resolves-ticket` must stay green unchanged. The search placeholder and on-blur commit are kept for exactly this reason.
- **Harness** (scratchpad): the board at 390/768/1280/1440 × en/ar × light/dark, checking for no page-level horizontal overflow, the count pills, the spine contrast and the drag overlay screenshot.
