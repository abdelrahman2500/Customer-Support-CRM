# Story 59 — Reporting & Analytics — Agent Performance

## Prerequisites

- `reporting-analytics-foundation` Story 56: `ReportingModule`/`ReportingService`/`ReportingController`, `report:read` permission, `ReportsView`'s card shell — all extended, none modified in a breaking way.
- `ticketing`: `Ticket.assignedToUserId` (already populated by ticket creation/update, Story 43).

---

## Story Goal

Add a fourth Reports card: for each agent with at least one ticket currently assigned to them in the caller's branch, how many of those tickets are open (`OPEN`+`IN_PROGRESS`) vs. resolved (`RESOLVED`+`CLOSED`). Closes the "agent performance" dimension `docs/architecture/08-supporting-domains.md` names alongside "ticket volume/aging... SLA... and CSAT" — the last of which Story 56 already shipped three of.

**Not in scope**: time-to-resolution/duration metrics (no `Ticket.resolvedAt` column exists — same documented gap `SlaComplianceSummary` already carries); ticket-aging (a separate, still-unaddressed dimension, left for a future story); a new permission (reuses `report:read`); charts (still no charting library in this codebase); per-agent drill-down page.

---

## Context — Read These Files First

1. `apps/api/src/modules/reporting/reporting.service.ts` — the exact `groupBy`/branch-scoping pattern (`getTicketVolumeByStatus`) this story's `getAgentPerformance` mirrors.
2. `apps/api/src/modules/reporting/reporting.controller.ts` — the exact one-route-per-concern, `report:read`-gated shape.
3. `apps/web/src/components/reporting/reports-view.tsx` — the exact `ReportCard` shell (loading/forbidden/generic-error/populated) this story's fourth card reuses verbatim.

---

## Design decisions

1. **`groupBy(["assignedToUserId", "status"])`, bucketed in application code** — mirrors `getTicketVolumeByStatus`'s single-dimension `groupBy`, extended to two dimensions; bucketing into `openCount`/`resolvedCount` happens in TypeScript, not a raw SQL `CASE`, keeping the query itself trivial.
2. **Unassigned tickets excluded entirely** (`assignedToUserId: { not: null }`) — there is no agent to attribute them to; they already appear in the ticket-volume card.
3. **A second `user.findMany` lookup for `fullName`**, keyed by the distinct assigned user ids from the grouped result — mirrors `AuditLogView`'s/`AutomationRulesView`'s existing client-side name-resolution convention, done here server-side instead so the response is immediately useful without a second frontend round-trip.
4. **Sorted by `fullName` ascending** — simple, deterministic; no workload-ranking judgment baked into the API itself.
5. **Reuses `report:read`, no new permission** — this is one more read over the same kind of data the other three cards already expose under that permission.
6. **Reuses `ReportCard`'s existing shell verbatim** — only the grid widens from 3 to 4 columns (`sm:grid-cols-2 lg:grid-cols-4`); no new loading/error convention introduced.

---

## Implementation Tasks

1. **`apps/api/src/modules/reporting/reporting.service.ts`** — add `AgentPerformanceSummary` interface and `getAgentPerformance()`.
2. **`apps/api/src/modules/reporting/reporting.controller.ts`** — add `GET /reports/agent-performance` (`report:read`).
3. **`apps/api/src/modules/reporting/reporting.service.spec.ts`** — extend with `getAgentPerformance` unit tests.
4. **`apps/api/test/reporting.e2e-spec.ts`** — extend: 401/403 on the new route, a real assignment reflected in `openCount`, a real resolution reflected in `resolvedCount`, unassigned tickets never counted.
5. **`apps/web/src/lib/reporting-api.ts`** — add `AgentPerformanceSummary` + `getAgentPerformance`.
6. **`apps/web/src/hooks/use-reporting.ts`** — add `useAgentPerformanceQuery`.
7. **`apps/web/src/components/reporting/reports-view.tsx`** — add the fourth `ReportCard`, widen the grid.
8. **`apps/web/src/components/reporting/reports-view.spec.tsx`** — extend with the new card's states.
9. **i18n** — `apps/web/messages/{en,ar}.json`: `reporting.agentPerformance.*`.

---

## API contract

- `GET /reports/agent-performance` — `report:read` — `[{ userId, fullName, openCount, resolvedCount }]`, branch-scoped, one row per agent with ≥1 assigned ticket, sorted by `fullName`.

## Tests

**Backend unit**: branch/exclusion scoping, status bucketing across multiple agents, empty-result short-circuit (no user lookup when nothing is assigned), distinct-id lookup, unresolved-user fallback to raw id.

**Backend e2e**: 401/403; a real ticket assignment reflected in `openCount`; a real status transition to `RESOLVED` reflected in `resolvedCount`; an unassigned ticket never changes the total across all rows.

**Frontend component**: populated rows, empty state, independent-of-other-cards forbidden/error state.

## Regression requirements

Every existing test suite remains green, unweakened.

## Migration requirements

None — no schema change.

## Security risks/mitigations

- **Branch isolation**: identical `TenantContext.requireBranchScope()` mechanism as the other three report endpoints.
- **No new permission surface**: reuses `report:read` — no existing permission's meaning changes.

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

- [ ] `GET /reports/agent-performance` exists, permission-correct, branch-scoped, excludes unassigned tickets.
- [ ] Reports screen shows the fourth card, independent of the other three's state.
- [ ] Both locales translated.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Time-to-resolution/duration metrics; ticket-aging; a new permission; charts; per-agent drill-down.
- Any README change.
