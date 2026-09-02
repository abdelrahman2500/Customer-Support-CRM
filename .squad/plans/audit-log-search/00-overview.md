# audit-log-search — plan overview

Entry point for the **audit-log-search** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 104 | [104-story-audit-log-search.md](./104-story-audit-log-search.md) | Administration — Audit Log Search, Filtering & a Bounded Result Cap | — | `audit-log-write-path` Story 84, `audit-log-viewer` Story 37/40, `reporting date-range filtering` Story 93 |

## Dependency notes

- Selected via a fresh, whole-repository Recon performed after Stories
  99-103 closed (CLAUDE.md §8), dispatched as a read-only Explore pass
  covering every domain in `docs/architecture/03-domain-boundaries.md`.
- **The gap**: `AuditLogsController`'s own doc comment states it verbatim
  — *"Story 37 — read-only. No pagination/filtering, matching every other
  list endpoint in this codebase."* That parity claim no longer holds:
  `GET /customers` (Story 101) and every `GET /reports/*` route (Story 93)
  have both since gained filtering, while `GET /audit-logs` is unchanged
  from its original, admittedly-provisional Story 37 shape — a completely
  flat, unbounded `findMany` with zero query parameters. `AuditInterceptor`
  (`docs/architecture/05-auth-and-security.md`) writes a row for every
  mutating request across the *entire application*, so this table has no
  natural upper bound and keeps growing forever — an unfiltered,
  unbounded read of it is both a usability gap (an admin investigating an
  incident has no way to narrow the flat dump by actor/action/entity
  type/date) and a latent query-cost risk that only gets worse the longer
  this system runs.
- **Why not externally blocked**: purely internal Postgres query/index
  work — no provider decision of any kind is involved.
- **Dependency correctness**: builds only on infrastructure already fully
  in place — `AuditLog` (Story 84), `AuditLogsService.listAuditLogs`
  (Story 37, Story 84's own null-branch widening), and
  `resolveReportDateRange`/`ReportDateRangeQueryDto`
  (`apps/api/src/modules/reporting/report-date-range.util.ts`, Story 93)
  — reused verbatim for the new date-range filter rather than
  reimplementing calendar-date parsing a second time.
- **Architectural coherence**: mirrors `ListCustomersQueryDto`
  (Story 101) and `ReportDateRangeQueryDto` (Story 93)'s exact DTO/
  validation style — `ListAuditLogsQueryDto extends ReportDateRangeQueryDto`
  (a plain TS import of a DTO class between two modules, not a Nest
  module/DI dependency — no circularity). One new composite index on the
  existing `AuditLog` table, no new model.
- **Product value**: an audit trail an admin cannot search or narrow by
  actor/action/entity type/date is not usable for real incident
  investigation or compliance review — the exact purpose
  `05-auth-and-security.md` assigns to it ("records actor... action,
  entity type/id, before/after JSON diff... for retry and inspection").
- **Risk reduction**: a fixed, documented result cap (`take: 200`) on an
  otherwise-unbounded, ever-growing table directly addresses the latent
  query-cost risk this story's own selection is evidenced by.
- **Smallness**: bounded to one new DTO (reusing an existing one via
  inheritance), filtering/cap logic inside one existing service method,
  one new composite index, and a filter bar in one existing frontend view
  — no new model, no new permission, no pagination UI (see Non-Goals).
