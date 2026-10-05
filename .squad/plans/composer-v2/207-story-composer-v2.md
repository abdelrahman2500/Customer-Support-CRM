# Story 207 — Composer v2: modes and input correctness

> CRM UI/UX redesign roadmap item **RD-3.7**. Intake: [`../../stories/composer-v2/composer-v2/intake.md`](../../stories/composer-v2/composer-v2/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 3 "RD-3.7"; recon TW-04, A11Y-05, A11Y-09.

---

## Prerequisites

- Story 206 (the timeline, with the `noteComposer` slot this Story removes).
- Stories 189 (`Kbd`), 204 (`Combobox` and its option styling), 50/RM-06 (notes and @mention), 78/91/RM-15 (the reply composer, quick replies, "Send by email").
- **Phase 3 constraints:** no API change; reply, email and note payloads identical; `agent-customer-live-chat` passes (selector change recorded).

---

## Story Goal

One ticket composer with **Reply** and **Internal note** modes. It replaces the two stacked composers (TW-04).

It must handle these correctly:
- Enter sends, but never during IME composition;
- the textarea is never disabled, and keeps focus after sending (A11Y-09);
- each mode has an accessible name that isn't its placeholder (A11Y-09);
- @mentions follow the ARIA combobox/listbox pattern and work by keyboard (A11Y-05).

It also gets:
- a visible Kbd hint;
- a draft per ticket and mode, kept for the session;
- a sticky position at the bottom of the conversation card.

**Non-goals:**
- send-and-set-status (§12);
- attachments, KB links and AI insert (RD-3.8);
- the portal composer (RD-5.4);
- any backend change.

---

## Design decisions

1. **`@crm/ui` `Composer`** (`"use client"`). It renders a `<form>` holding:
   - `toolbar?` above the field;
   - the `Textarea`;
   - `suggestions` (a listbox) under the field;
   - a footer row with `footer?` (e.g. the email checkbox), `hint?` and the submit `Button`;
   - `error?`.

   Props:
   - `label` (`aria-label`), `placeholder`, `value`, `onValueChange`;
   - `onSubmit(): void | Promise<unknown>`, `submitLabel`, `canSubmit`, `pending`;
   - `tone?: "default" | "note"`, `rows`;
   - `suggestions?: { label; options: { id; label }[]; onPick(id); onDismiss() }`.

   Behaviour:
   - **Enter submits** when `!shiftKey`, not composing and `canSubmit`. "Composing" means `nativeEvent.isComposing`, or `keyCode === 229`, or a `compositionstart` not yet ended (tracked in a ref). The ref covers Safari's compositionend-before-keydown order.
   - **Submit button:** `type="submit"`, disabled unless `canSubmit`. The form also guards on `canSubmit`.
   - **Never disabled:** the textarea is not disabled while `pending`; the form gets `aria-busy`. After `onSubmit` resolves, focus returns to the textarea (also when sent with the button).
   - **Suggestions** (when given):
     - the textarea is `role="combobox"`, with `aria-autocomplete="list"`, `aria-expanded` (open when there are options), `aria-controls` and `aria-activedescendant`;
     - the list is `role="listbox"`, named by `suggestions.label`, with `role="option"` items in `menuItemClassName` plus `data-[active]:bg-surface-muted`;
     - ArrowDown/ArrowUp move the active option (wrapping); Enter or Tab picks it; Escape calls `onDismiss`;
     - mouse: `onMouseDown` preventDefault, then pick;
     - the active option resets to 0 whenever the options change.
   - **Tone `note`:** the textarea is `border-warning-border bg-warning-subtle`.
2. **Web `TicketComposer`** (in `ticket-chat-card.tsx`; it replaces `ChatComposer`, and `AddNoteForm` leaves the view).
   - **Mode tabs:** `Tabs` with `dir={localeDirection(locale)}` and the list named `detail.composerModeLabel`. Triggers: Reply (`detail.composerModeReply`) and Internal note (`detail.internalNoteLabel`, with the lock icon). Each `TabsContent` holds one `Composer`.
   - **Reply:**
     - label `detail.composerReplyLabel`, placeholder `detail.chatPlaceholder`;
     - the quick-reply Select as the `toolbar` (unchanged: insert or append, active replies only);
     - the "Send by email" checkbox as the `footer` (unchanged visibility and endpoint choice);
     - submit `chatSend`/`chatSending`; the same mutations, `{ body: trimmed }`, and the same error mapping (`actionForbidden`/`chatSendFailed`).
   - **Note:**
     - label `detail.composerNoteLabel`, placeholder `detail.notesPlaceholder`, tone `note`;
     - the hint line `detail.composerNoteHint` ("Only agents can see internal notes.");
     - submit `notesSubmit`/`notesSubmitting`; `useCreateTicketNoteMutation`, `{ body: body.trim() }`; errors `actionForbidden`/`notesCreateFailed`;
     - @mention: the RM-06 `mentionQuery`/`mentionMatches` (5 max)/`selectMention` logic moved verbatim, now feeding `suggestions` (label `detail.mentionSuggestions`); Escape sets `suggestionsDismissed`, as before.
   - **State:**
     - the reply and note bodies and errors are kept per mode in the parent, so switching modes keeps both drafts;
     - each body is mirrored to `sessionStorage` under `crm.ticketDraft.<ticketId>.<reply|note>`: restored in an effect after mount (SSR-safe), written on change, removed on a successful send, with every access in try/catch.
   - **Hint:** `<Kbd>Enter</Kbd> {composerHintSend} · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> {composerHintNewline}`, hidden below `sm`.
   - **Sticky:** the composer region is `sticky bottom-0 z-10 bg-surface border-t border-rule-subtle pt-stack` inside the conversation card, so it stays in view while the agent reads a long timeline.
3. **`TicketChatCard`** drops the `noteComposer` prop and the Story 206 caption (the mode tab replaces it). The view drops `AddNoteForm`, `useCreateTicketNoteMutation` and their imports.
4. **Messages** (`tickets.detail`, en/ar):
   - `composerModeLabel` "Message type" / "نوع الرسالة";
   - `composerModeReply` "Reply" / "رد";
   - `composerReplyLabel` "Reply to the customer" / "الرد على العميل";
   - `composerNoteLabel` "Internal note for agents" / "ملاحظة داخلية للوكلاء";
   - `composerNoteHint` "Only agents can see internal notes." / "لا يرى الملاحظات الداخلية إلا الوكلاء.";
   - `composerHintSend` "to send" / "للإرسال";
   - `composerHintNewline` "for a new line" / "لسطر جديد";
   - `mentionSuggestions` "Agents to mention" / "وكلاء للإشارة إليهم".
5. **Playwright:** `sendChatMessage` finds the composer with `getByPlaceholder("Type a message...")`, which is the same field in both apps. The web field's accessible name is no longer its placeholder (A11Y-09); the reason is recorded.

---

## Context — Read These Files First

1. `apps/web/src/components/tickets/ticket-chat-card.tsx` (+ spec).
2. `apps/web/src/components/tickets/ticket-detail-view.tsx`: `AddNoteForm`; its spec's Story 50, RM-06, Story 164 and guard cases.
3. `packages/ui/src/components/{textarea,kbd,tabs,combobox}.tsx`, `packages/ui/src/lib/menu.ts`.
4. `apps/e2e/tests/agent-customer-live-chat.spec.ts` (`sendChatMessage`).

---

## Tasks

1. **`composer.tsx`, spec and index export.** The spec covers:
   - Enter submits; Shift+Enter does not;
   - no submit while composing (`compositionStart`, Enter with `isComposing`, keyCode 229), then submit after `compositionEnd`;
   - the textarea is enabled while pending and focused after submit;
   - suggestions: the combobox ARIA, arrows with wrap, Enter/Tab pick, Escape dismiss, mouse pick;
   - the note tone.
2. **`TicketComposer`** in the chat card: drafts, tabs, hint and sticky region.
3. **View:** remove `AddNoteForm` and the slot use.
4. **Messages** in en and ar.
5. **Specs.**
   - **Chat card:**
     - a `replyBox()` helper (`textbox` named `detail.composerReplyLabel`) replaces `getByLabelText("detail.chatPlaceholder")`;
     - "disables the composer while sending" becomes "keeps the field enabled while sending; Send is disabled and reads Sending" (A11Y-09 is the reason);
     - `sessionStorage.clear()` in `beforeEach`;
     - new cases: modes and names, IME guard through the card, focus after send, drafts per mode (restore after remount, clear on send), note send payload and errors, hint;
     - the Story 206 composer-caption case is replaced by the mode case.
   - **Detail view:** note cases switch to the Internal note tab first (a `noteMode()` helper); Story 164 and the guard name the field by `detail.composerNoteLabel` (`combobox` role, A11Y-05/09); mention cases are unchanged apart from that; `sessionStorage.clear()` in `beforeEach`.
6. **Playwright** helper selector.

---

## Verification Steps

1. ui and web tests, typecheck and lint; prettier only on files clean at HEAD.
2. Web build; Playwright `agent-customer-live-chat` and `agent-resolves-ticket`.
3. Harness, 320/768/1280 × en/ar × light/dark:
   - the mode tabs (arrows follow the direction) and the note tint;
   - a typed mention opens a listbox, ArrowDown moves `aria-activedescendant`, and Escape closes it;
   - the composer is sticky (visible at the viewport bottom while the card is scrolled);
   - 0 overflow;
   - nothing is sent live, apart from the Playwright spec.
4. Run `git diff --check`; check the protected checksum; commit path-scoped.

---

## Done Criteria

- [ ] One composer with Reply/Internal note modes; the second composer is gone; payloads are unchanged.
- [ ] IME-safe Enter, an always-enabled field, focus kept, and per-mode accessible names.
- [ ] Keyboard @mention with listbox semantics; RM-06 rules unchanged.
- [ ] Kbd hint, session drafts per ticket and mode, sticky placement.
- [ ] Specs, build, Playwright and harness green.
