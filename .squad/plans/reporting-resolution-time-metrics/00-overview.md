# reporting-resolution-time-metrics — plan overview

Entry point for the **reporting-resolution-time-metrics** feature. Stories
execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 99  | [99-story-reporting-resolution-time-metrics.md](./99-story-reporting-resolution-time-metrics.md) | Reporting & Analytics — Ticket Resolution-Time Metrics | — | `reporting-analytics-foundation` Story 56, `reporting-agent-performance` Story 59, `reporting-ticket-aging` Story 60, `reporting date-range filtering` Story 93 (unindexed, `56ea226`) — the exact `ReportingService`/`ReportingController`/`ReportsView` pattern this story extends |

## Dependency notes

- Selected via a fresh, whole-repository Recon performed immediately after
  Story 98 (`CLAUDE.md` §2/§8), dispatched as five parallel read-only
  audits (roadmap/architecture, backend API, worker/async, frontend
  surfaced-vs-backend gap, security/testing) covering the entire
  repository, not just the frontend-quality thread Stories 94-98 had been
  working through.
- **Why this, over other candidates surfaced during Recon:** the Recon's
  own ranked candidate list put four items forward — this one (Reporting),
  Identity & Access security hardening (default `Agent` permissions, login
  throttling, portal-contact revocation), Customer Management list
  search/filter, and Knowledge Base full-text search. Applying the
  explicit 8-point ranking given for this decision (dependency value >
  user-facing value > domain completeness > unblocking > security >
  testability > no external dependency > bounded size), this story scored
  highest on the top three criteria: it closes a concrete, explicitly
  self-documented gap in an "implemented (foundation-depth)" domain with a
  standard, high-value support metric (time-to-resolution), it has zero
  external-provider dependency, and it is the smallest fully-bounded
  candidate of the four. The other three candidates are queued next
  (Stories 100-102) per the same Recon's sequencing.
- **The gap is not inferred — it is already written into this
  repository's own code comments in four separate places**, each stating
  it as a currently-blocking limitation, not a future aspiration:
  - `apps/api/src/modules/reporting/reporting.service.ts:37-40`
    (`AgentPerformanceSummary` doc comment): *"there is no
    `Ticket.resolvedAt` column, so a real time-to-resolution measure is
    still not possible ... and this is a count, not a duration."*
  - `apps/api/src/modules/reporting/reporting.service.ts:108-112`
    (`getSlaCompliance` doc comment): *"there is no `Ticket.resolvedAt`
    column in this schema (confirmed during Recon), so a real
    time-to-resolution measure is not yet possible and is explicitly
    deferred, not approximated here."*
  - `apps/api/src/modules/reporting/reporting.service.ts:196-197`
    (`getAgentPerformance` Story-93 doc comment): *"no `Ticket.resolvedAt`
    column exists, so this is age-since-creation, never a
    resolution-duration measure."*
  - `apps/api/src/modules/reporting/reporting.service.ts:248-250`
    (`getTicketAging` doc comment): *"no `Ticket.resolvedAt` column
    exists, so this is age-since-creation, never a resolution-duration
    measure."*
  - `README.md` (per this session's Recon): *"ticket resolution-time
    metrics aren't possible yet because `Ticket` has no `resolvedAt`
    column."*
- **Dependency correctness**: builds only on infrastructure already fully
  in place — the `ReportingModule`/`ReportingService`/`ReportingController`/
  `ReportDateRangeQueryDto`/`resolveReportDateRange` (Stories 56/59/60/93)
  and `apps/web`'s `ReportsView`/`ReportCard`/`reporting-api.ts`/
  `use-reporting.ts` (same stories) — no existing route, table, or
  component behavior changes for a caller who never touches the new field
  or endpoint.
- **Architectural coherence**: `resolvedAt` is a new nullable column on the
  existing `Ticket` model (`ticketing` schema) — no new model, no new
  schema, no materialized view (`docs/architecture/08-supporting-domains.md`:
  "starts with direct queries ... materialized views ... deferred until
  query load ... outgrow Postgres" — still true, unchanged by this story).
  The new report is a sixth `ReportingService` method / sixth
  `GET /reports/*` route, mirroring the other five's exact
  branch-scoped + date-range-filtered shape.
- **Product value**: time-to-resolution is one of the most standard
  support-desk metrics; today it is provably impossible to compute (see
  the four doc comments above) despite the domain being otherwise
  "implemented."
- **Risk reduction**: none specific; purely additive (one new nullable
  column, one new report, one new UI card).
- **Smallness**: bounded to one column, one transition rule inside an
  existing method, one new report method/route, one new UI card — no new
  model, no new permission (reuses `report:read`), no portal changes.
