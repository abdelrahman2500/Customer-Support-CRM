# Story 219 — Ticket detail v2: inspector completion and polish

> CRM product redesign roadmap item **PR-3.4** (merges RD-3.10, RD-3.11 and the header half of RD-3.13). Intake: [`../../stories/ticket-detail-v2/ticket-detail-v2/intake.md`](../../stories/ticket-detail-v2/ticket-detail-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 3; `visual-direction.md` §3 (status spine), "Ticket detail".

## Prerequisites

Stories 201–209 (the workspace), 218 (the change-cue keyframe).

## Story Goal

Finish the ticket inspector and bring the page into the v2 language.

**Non-goals:** mobile layout and prev/next (220), new API data, AI-suggested articles.

## Design decisions

1. **Spine** — `statusSpine()` gains literal `top` classes (`border-t-*-solid`, so Tailwind generates them); the header gets `border-t-[3px]` in that hue.
2. **KB references** — moved into the inspector (collapsible, after Customer context). Titles are links to `/knowledge-base/{articleId}`; buttons keep short visible text with unique `aria-label`s; the search queries a 300ms-debounced term while the "typed something" check reads the live field; pending is per row from each mutation's `variables`.
3. **Customer context** — identity block (Avatar, name link, Active/Inactive/Anonymized badge) from the customer query; "Raised by" (name, mailto, phone) when `ticket.contactId` is one of its contacts; other open tickets with badges; primary contacts as a `DescriptionList`; "View {customer}"; sentence-case subheadings. One skeleton per query, as before.
4. **Header cues** — the header keeps the last seen status/priority/assignee; a change not reported by `isOwnChange(field)` (the page's update mutation sent that field within 15s) gets the `animate-change-cue` ring for 2.4s (static ring with reduced motion) and a polite announcement ("Status changed to Resolved."). `data-changed` marks it for tests.
5. **Found while verifying** — (a) CSAT: the API's `204` became `undefined`, which TanStack Query v5 rejects, so every ticket without feedback showed the section's load error; the hook now returns `null` (empty state). (b) Board keyboard drag (Story 217) could miss the first arrow pressed in the same frame as the pick-up: columns are now measured up front (`MeasuringStrategy.Always`), the getter ignores keys until the card is measured, and "Picked up…" is announced once the drag is measured.

## Tasks

1. Header spine + cues; detail view wiring (`isOwnChange`, inspector order, `contactId`).
2. KB references and customer context rewrites; messages en/ar.
3. Specs: header (spine, cues, own change), KB (links, names, per-row pending, debounce), context (identity, statuses, raised by, contacts, no uppercase), inspector order, CSAT hook, move getter.

## Verification Steps

1. web vitest, typecheck, lint, build; Playwright full suite.
2. Harness: ticket page 390–1440 × en/ar × light/dark; inspector sections; header cue through real realtime.

## Done Criteria

- [ ] Inspector sections per RD-3.10/3.11; header spine and cues; suites green.
