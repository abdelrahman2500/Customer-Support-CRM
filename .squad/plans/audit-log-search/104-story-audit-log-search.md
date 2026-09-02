# Story 104 — Administration: Audit Log Search, Filtering & a Bounded Result Cap

## Prerequisites

- Story 37/40 — `AuditLogsController`/`AuditLogsService`/`AuditLogView` foundation.
- Story 84 — `AuditLog`'s write path, the `branchId`/`branchId: null` OR-scoping convention this story extends, not replaces.
- Story 93 — `ReportDateRangeQueryDto`/`resolveReportDateRange`/`hasDateRange` (`apps/api/src/modules/reporting/report-date-range.util.ts`), reused verbatim.
- Story 101 — `ListCustomersQueryDto`'s exact DTO/validation style, the closest precedent for this story's own new DTO.

All are complete and already merged to `main`.

## Story Goal

Add `action`/`entityType`/`actorId`/date-range query filters to
`GET /audit-logs`, and cap its result set at a fixed, documented size —
closing the gap `AuditLogsController`'s own doc comment discloses ("No
pagination/filtering") and the latent unbounded-query-growth risk that
comment's own staleness now represents.

## Non-Goals

- **No full pagination (page controls, cursor, `hasMore`/`nextCursor`
  metadata).** This would be this codebase's first pagination
  implementation of any kind — a materially larger, more architecturally
  significant decision than "add filters to an existing list endpoint,"
  and out of proportion to this story's own scope. A fixed result cap
  (`take: 200`, newest-first) directly addresses the unbounded-growth
  risk without it; filtering (date range narrows what's returned) is the
  primary tool for finding older or more specific entries. A future
  story can add real pagination if 200 rows is ever a measured problem.
- **No new permission.** Reuses the existing `audit:read` permission.
- **No change to `AuditInterceptor` or the write path.** This story is
  entirely about `GET /audit-logs`'s read side.
- **No numeric query parameter.** A client-configurable `limit` would be
  this codebase's first `@Type(() => Number)`-coerced query param (every
  existing `@IsInt()` usage in this codebase validates a JSON *body*
  number, never a query string) — a new pattern not justified when a
  single fixed, documented cap already satisfies the story's own
  risk-reduction goal.
- **No branch-timezone-aware date filtering.** Reusing
  `resolveReportDateRange` verbatim means inheriting its own documented
  UTC-only limitation — consistent with every existing caller of that
  function, not a new gap introduced here.

## Design decisions

1. **New `ListAuditLogsQueryDto extends ReportDateRangeQueryDto`**
   (`apps/api/src/modules/admin/dto/list-audit-logs-query.dto.ts`):
   ```ts
   export class ListAuditLogsQueryDto extends ReportDateRangeQueryDto {
     @ApiProperty({ required: false })
     @IsOptional() @IsString() action?: string;

     @ApiProperty({ required: false })
     @IsOptional() @IsString() entityType?: string;

     @ApiProperty({ required: false })
     @IsOptional() @IsUUID() actorId?: string;
   }
   ```
   `action`/`entityType` are exact-match equality filters (not
   `contains`) — every existing value is a fixed, code-defined string
   (`"auth.login"`, `"role.updated"`, `"ticket"`, ...), never free text a
   user might partially remember, unlike `Customer.displayName`/
   `KnowledgeBaseArticle.title`. `from`/`to` are inherited as-is —
   identical `YYYY-MM-DD` shape/validation/semantics to every
   `GET /reports/*` route.

2. **`AuditLogsService.listAuditLogs(query: ListAuditLogsQueryDto = {})`**:
   ```ts
   const MAX_AUDIT_LOG_ROWS = 200;

   async listAuditLogs(query: ListAuditLogsQueryDto = {}): Promise<AuditLogSummary[]> {
     const { branchId } = this.tenantContext.requireBranchScope();
     const range = resolveReportDateRange(query.from, query.to);
     const logs = await this.prisma.auditLog.findMany({
       where: {
         AND: [
           { OR: [{ branchId }, { branchId: null }] },
           ...(query.action ? [{ action: query.action }] : []),
           ...(query.entityType ? [{ entityType: query.entityType }] : []),
           ...(query.actorId ? [{ actorId: query.actorId }] : []),
           ...(hasDateRange(range) ? [{ createdAt: range }] : []),
         ],
       },
       orderBy: { createdAt: "desc" },
       take: MAX_AUDIT_LOG_ROWS,
     });
     return logs.map(toAuditLogSummary);
   }
   ```
   Omitting every filter reproduces the exact pre-Story-104 `OR`
   condition and ordering, now with the new `take` cap applied
   unconditionally (a deliberate behavior change, not gated behind a
   flag — the whole point is that no caller should ever trigger a
   genuinely unbounded scan).

3. **New composite index**: `@@index([branchId, createdAt])` on
   `AuditLog` — supports both the existing branch-scoping filter and the
   new `createdAt`-ordered, capped query together, mirroring how other
   frequently-filtered tables in this schema already index their own
   primary scope column.

4. **`AuditLogsController.list(@Query() query: ListAuditLogsQueryDto)`**
   — same route, same `audit:read` permission, mirrors
   `CustomersController.list`'s exact `@Query() query: <Dto>` shape
   (Story 101).

5. **Frontend**: `AuditLogView` gains a filter bar — free-text-feeling
   but actually constrained `action`/`entityType` `Input`s (blur-commit,
   mirroring `TicketListView`'s own `category` filter `Input` shape) plus
   a date-range control mirroring `ReportsView`'s own `{from, to}`
   `<Input type="date">` pair (Story 93). `useAuditLogsQuery(filters)`
   gains an optional, additive `filters` param, mirroring
   `useCustomersQuery(filters)`'s own Story 101 parameterization.

## Files expected to change

**Backend**
- `apps/api/prisma/schema.prisma` — `AuditLog` gains `@@index([branchId, createdAt])`.
- `apps/api/prisma/migrations/<timestamp>_add_audit_log_branch_created_at_index/migration.sql` — generated.
- `apps/api/src/modules/admin/dto/list-audit-logs-query.dto.ts` — new.
- `apps/api/src/modules/admin/audit-logs.service.ts` — filtering/cap.
- `apps/api/src/modules/admin/audit-logs.service.spec.ts` — new unit tests.
- `apps/api/src/modules/admin/audit-logs.controller.ts` — `@Query()`.
- `apps/api/test/audit-logs-read.e2e-spec.ts` — new e2e tests.

**Frontend**
- `apps/web/src/lib/audit-logs-api.ts` — `AuditLogFilters`, `listAuditLogs(filters)`.
- `apps/web/src/hooks/use-audit-logs.ts` — `useAuditLogsQuery(filters)`.
- `apps/web/src/components/audit-logs/audit-log-view.tsx` — filter bar.
- `apps/web/src/components/audit-logs/audit-log-view.spec.tsx` — new tests.
- `apps/web/messages/{en,ar}.json` — new `auditLogs.filter*` strings.

## Acceptance / Done Criteria

- `GET /audit-logs` with no query params returns the exact same rows
  (now capped at 200, newest-first) as before this story, for any branch
  with 200 or fewer matching rows.
- `?action=`/`?entityType=`/`?actorId=` filter by exact match; combining
  several ANDs them together.
- `?from=&to=` filters by `createdAt`, identical semantics to
  `GET /reports/*`; an invalid/reversed range returns `400`.
- No response ever exceeds 200 rows, regardless of how many rows
  actually match.
- The `branchId`/`branchId: null` scoping (Story 84) is preserved exactly
  under every filter combination.
- `AuditLogView` renders the new filter bar; every existing "renders the
  audit log table" test still passes unmodified.

## Verification Plan

- `apps/api prisma:generate`, migrate (`--create-only` + `deploy`, this
  sandbox's established safe two-step per `CLAUDE.md` §5).
- `apps/api` unit: new filter/cap tests in `audit-logs.service.spec.ts` —
  then the full `pnpm --filter @crm/api test`.
- `apps/api` e2e: new tests in `audit-logs-read.e2e-spec.ts`, run in
  isolation first, then a full `pnpm --filter @crm/api test:e2e` sweep
  (accepting the pre-existing, documented environmental failures —
  realtime-presence, reporting historical-data date-boundary pollution —
  as unrelated, per this session's own Story 100-103 verification).
- `pnpm --filter @crm/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `git status --short` / `git diff --stat` review before commit.
