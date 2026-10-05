# Story 206 — Unified timeline

> CRM UI/UX redesign roadmap item **RD-3.6**. Intake: [`../../stories/unified-timeline/unified-timeline/intake.md`](../../stories/unified-timeline/unified-timeline/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 3 "RD-3.6"; recon TW-04.

---

## Prerequisites

- Story 205 (`MessageThread`/`MessageBubble`, the "Conversation" card), Story 193 (`historyEventKey`), Story 203 (the inspector), Stories 49/50 (escalations and notes cards, and their specs).
- **Phase 3 constraints:** no API change; every note, event and escalation stays visible; `agent-customer-live-chat` must pass, with any selector change recorded.

---

## Story Goal

The conversation card becomes the **ticket timeline**: customer messages, replies, internal notes, history events and SLA escalations, interleaved in time order in one thread.

- **Internal notes can't be mistaken for replies (TW-04):** a tinted warning surface with a border, a lock icon and an "Internal note" text label. Tone is never the only cue.
- **Events are compact rows:** an icon, the localized label, the actor when known, and the time.
- **A filter** (All / Conversation / Notes / Events), keyboard-operable.
- **The separate Notes, History and SLA Escalations cards are removed.** Their content, fallbacks and loading/error/empty messages carry over verbatim.

**Non-goals:**
- note editing or deletion (roadmap NG);
- merging the two composers (RD-3.7): the note composer stays, below the reply composer, under an "Internal note" caption;
- the portal; any backend change.

---

## Design decisions

1. **The timeline lives in `TicketChatCard`**, which already owns the thread.
   - It also reads `useTicketNotesQuery`, `useTicketHistoryQuery` and `useTicketEscalationsQuery`: the same hooks and query keys the view uses today, so no new request.
   - It takes a `noteComposer?: ReactNode` slot. The view passes its existing `AddNoteForm` unchanged (RM-06 @mention included), so this Story doesn't move the composer code. RD-3.7 replaces both composers.
   - `TARGET_TYPE_LABEL_KEYS` and the `historyEventKey` use move with the content, verbatim.
2. **Items.**
   - Messages, notes, history entries and escalations are each mapped to `{ key, kind, at, node }`, then stably sorted by `Date.parse(at)`. Equal times keep source order.
   - Keys are prefixed per kind (`message:`, `note:`, `history:`, `escalation:`), so ids never collide.
   - `MessageThread` groups them by day.
3. **Notes.**
   - `MessageBubble` gains `tone: "note"`: `border border-warning-border bg-warning-subtle text-ink-strong`.
   - It also gains a `label?: ReactNode` slot, put first on the meta line: `[lock] Internal note · Jane Agent · 10:05`.
   - The sender is now wrapped in its own `<span>`, so it is queryable alone; this changes nothing visually.
   - Align end when the author is the current user, otherwise start.
   - Sender: `userNameById.get(authorUserId) ?? authorUserId` (verbatim, never "You", as before). The avatar uses the same name.
4. **Event rows** are a local `TimelineEvent` in the card: a centred caption line (`flex flex-wrap justify-center gap-x-tight text-caption text-ink-subtle`), holding an icon, the label in `font-medium text-ink`, an optional detail, and `· <time dateTime title=formatDateTime>formatTime</time>`.
   - **History:** `HistoryEventIcon` and `t(detail.historyEvent.<key>)`. The actor is `userNameById.get(actorUserId)` when resolvable; it is omitted for `null` (system) or an unknown id, so a raw id is never shown for a field that wasn't shown before.
   - **Escalation:** `WarningIcon` (`text-warning-foreground`) and `t(detail.timelineEscalated)` ("SLA escalated"). The target label goes in its own `<span>`, with the raw `targetType` fallback kept.
5. **Filter.**
   - The existing `Tabs` primitive (Radix: roving focus, arrow keys that follow `dir`), with `TabsList` named `detail.timelineFilterLabel`.
   - Triggers are `all | conversation | notes | events`; the default is `all`, held in local state.
   - Each `TabsContent` renders its own `MessageThread` (label `detail.chatHeading`) with that tab's kinds. Only the active one is mounted, and it scrolls to its end on mount.
6. **States.**
   - **Loading:** while any source is loading, the existing skeleton.
   - **Errors:** each failed source shows its existing inline error (`chatLoadError`/`notesError`/`historyError`/`escalationsError`) in All and in its own tab; the other sources still render.
   - **Empty** (only when its source succeeded with `[]`):
     - Conversation → `chatEmpty`;
     - Notes → `notesEmpty`;
     - Events → `historyEmpty` and/or `escalationsEmpty`, per empty source;
     - All → `chatEmpty` only when everything is empty.
7. **Icons:** `InternalNoteIcon` (lucide `Lock`) and `HistoryEventIcon` (lucide `History`) join the vocabulary, with the icons spec and barrel updated.
8. **Messages** (`tickets.detail`, en/ar):
   - `timelineFilterLabel` "Show" / "عرض";
   - `timelineFilter.{all,conversation,notes,events}`: "All", "Conversation", "Notes", "Events" / "الكل", "المحادثة", "الملاحظات", "الأحداث";
   - `internalNoteLabel` "Internal note" / "ملاحظة داخلية";
   - `timelineEscalated` "SLA escalated" / "تصعيد اتفاقية مستوى الخدمة".

   Existing keys are kept. `notesHeading`/`historyHeading`/`escalationsHeading` stay in the files for now; they are unused but cheap, and their removal is left to the Phase 7 sweep.
9. **Playwright:** on the agent page, click the "Conversation" tab once after the page opens. The All view of a fresh ticket shows its "Ticket created" event, not "No messages yet.". Every existing assertion and `li` count then holds unchanged; the reason is recorded in the spec.

---

## Context — Read These Files First

1. `apps/web/src/components/tickets/ticket-chat-card.tsx` (+ spec).
2. `apps/web/src/components/tickets/ticket-detail-view.tsx`: the Notes, SLA Escalations and History cards, `AddNoteForm`, `TARGET_TYPE_LABEL_KEYS`.
3. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx`: Story 49/50/RM-06/156, the Phase 3 guard, Story 203 inspector.
4. `packages/ui/src/components/{message-bubble,message-thread,tabs}.tsx`, `packages/ui/src/lib/icons.ts`.
5. `apps/e2e/tests/agent-customer-live-chat.spec.ts`.

---

## Tasks

1. **ui:**
   - `MessageBubble` tone `note`, the `label` slot, the sender span (+ spec cases);
   - the two icons (+ icons spec);
   - rebuild `@crm/ui` if consumed from dist (it isn't; source-consumed — verify).
2. **`ticket-chat-card.tsx`:** the timeline, the filter, states and the `noteComposer` slot.
3. **`ticket-detail-view.tsx`:**
   - remove the three cards;
   - pass `noteComposer={<AddNoteForm ticketId={ticketId} />}`;
   - drop now-unused imports and queries;
   - update the Story 156 layout comment.
4. **Messages** in en and ar.
5. **Specs:**
   - **chat card:** mock the three new hooks (empty by default); add cases for interleaved order, the note tone, lock and label, the event actor resolved or omitted, the escalation label, the filter (arrow keys), per-tab empties and per-source errors.
   - **detail view:** update the guard, the Story 156 and Story 203 lists, and the Story 49/50 selectors (tab first for empties, `getByTitle` for full timestamps, the card via `closest`), each with its reason. No assertion is dropped.
6. **Playwright** tab click.

---

## Verification Steps

1. ui and web tests, typecheck and lint; prettier only on changed files that were clean at HEAD.
2. Web build; Playwright `agent-customer-live-chat` and `agent-resolves-ticket`.
3. Harness, 320/768/1280 × en/ar × light/dark, on a ticket with messages, a note, history and (if seeded) an escalation:
   - the log is present, items are in time order and notes are tinted with a label;
   - tabs work by keyboard (ArrowRight/ArrowLeft, mirrored in RTL);
   - 0 overflow.
4. Run `git diff --check`; check the protected checksum; commit path-scoped.

---

## Done Criteria

- [ ] One timeline holds messages, notes, history and escalations in time order; the three cards are gone, with nothing lost.
- [ ] Notes are distinct by surface, icon and text label; events are compact rows with a resolved actor.
- [ ] The filter is keyboard-operable, with the right empties and errors per tab.
- [ ] The note composer and @mention are unchanged; specs, build and Playwright green; harness 0 overflow.
