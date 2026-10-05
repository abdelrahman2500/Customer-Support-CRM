# Story 222 — Customers v2

> CRM product redesign roadmap item **PR-4.1** (RD-4.4 + RD-4.5). Intake: [`../../stories/customers-v2/customers-v2/intake.md`](../../stories/customers-v2/customers-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 4.

## Prerequisites

Stories 211 (ListToolbar, FilterSelect), 212 (EmptyState), 216 (board URL filters).

## Story Goal

The customer list and detail in the v2 language, with editors in dialogs and the same requests.

**Non-goals:** customer KPIs or columns that need API fields.

## Design decisions

1. **List** — `ListToolbar` replaces the FilterBar: the same `search` (blur/Enter commit, "" removes it) and `isActive` FilterSelect, a polite plural count, clear-all keeping the sort. Name cell: decorative Avatar + the existing link.
2. **Status** — the Select stays (named as before); choosing the other value opens a ConfirmDialog (deactivate / reactivate copy); confirm sends the same `{ isActive }`, cancel sends nothing.
3. **Add contact** — an "Add contact" button opens a Dialog with the same form (labelled fields, primary checkbox); success closes it.
4. **Portal password** — "Set portal password" (named "… for {contact}") per contact opens a Dialog with the labelled field and the destructive submit; the existing ConfirmDialog step sits inside it; success or failure closes both and the row shows the result. Revoke unchanged.
5. **Tickets** — wrapping mini cards (`recipes.card`), the same links and badges; "View these tickets on the board" → `/tickets?view=board&customerId=…`. The board's filters gain `customerId` (URL, query, count) shown as a removable chip named by the customer.
6. **Empty sections** — `EmptyState`. Contact inline fields flex instead of fixed widths.

## Tasks

1. List and detail views; board customer filter + chip; messages en/ar.
2. Specs: 9 existing tests gain the step that opens the dialog / confirms (same payload assertions, reasons recorded); new: cancel sends nothing, board link, empty states, list count + avatar, board-state customer filter.

## Verification Steps

1. web vitest, typecheck, lint, build; Playwright full suite.
2. Harness: list + detail + both dialogs at 390/1280 × en light / ar dark; the board filtered by the customer.

## Done Criteria

- [ ] RD-4.4/4.5 scope with unchanged payloads; suites green.
