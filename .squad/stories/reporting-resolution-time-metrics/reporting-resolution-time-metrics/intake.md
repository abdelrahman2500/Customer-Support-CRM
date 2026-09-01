> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/reporting-resolution-time-metrics/reporting-resolution-time-metrics/intake.md`

---

## Feature

- **Feature name (display):** Reporting & Analytics — Ticket Resolution-Time Metrics
- **Feature slug (folder under `plans/`):** `reporting-resolution-time-metrics`

## Title

```text
Story 99 — Reporting & Analytics: Ticket Resolution-Time Metrics
```

## Description

```text
reporting.service.ts documents, in four separate doc comments, that
"there is no Ticket.resolvedAt column, so a real time-to-resolution
measure is not yet possible." This story adds that column, populates/
clears it as a direct consequence of the existing PATCH /tickets/:id
status-transition logic (treating RESOLVED/CLOSED as one "resolved" tier,
mirroring TicketsService.submitCsat's own existing eligibility check),
and exposes a sixth Reporting metric (average resolution time) through
the existing ReportingService/ReportingController/ReportsView pattern.
```

## Acceptance criteria

```text
- [ ] New nullable Ticket.resolvedAt column (ticketing schema), migration
      applied; no backfill of historical tickets.
- [ ] TicketsService.updateTicket sets resolvedAt on a genuine
      not-resolved -> resolved transition, clears it on resolved ->
      not-resolved (reopen), and leaves it unchanged for a
      RESOLVED<->CLOSED shuffle or any transition that doesn't cross the
      resolved boundary.
- [ ] A ticket resolved, reopened, then resolved again gets a fresh
      resolvedAt, not the original one.
- [ ] Existing "only includes fields present in the DTO" unit test is
      unaffected (no resolvedAt key added when the transition doesn't
      cross the resolved boundary).
- [ ] New ReportingService.getResolutionTime(from?, to?), filtering the
      cohort by Ticket.resolvedAt (not createdAt), returning
      { resolvedCount, averageResolutionMs } with averageResolutionMs
      null when resolvedCount is 0.
- [ ] New GET /reports/resolution-time route, report:read permission
      (no new permission), ReportDateRangeQueryDto reused as-is.
- [ ] apps/web: new reporting-api.ts function, use-reporting.ts hook, and
      a sixth ReportCard (skeleton="stat") in ReportsView, reusing
      apps/web/src/lib/sla.ts's existing formatRemaining(ms) rather than
      a new formatter.
- [ ] apps/web/messages/en.json and ar.json both gain a
      reporting.resolutionTime namespace, no existing key modified.
- [ ] New/updated tests: tickets.service.spec.ts, reporting.service.spec.ts,
      reporting.e2e-spec.ts, reports-view.spec.tsx.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or its
      documented isolated-file fallback), pnpm --filter @crm/web test,
      pnpm typecheck, pnpm lint, and pnpm build all pass.
```

## Dependencies

- Story 56 — `reporting-analytics-foundation` (`ReportingModule`/
  `ReportingService`/`ReportingController` — the exact pattern this
  story's sixth report follows).
- Story 93 — reporting date-range filtering (`ReportDateRangeQueryDto`,
  `resolveReportDateRange`/`hasDateRange` — reused verbatim).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Materialized views / a reporting schema.
- Any Customer Portal (`apps/portal`) reporting surface.
- A charting library.
- Backfilling `resolvedAt` for tickets already resolved before this
  migration.
- Exposing `resolvedAt` on `TicketSummary`, the ticket detail view, or
  the ticket list.
- A new permission — reuses `report:read`.
- Business-hours-aware duration (plain wall-clock, mirroring
  `getTicketAging`'s own precedent).
