> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/audit-log-search/audit-log-search/intake.md`

---

## Feature

- **Feature name (display):** Administration — Audit Log Search, Filtering & a Bounded Result Cap
- **Feature slug (folder under `plans/`):** `audit-log-search`

## Title

```text
Story 104 — Administration: Audit Log Search, Filtering & a Bounded Result Cap
```

## Description

```text
AuditLogsController's own doc comment discloses the gap verbatim: "No
pagination/filtering, matching every other list endpoint in this
codebase" - a claim that stopped being true once Stories 93/101 added
filtering elsewhere. AuditInterceptor writes a row for every mutating
request across the whole app, so this table has no natural upper bound;
GET /audit-logs is still a completely flat, unbounded findMany. This
story adds action/entityType/actorId/date-range filters (reusing
ReportDateRangeQueryDto verbatim) and a fixed 200-row cap.
```

## Acceptance criteria

```text
- [ ] New ListAuditLogsQueryDto extends ReportDateRangeQueryDto: action?,
      entityType?, actorId? (UUID), from?/to? inherited.
- [ ] AuditLogsService.listAuditLogs(query) applies action/entityType/
      actorId equality filters and the inherited date-range filter,
      combined with the existing branchId/branchId:null OR-scope via AND;
      take: 200, orderBy createdAt desc, unconditionally applied.
- [ ] New @@index([branchId, createdAt]) on AuditLog.
- [ ] AuditLogsController.list(@Query() query: ListAuditLogsQueryDto) -
      same route, same audit:read permission.
- [ ] apps/web: AuditLogFilters, listAuditLogs(filters),
      useAuditLogsQuery(filters) (optional, additive), a filter bar
      (action/entityType Inputs + from/to date Inputs) in AuditLogView.
- [ ] Omitting every filter reproduces the exact pre-Story-104 query/
      order, now capped at 200 rows.
- [ ] New/updated tests: audit-logs.service.spec.ts,
      audit-logs-read.e2e-spec.ts, audit-log-view.spec.tsx.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or
      its documented isolated-file fallback), pnpm --filter @crm/web
      test, pnpm typecheck, pnpm lint, and pnpm build all pass.
```

## Dependencies

- Story 37/40 — `AuditLogsController`/`AuditLogsService`/`AuditLogView`.
- Story 84 — `AuditLog`'s write path and branch/null-scoping convention.
- Story 93 — `ReportDateRangeQueryDto`/`resolveReportDateRange`.
- Story 101 — `ListCustomersQueryDto`'s DTO/validation style precedent.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Full pagination (page controls, cursor, `hasMore`/`nextCursor`) — this
  codebase's first pagination implementation would be a materially
  larger decision than this story's own scope.
- A new permission — reuses `audit:read`.
- Any change to `AuditInterceptor`/the write path.
- A client-configurable numeric `limit` query param (would be this
  codebase's first `@Type(() => Number)`-coerced query param).
- Branch-timezone-aware date filtering — inherits `resolveReportDateRange`'s
  existing UTC-only limitation, same as every other caller.
