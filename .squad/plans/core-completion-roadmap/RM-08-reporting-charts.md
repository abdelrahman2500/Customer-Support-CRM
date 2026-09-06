# RM-08 — Reporting Charts

**Priority:** P1 · **Complexity:** Medium · **Blocked:** No · **Phase:** 2 (Reporting)

## Goal

Render the highest-value reporting widgets (ticket volume, SLA compliance,
CSAT, agent performance) as real charts, reading the exact same data the
current stat tiles already use.

## Why it exists

**Verified before proposing** (per this task's explicit instruction not to
add a chart library without checking first): `reporting-saved-dashboards`
(Story 110)'s own plan states outright, "this codebase has no charting
library anywhere (confirmed directly in `reports-view.tsx`'s own Story 56
doc comment)... inventing one is out of scope for what closes this gap."
Confirmed still true at current HEAD — every one of the 8 report widgets in
`reports-view.tsx` renders as a plain stat tile or `<ul>` list. No existing
abstraction is being duplicated by adding one now; the prior story simply,
correctly, deferred it.

## Dependencies

Sequenced after `RM-07` so charts render the final filterable data shape,
not a pre-filter shape reworked afterward. Not a hard technical dependency —
this story is buildable standalone if `RM-07` is deprioritized.

## Backend work

None — `ReportingService`'s existing methods already return the data shape
a chart needs (time-series-like groupings for ticket volume, a single rate
for SLA compliance, an average+count for CSAT, per-agent breakdowns for
agent performance).

## Frontend work

- Add one charting dependency, loaded per this repo's actual CSP/CDN
  constraints for any client-rendered chart work (if drawn as inline SVG
  with no external library, no constraint applies at all — evaluate a
  no-dependency inline-SVG approach first, given how bounded these four
  chart shapes are, before reaching for a full charting library; only add
  a real dependency if the inline-SVG approach proves genuinely
  insufficient for the required interactivity).
- Replace `ticket-volume`, `sla-compliance`, `csat`, and `agent-performance`
  widgets in `reports-view.tsx` with real charts (a stacked/line time-series
  for ticket volume, a gauge or single bold rate for SLA compliance, a
  simple bar/rating distribution for CSAT, a per-agent bar chart for agent
  performance); leave the remaining four widgets (`ticket-aging`,
  `resolution-time`, `ai-usage`, `ticket-volume-by-category`) as stat
  tiles/lists for this story, upgradeable later if warranted.
- Both light and dark theme tokens must be respected by every chart
  (per this repo's existing design-token extraction, `ds-1a`/`ds-1b`).

## Worker/realtime work

None.

## Schema/migration work

None.

## Tests

- `reports-view.spec.tsx` — extend to assert each upgraded widget renders
  the correct values from a given `ReportingService` response shape (not
  pixel-testing the chart itself, but asserting the right numbers reach the
  right chart).

## Acceptance criteria

- Ticket volume, SLA compliance, CSAT, and agent performance render as real
  charts reading the same data the existing stat tiles used, correctly in
  both light and dark themes.
- The remaining four widgets are unchanged.
- No new backend endpoint or query was needed to achieve this.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
  pass. (No API changes expected.)
- One dedicated commit, pushed.
