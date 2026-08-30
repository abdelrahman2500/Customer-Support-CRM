# Story 60 — Reporting & Analytics — Ticket Aging

## Prerequisites

- `reporting-analytics-foundation` Story 56 / `reporting-agent-performance` Story 59: `ReportingModule`/`ReportingService`/`ReportingController`, `report:read` permission, `ReportsView`'s card shell.

---

## Story Goal

Add a fifth Reports card: how long currently-open tickets (`OPEN`+`IN_PROGRESS`) have been open, bucketed into age ranges. Closes the last of the four Reporting dimensions `docs/architecture/08-supporting-domains.md` names ("ticket volume/aging, SLA, agent performance, and CSAT") — the other three shipped in Stories 56/59 — completing this domain's entire documented v1 scope.

**Not in scope**: resolved-ticket time-to-resolution (no `Ticket.resolvedAt` column — same documented gap every other Reporting story has carried forward); configurable/custom bucket boundaries (fixed buckets only); a new permission (reuses `report:read`); charts/histograms (still no charting library).

---

## Context — Read These Files First

1. `apps/api/src/modules/reporting/reporting.service.ts` — the exact branch-scoped, direct-query pattern (`getTicketVolumeByStatus`/`getAgentPerformance`) this story's `getTicketAging` mirrors; application-code bucketing (not raw SQL), same as `getAgentPerformance`'s status bucketing.
2. `apps/web/src/components/reporting/reports-view.tsx` — the exact `ReportCard` shell this story's fifth card reuses verbatim.

---

## Design decisions

1. **Fixed age buckets, computed in application code**: `0-1d` (age < 1 day), `1-3d` (1 ≤ age < 3), `3-7d` (3 ≤ age < 7), `7d+` (age ≥ 7) — mirrors `getAgentPerformance`'s own "bucket in TypeScript, not a raw SQL `CASE`" precedent. Every bucket always appears in the response, even at `0` — unlike `TicketVolumeByStatus`'s "only what exists" convention, a fixed, small, always-complete bucket set reads more naturally as a distribution than a sparse list would.
2. **Scoped to currently-open tickets only** (`OPEN`+`IN_PROGRESS`) — a resolved/closed ticket's age is no longer operationally meaningful the way an open ticket's is; this mirrors `SlaComplianceSummary`'s own "measure what's actionable" framing.
3. **Age computed from `createdAt` to "now" at request time** — a plain wall-clock difference (no business-hours awareness, unlike SLA target computation) — simplest correct measure for a dashboard card, not a legal/contractual SLA figure.
4. **Reuses `report:read`, no new permission.**
5. **Reuses `ReportCard`'s existing shell verbatim** — grid widens to accommodate a fifth card (`sm:grid-cols-2 lg:grid-cols-5` on large screens, wrapping normally at smaller sizes).

---

## Implementation Tasks

1. **`apps/api/src/modules/reporting/reporting.service.ts`** — add `TicketAgingBucket`/`AGE_BUCKET_LABELS` and `getTicketAging()`: fetch `createdAt` for every `OPEN`/`IN_PROGRESS` ticket in the branch, bucket by age, return all four buckets always (zero-filled).
2. **`apps/api/src/modules/reporting/reporting.controller.ts`** — add `GET /reports/ticket-aging` (`report:read`).
3. **`apps/api/src/modules/reporting/reporting.service.spec.ts`** — extend with `getTicketAging` unit tests.
4. **`apps/api/test/reporting.e2e-spec.ts`** — extend: 401/403 on the new route; a real, newly-created open ticket reflected in the `0-1d` bucket delta; a resolved ticket never counted.
5. **`apps/web/src/lib/reporting-api.ts`** — add `TicketAgingBucket` + `getTicketAging`.
6. **`apps/web/src/hooks/use-reporting.ts`** — add `useTicketAgingQuery`.
7. **`apps/web/src/components/reporting/reports-view.tsx`** — add the fifth `ReportCard`, widen the grid.
8. **`apps/web/src/components/reporting/reports-view.spec.tsx`** — extend with the new card's states.
9. **i18n** — `apps/web/messages/{en,ar}.json`: `reporting.ticketAging.*`.

---

## API contract

- `GET /reports/ticket-aging` — `report:read` — `[{ bucket, count }]`, always all four buckets (`"0-1d"`, `"1-3d"`, `"3-7d"`, `"7d+"`), branch-scoped, `OPEN`+`IN_PROGRESS` tickets only.

## Tests

**Backend unit**: branch/status scoping, correct bucket boundaries (including edge values right at a boundary), all-four-buckets-always-present even when some are zero.

**Backend e2e**: 401/403; a real, freshly-created ticket reflected in the `0-1d` bucket's delta; a resolved ticket excluded.

**Frontend component**: populated buckets, zero-count buckets still rendered, independent-of-other-cards forbidden/error state.

## Regression requirements

Every existing test suite remains green, unweakened.

## Migration requirements

None — no schema change.

## Security risks/mitigations

- **Branch isolation**: identical `TenantContext.requireBranchScope()` mechanism as every other report endpoint.
- **No new permission surface**: reuses `report:read`.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `GET /reports/ticket-aging` exists, permission-correct, branch-scoped, `OPEN`/`IN_PROGRESS` only.
- [ ] Reports screen shows the fifth card, independent of the other four's state.
- [ ] Both locales translated.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Time-to-resolution metrics, configurable bucket boundaries, a new permission, charts/histograms.
- Any README change.
