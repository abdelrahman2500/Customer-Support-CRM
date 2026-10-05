# Story 205 — MessageThread v2

> CRM UI/UX redesign roadmap item **RD-3.5**. Intake: [`../../stories/message-thread-v2/message-thread-v2/intake.md`](../../stories/message-thread-v2/message-thread-v2/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 3 "RD-3.5"; recon TW-03.

---

## Prerequisites

- Story 189 (`Avatar`), Story 194 (`formatDate`/`formatTime`/`formatDateTime`), Story 203 (the ticket inspector layout).
- **Phase 3 constraints:** no API change; `agent-customer-live-chat` must pass, with selector changes recorded.

---

## Story Goal

The web ticket conversation becomes a proper thread:

- **Announced:** `role="log"`, so new messages are read out.
- **Grouped by day,** with a date per day; times on each message (TW-03).
- **Sender, avatar and delivery state** per message.
- **Scroll that respects the reader:** it follows new messages only while the agent is at the bottom. Otherwise a "New messages" pill appears (TW-03's auto-scroll-on-every-update).
- **Renamed** "Live Chat" → **"Conversation"** (en/ar), web only.

**Non-goals:**
- the portal chat card (keeps "Live Chat")
- message attachments; pagination
- composer changes (RD-3.7)
- timeline interleaving (RD-3.6)
- any backend change

---

## Design decisions

1. **`MessageThread`** (`packages/ui`, `"use client"`). Props:
   - `label` (the accessible name);
   - `items: { key: string; at: string /* ISO */; node: ReactNode }[]`, in order;
   - `formatDay(at) => string`;
   - `newMessagesLabel`;
   - `className`.

   It renders `<div className="relative">`, containing:
   - `<div role="log" aria-live="polite" aria-label={label} className="max-h-[60vh] min-h-64 overflow-y-auto …">`. For each **local** day (y/m/d from `new Date(at)`, the runtime zone as everywhere else) it renders a `<div>` group: a date label `<p>` (caption, centred, with rules on both sides via `Separator`s, aria-hidden *except* the text) and an `<ol>` of `<li>` items. Day labels are **not** `<li>`, so message `<li>` counts are unchanged.
   - a pill, when there are unseen messages: `<button>` "New messages", absolutely placed at the bottom centre, which scrolls to the end and hides.
2. **Scroll rule.**
   - On the first render with items, and whenever the item count grows **while the reader was at the bottom** (within 32px), it scrolls to the end.
   - If the count grows while the reader is scrolled up, it keeps the position and shows the pill.
   - Scrolling back to the bottom hides the pill.
   - Being at the bottom is tracked in a ref, updated `onScroll`.
3. **`MessageBubble`** (`packages/ui`). Props:
   - `align: "start" | "end"`, `tone: "mine" | "other"`;
   - `sender`, `avatar?` (decorative);
   - `at` (ISO), plus `timeLabel` and `dateTimeLabel` (already formatted by the caller: the primitive is translation- and locale-free);
   - `status?` (the delivery slot); `children` (the body).

   Layout: the avatar sits on the outer side (logical order), the body is `rounded-surface px-3 py-2 whitespace-pre-wrap` (mine: `bg-accent text-accent-foreground`; other: `bg-surface-muted text-ink-strong`), and the meta line `sender · <time dateTime title>` + status, at `max-w-[80%]`.
4. **Web `TicketChatCard`.**
   - Same sender rules and delivery labels.
   - Items are mapped to `MessageBubble`, with `avatar={<Avatar name={senderLabel} size="sm" decorative />}`.
   - `formatDay = formatDate(at, locale)`; `timeLabel = formatTime`; `dateTimeLabel = formatDateTime`.
   - The old `useEffect` auto-scroll and its `listRef` are removed; `MessageThread` owns scrolling.
   - Messages: `tickets.detail.chatHeading` → "Conversation" / "المحادثة", plus `detail.chatNewMessages` ("New messages" / "رسائل جديدة").
5. **Playwright.** `conversation(page)` becomes `conversation(page, app)`:
   - web: `getByRole("log", { name: "Conversation" })`;
   - portal: unchanged, `getByRole("list", { name: "Live Chat" })`.

   The `li` count and order assertions stay exactly as they are. The reason is recorded in the spec's comment: the web markup is now a labelled log grouped by day.

---

## Context — Read These Files First

1. `apps/web/src/components/tickets/ticket-chat-card.tsx` (+ spec).
2. `apps/e2e/tests/agent-customer-live-chat.spec.ts` (`conversation()` and its callers).
3. `packages/ui/src/components/{avatar,separator}.tsx`, `packages/ui/src/lib/format-date.ts`.
4. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx`: uses of `detail.chatHeading` (keys, unaffected by the copy change).

---

## Tasks

1. **`message-thread.tsx`** and **`message-bubble.tsx`**, plus specs and index exports.
   - **The thread spec:**
     - `role=log` with `aria-live`, named;
     - a day label per local day, and two days produce two labels;
     - the label is not an `<li>` (the `li` count equals the items);
     - auto-scroll at the bottom: `scrollTop` is set to `scrollHeight` on growth;
     - scrolled up: no scroll, the pill shows; clicking the pill scrolls and hides it;
     - the first render scrolls to the end.
   - **The bubble spec:**
     - mine/other alignment and tone;
     - `<time dateTime title>`;
     - the status slot;
     - a decorative avatar;
     - no physical classes.
2. **`ticket-chat-card.tsx`:** adopt both.
3. **Messages:** `chatHeading` and `chatNewMessages`, in en and ar.
4. **`ticket-chat-card.spec.tsx`:**
   - existing cases unchanged where they query by text;
   - add: `role="log"` named `detail.chatHeading`, and a multi-day thread shows two day labels.
5. **The Playwright helper** (above).

---

## Verification Steps

1. ui and web tests, typecheck and lint; prettier only on changed files that were clean at HEAD.
2. Web build; Playwright `agent-customer-live-chat` (both pages) and `agent-resolves-ticket`.
3. Harness, 320/768/1280 × en/ar × light/dark, on a ticket with messages (create one through the existing Playwright flow's ticket, or the seeded thread):
   - the log is present;
   - day labels;
   - bubbles inside the viewport;
   - 0 overflow;
   - RTL mirroring: mine at the inline end.
4. Run `git diff --check`; check the protected checksum; commit path-scoped.

---

## Done Criteria

- [ ] `MessageThread` (log, day groups, reader-respecting scroll and pill) and `MessageBubble` in `@crm/ui`, with specs.
- [ ] The web conversation adopts them, renamed "Conversation"; sender and delivery behaviour unchanged.
- [ ] Playwright helper per app, with counts unchanged; all specs, build and Playwright green; harness 0 overflow.
