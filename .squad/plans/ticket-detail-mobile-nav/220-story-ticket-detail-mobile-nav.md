# Story 220 — Ticket detail: mobile/tablet, skeleton, prev/next

> CRM product redesign roadmap item **PR-3.5** (RD-3.12 + RD-3.14 without shortcuts). Intake: [`../../stories/ticket-detail-mobile-nav/ticket-detail-mobile-nav/intake.md`](../../stories/ticket-detail-mobile-nav/ticket-detail-mobile-nav/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 3.

## Prerequisites

Stories 216 (board URL state), 219 (the v2 ticket page).

## Story Goal

A ticket page that works below lg, loads into its own shape, and supports prev/next in the agent's order.

**Non-goals:** keyboard shortcuts, gestures, list page boundaries.

## Design decisions

1. **Panels** — a `SegmentedControl` (Conversation | Details), sticky, `lg:hidden`; the main column or the inspector gets `max-lg:hidden`. From lg both show (no tab semantics needed, so a radio group fits).
2. **Compact header** — Created/Updated are `hidden lg:flex` in the header and appear in Properties with `lg:hidden` (the customer stays in the header, where specs and agents find it once).
3. **Context** — `ticketHref(locale, id, {from, query})` appends `from=board|list` + the view's filters (`view` dropped); `ticketContextOf` reads it; `ticketsBackHref` rebuilds `/tickets?view=…&filters`. The list's URL parser moves to `parseListFilters` (shared) so both read the same names.
4. **Neighbours** — `TicketNeighbours` renders `BoardNeighbours` (the ticket's current status column under the board filters, at-risk scope applied) or `ListNeighbours` (the list query; position includes the page offset). Prev/next keep the context; at an end the arrow stays, disabled and named. Not in the loaded order → nothing.
5. **Skeleton** — header block (spine edge, id, subject, facts), the switcher below lg, the conversation card and the inspector cards from lg.

## Tasks

1. `ticket-neighbours.tsx`; header `backHref`/`navigation`; detail panels, Properties dates, skeleton; board/list links.
2. Messages en/ar; specs.

## Verification Steps

1. web vitest, typecheck, lint, build; Playwright full suite.
2. Harness: board → ticket → next → back (en/ar); phone 390 panels, composer in viewport, no overflow (en light / ar dark).

## Done Criteria

- [ ] Panels, compact header, skeleton, prev/next and Back; suites green.
