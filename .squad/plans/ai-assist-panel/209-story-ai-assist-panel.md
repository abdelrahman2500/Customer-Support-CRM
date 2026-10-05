# Story 209 — AI assist panel

> CRM UI/UX redesign roadmap item **RD-3.9**. Intake: [`../../stories/ai-assist-panel/ai-assist-panel/intake.md`](../../stories/ai-assist-panel/ai-assist-panel/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 3 "RD-3.9"; recon TW-06.

---

## Prerequisites

- Story 203 (the inspector and collapsible `SectionCard`), Story 206 (the timeline), Story 208 ("Insert into reply").
- **Phase 3 constraints:** no API change; all four AI actions, the per-button loading state, "Use as category", "Insert into reply" and the DISABLED state are unchanged.

---

## Story Goal

AI assist moves into the inspector, next to the conversation, as a tool.

- **Announced:** its state transitions are announced politely (TW-06).
- **Pinned summary:** the latest summary is pinned, collapsible, at the top of the timeline.

**Non-goals:**
- persisting results (the pinned summary is client state; a reload clears it);
- new AI actions;
- any backend change.

---

## Design decisions

1. **Placement.**
   - `<TicketAiCard>` moves from the main column into the inspector, right after Properties, as `SectionCard collapsible` (open by default).
   - The `aiCategoryNoMatch` Alert and its "Create it in Ticket Categories" link move with it, directly below.
   - The handlers are unchanged.
2. **Announcements.** The card renders one `sr-only` `<p role="status" aria-live="polite">`. It exists from mount, so updates are announced. Its text follows the tracked operation:
   - submitted / PENDING: `detail.aiStatusPending` ("{feature}: working on it…");
   - SUCCESS: `detail.aiStatusReady` ("{feature} is ready.");
   - ERROR: `detail.aiStatusFailed` ("{feature} failed.");
   - DISABLED: `detail.aiStatusDisabled` ("AI assist is turned off in this environment." — its own key, so it never duplicates the visible DISABLED Alert);
   - otherwise empty.

   `{feature}` is the action's own label. The visible PENDING text, result, Alerts and buttons are unchanged.
3. **Summary pinning.**
   - `TicketAiCard` gets `onSummary?(summary: { text; at; id })`, called once per result id when a SUMMARIZE result is SUCCESS with text.
   - The view keeps `pinnedSummary` state and passes it to `TicketChatCard`.
   - The card renders a block above the filter tabs: `rounded-inner border border-rule-subtle bg-surface-muted p-3`.
     - A disclosure `<button aria-expanded aria-controls>` holding `AiSummaryIcon` (lucide `Sparkles`, new in the vocabulary), "AI summary" (`detail.aiSummaryPinned`) and a chevron (`-rotate-90 rtl:rotate-90` when closed).
     - The body is `whitespace-pre-wrap text-sm`, followed by `<time dateTime title=formatDateTime>formatTime</time>`.
     - Open by default; a new summary id reopens it.
4. **Messages** (`tickets.detail`, en/ar):
   - `aiStatusPending` "{feature}: working on it…" / "{feature}: جارٍ العمل عليه…";
   - `aiStatusReady` "{feature} is ready." / "{feature} جاهز.";
   - `aiStatusFailed` "{feature} failed." / "تعذّر {feature}.";
   - `aiSummaryPinned` "AI summary" / "ملخص الذكاء الاصطناعي".

---

## Tasks

1. **ui:** `AiSummaryIcon` (+ icons spec).
2. **`ticket-ai-card.tsx`:** collapsible, the live region, `onSummary`. Spec additions: the region exists at mount and is empty; pending → ready / failed / disabled text; `onSummary` is called for SUMMARIZE SUCCESS only, and once per id.
3. **`ticket-chat-card.tsx`:** the pinned summary block. Spec: renders, collapses and expands, and a new id reopens it.
4. **View:** move the AI card and its Alert into the inspector and wire `pinnedSummary`. Spec: the Story 203 inspector list gains `detail.aiHeading` (an extension), and Summarize → pinned summary in the conversation.
5. **Messages** in en and ar.

---

## Verification Steps

1. ui and web tests, typecheck and lint; prettier only on files clean at HEAD.
2. Web build; Playwright `agent-customer-live-chat` and `agent-resolves-ticket`.
3. Harness, 320/768/1280 × en/ar × light/dark:
   - AI assist is in the inspector (after Properties), collapsible, and the live region is present;
   - 0 overflow;
   - no AI request made live (the API may be DISABLED; specs cover the transitions).
4. Run `git diff --check`; check the protected checksum; commit path-scoped.

---

## Done Criteria

- [ ] AI assist is an inspector section; all actions and states are preserved.
- [ ] Transitions announced through a persistent polite region.
- [ ] The latest summary is pinned and collapsible at the top of the timeline.
- [ ] Specs, build, Playwright and harness green.
