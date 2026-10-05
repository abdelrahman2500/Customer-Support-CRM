> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/message-thread-v2/message-thread-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** MessageThread v2
- **Feature slug (folder under `plans/`):** `message-thread-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-3.5**, global Story **205**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-3-ticket-workspace`, `packages/ui`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
MessageThread v2
```

---

## Description

```
Story 205 — RD-3.5 "MessageThread v2 (web conversation)" of the CRM UI/UX
redesign track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md
Phase 3 "RD-3.5"; recon TW-03).

GOAL
The agent's conversation reads like one: announced to screen readers,
grouped by day with dates, each message with its sender, avatar, time and
delivery state — and it never yanks an agent who is reading history back to
the bottom.

CONTEXT (verified at HEAD 63663fe)
- apps/web/src/components/tickets/ticket-chat-card.tsx: SectionCard
  "detail.chatHeading" ("Live Chat" / "الدردشة المباشرة"); an
  <ol aria-label="Live Chat"> of <li> bubbles (mine: end + accent; others:
  start + surface-muted), "sender · time" (formatTime only — no dates, TW-03),
  delivery status for OUTBOUND not DELIVERED; a useEffect scrolls to the
  bottom on EVERY data change (TW-03). Composer below (unchanged here).
- Playwright agent-customer-live-chat: conversation(page) =
  getByRole("list", { name: "Live Chat" }) for BOTH the web agent page and
  the portal customer page, then counts/locates "li" (expects exactly 2).
- Portal has its own chat card (out of scope; keeps "Live Chat").
- formatDate/formatTime/formatDateTime (Story 194), Avatar (189).

REQUIRED OUTCOME
1. packages/ui MessageThread: role="log" (aria-live polite, labelled),
   messages grouped by local day with a date label per day (plain text, not
   an <li>), each day an <ol> of items; auto-scroll to the end only when the
   reader is already at the bottom (or on first render), otherwise a
   "New messages" pill that scrolls down.
2. packages/ui MessageBubble: align start/end, tone mine/other, sender,
   decorative avatar, <time> with full date-time title, delivery-state slot.
3. Web TicketChatCard adopts both; heading renamed to "Conversation" /
   "المحادثة" (web only).
4. Playwright helper made per-app (web: log "Conversation"; portal: list
   "Live Chat"); li counts unchanged; reason recorded.
```

---

## Acceptance criteria

```
- [ ] New realtime messages are announced (role=log, spec).
- [ ] Multi-day threads show a date per day (spec).
- [ ] An agent scrolled up keeps their position; a pill appears and scrolls
      to the newest on click (spec); at the bottom it follows new messages.
- [ ] Sender labels, delivery states, composer and email/quick-reply flows
      unchanged (existing chat specs green, selectors updated only for the
      rename/structure with reasons).
- [ ] Playwright agent-customer-live-chat green; web/ui tests, typecheck,
      lint, build; 320/768/1280 × en/ar × light/dark harness.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-3.5 depends on RD-1.12, RD-1.17.
- **Depends on code areas or other stories:** Stories 189, 194.

## Extra notes (optional)

- Attachments in messages and pagination are out of scope (roadmap NG). Timeline interleaving is RD-3.6.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/{message-thread,message-bubble}.tsx` (+specs, index), `ticket-chat-card.tsx` (+spec), `apps/web/messages/{en,ar}.json`, `apps/e2e/tests/agent-customer-live-chat.spec.ts` (helper only).

## Out of scope

- Portal chat card, message attachments, pagination, composer changes (RD-3.7), any backend change.
