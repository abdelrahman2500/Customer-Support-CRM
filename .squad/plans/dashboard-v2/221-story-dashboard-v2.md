# Story 221 — Dashboard v2

> CRM product redesign roadmap item **PR-3.6**. Intake: [`../../stories/dashboard-v2/dashboard-v2/intake.md`](../../stories/dashboard-v2/dashboard-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 3; `visual-direction.md` "Dashboard".

## Prerequisites

Stories 211 (StatCard, DistributionBar, charts), 216 (board URL filters).

## Story Goal

A dashboard that shows the agent's shift at a glance and leads into the board.

**Non-goals:** new report endpoints; a UI permission model.

## Design decisions

1. **Figures** — `ShiftStat` wraps the shared `StatCard` as a link. Mine/unclaimed are the list totals (same two queries, unchanged arguments). At risk/breached are counted on the SLA-urgency-ranked page: breached tickets are a prefix, so a count is exact unless the last loaded ticket is still in that state and more pages exist → "N+" (keeps Story 144's no-under-reporting rule). Warning/danger edges when non-zero. Links: `/tickets?view=board&assignedToUserId=me` (+`&risk=1`), `unassigned=true`.
2. **Distribution** — `useTicketStatusCounts` (four `pageSize: 1` list requests under `["tickets"]`); `DistributionBar` in status-spine colours, named by its counts; legend links to `/tickets?view=list&status=X` (the list is the view that filters by status).
3. **Needs you now** — the existing rows as mini cards (`recipes.card` + `liftable`), first 6, same links/badges/SLA; "View all N on the board" beyond that. Heading copy unchanged.
4. **Unclaimed** — `min-w-0 flex-1` on the text, `shrink-0` on badges + Claim, subject `break-words`.
5. **Branch panel** — `useSlaComplianceQuery` / `useTicketVolumeByCategoryQuery` for the last 30 days; rendered only when one succeeds (an agent's 403 leaves it out). DonutGauge (the gauge carries the rate) + "{met} met · {breached} breached"; top-5 categories as a BarChart.

## Tasks

1. Status-count hook; dashboard view; messages en/ar.
2. Specs: figures and links, "N+", distribution, six-card limit, branch panel (403 hidden / shown).

## Verification Steps

1. web vitest, typecheck, lint, build; Playwright full suite.
2. Dashboard harness 390–1440 × en/ar × light/dark as an agent (no branch panel) and as the demo admin (branch panel).

## Done Criteria

- [ ] Figures, distribution, Needs you now, Unclaimed wrap, branch panel; suites green.
