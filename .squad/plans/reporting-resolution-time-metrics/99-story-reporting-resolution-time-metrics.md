# Story 99 — Reporting & Analytics: Ticket Resolution-Time Metrics

## Prerequisites

- `reporting-analytics-foundation` Story 56 — `ReportingModule`/
  `ReportingService`/`ReportingController`, the "one direct Prisma query
  per report, branch-scoped via `TenantContext.requireBranchScope()`"
  pattern this story's sixth report follows exactly.
- `reporting date-range filtering` Story 93 (unindexed in `.squad`, commit
  `56ea226`) — `ReportDateRangeQueryDto`, `resolveReportDateRange`/
  `hasDateRange` (`report-date-range.util.ts`) — reused verbatim, no
  change to either.
- `apps/web`'s `ReportsView`/`ReportCard` (Stories 56/59/60/93) — the
  `skeleton="stat" | "list"` per-card shape (Story 97) this story's new
  card uses (`stat`, matching SLA Compliance/CSAT).
- `apps/web/src/lib/sla.ts`'s `formatRemaining(ms)` — reused as-is for
  formatting the average duration (see Design decision 5).

All are complete and already merged to `main`.

## Story Goal

Add `Ticket.resolvedAt`, populate/clear it correctly as a direct
consequence of the existing `PATCH /tickets/:id` status-transition logic,
and expose a sixth Reporting metric — average resolution time — through
the existing `ReportingService`/`ReportingController`/`ReportsView`
pattern. This closes the gap `reporting.service.ts` itself names in four
separate doc comments (see `00-overview.md`).

## Non-Goals

- **No materialized views or reporting schema.** Still a direct Prisma
  query over `Ticket`, exactly like the other five reports —
  `docs/architecture/08-supporting-domains.md`'s "deferred until query
  load ... outgrow Postgres" is unchanged.
- **No portal-facing reporting.** The portal has no reporting surface at
  all today; not introduced here.
- **No charting library.** The new report renders as a plain stat tile
  (big number + caption), exactly like `SlaComplianceSummary`/
  `CsatSummary` already do — no new dependency.
- **No backfill of historical tickets.** Every `Ticket` row already
  `RESOLVED`/`CLOSED` before this migration keeps `resolvedAt: null`
  forever (Prisma's default `ADD COLUMN ... NULL` — no `UPDATE` statement
  is added to the migration). The new report's query already excludes
  `resolvedAt: null` rows from the average by construction (the same
  "only what exists, never approximated" convention `SlaComplianceSummary`'s
  own doc comment establishes) — a backfill would need to *guess* a
  resolution time for pre-existing tickets, which is exactly the kind of
  approximation the SLA-compliance report's own doc comment explicitly
  refuses to do for the same underlying reason.
- **No exposure of `resolvedAt` on `TicketSummary`, the ticket detail
  view, or the ticket list.** It is a purely internal column consumed
  only by the new report query — keeps this story bounded to the
  reporting metric, not a ticket-detail-view feature.
- **No new permission.** Reuses the existing `report:read` permission
  every other `/reports/*` route already requires.
- **No business-hours-aware duration.** Plain wall-clock
  `resolvedAt - createdAt`, mirroring `getTicketAging`'s own "plain
  wall-clock difference ... no business-hours awareness (unlike SLA
  target computation)" precedent exactly — SLA target computation is the
  one place in this codebase that intentionally is business-hours-aware,
  and duplicating that logic here for a different, coarser-grained metric
  is out of scope.

## Design decisions

1. **New nullable `resolvedAt DateTime? @map("resolved_at")` column on
   `Ticket`** (`ticketing` schema, `apps/api/prisma/schema.prisma`).
   Nullable because (a) most historical/open tickets never resolve, and
   (b) a reopened ticket must be able to return to "not currently
   resolved" (see decision 2) — mirrors `SlaTicketTarget`'s own
   nullable-until-applicable shape, not a `@default(now())` column. No
   new index — consistent with this exact model's own precedent (`Ticket`
   has no index on `createdAt` either, despite every existing report
   filtering by it).

2. **Transition rule, inline in `TicketsService.updateTicket`** (not a
   separate `EventEmitter2` listener): `resolvedAt` is a plain column on
   the *same* `Ticket` row already being updated in the same
   `prisma.ticket.update()` call — unlike SLA-target recomputation
   (a *different* model, `SlaTicketTarget`, correctly reacting to a
   `ticket.recategorized` event), there is no cross-cutting concern here
   that justifies a listener. A `RESOLVED_STATUSES` set — `new
   Set(["RESOLVED", "CLOSED"])` — reuses this exact codebase's own
   existing precedent for "what counts as resolved":
   `TicketsService.submitCsat`'s existing eligibility check
   (`tickets.service.ts:423`: `if (ticket.status !== "RESOLVED" &&
   ticket.status !== "CLOSED")`) and the portal frontend's
   `CSAT_ELIGIBLE_STATUSES` — both already treat `RESOLVED` and `CLOSED`
   as the same tier, not two separate states with two separate meanings.
   Rule, computed from `existing.status` (already fetched by
   `findTicketInScope` before this line, no new query) vs. the *tier* the
   ticket is moving to:
   - `wasResolved = RESOLVED_STATUSES.has(existing.status)`
   - `isResolved = dto.status !== undefined ? RESOLVED_STATUSES.has(dto.status) : wasResolved`
   - `!wasResolved && isResolved` → newly resolved → `resolvedAt = new Date()`
   - `wasResolved && !isResolved` → **reopened** → `resolvedAt = null`
   - `wasResolved && isResolved` (e.g. `RESOLVED` → `CLOSED`, or `CLOSED` →
     `RESOLVED`) → **unchanged** — the ticket was never actually reopened,
     so its original resolution moment stays the true one.
   - `!wasResolved && !isResolved` (e.g. `OPEN` → `IN_PROGRESS`, or
     `status` not present in the DTO at all) → unchanged, stays `null`.
   - **Resolving again after a reopen**: reopening already cleared
     `resolvedAt` to `null` (case 2), so the next `!wasResolved &&
     isResolved` transition sets a *fresh* timestamp (case 1) — the
     column always reflects "when was this ticket most recently
     resolved," the same semantic `updatedAt` already carries for "most
     recently changed."
   - The computed value is spread into the existing `data: {...}` object
     only when it actually needs to change (`resolvedAtUpdate !==
     undefined`), mirroring every other field in that same object's
     existing "only include if defined/changed" convention — an update
     that never touches the resolved/not-resolved boundary (the large
     majority of `PATCH /tickets/:id` calls) produces a `data` object
     byte-for-byte identical to today's, so the existing
     `"only includes fields present in the DTO"` unit test does not need
     its expected `data` object to change.

3. **New `ResolutionTimeSummary` in `reporting.service.ts`**, mirroring
   `CsatSummary`'s exact shape (a count + a nullable average — never a
   misleading `0` when there is no data yet):
   ```ts
   export interface ResolutionTimeSummary {
     resolvedCount: number;
     averageResolutionMs: number | null;
   }
   ```
   `getResolutionTime(from?, to?)`:
   - Filters the cohort by **`Ticket.resolvedAt`** (when the ticket
     *became* resolved), not `createdAt` — the same "filter on whichever
     timestamp represents when this fact became true" rule
     `getCsatSummary` already applies (filtering by
     `TicketCsatResponse.createdAt`, "feedback submitted in this window,"
     not "tickets created in this window"). A ticket resolved five months
     after being created, but resolved *this week*, belongs in this
     week's resolution-time report.
   - Query: `prisma.ticket.findMany({ where: { branchId, resolvedAt: {
     not: null, ...(hasDateRange(range) ? range : {}) } }, select: {
     createdAt: true, resolvedAt: true } })` — a `findMany` + JS
     aggregation (not a Prisma `aggregate()`), because the duration
     itself (`resolvedAt - createdAt` per row) is not a column Postgres
     can average directly without a raw/computed expression; this mirrors
     `getTicketAging`'s own identical "`findMany` + reduce in JS" shape
     for the same reason (age is also a computed, not stored, duration).
   - `averageResolutionMs = resolvedCount > 0 ? totalMs / resolvedCount :
     null`.

4. **New route `GET /reports/resolution-time`**, `@RequirePermissions("report:read")`
   — the sixth, alongside the existing five, no new permission.

5. **Frontend**: a sixth `ReportCard` in `ReportsView`,
   `skeleton="stat"` (matching SLA Compliance/CSAT's big-number-plus-
   caption shape, not the three-row list shape). Populated body:
   ```tsx
   {resolutionTimeQuery.isSuccess && resolutionTimeQuery.data.resolvedCount === 0 && (
     <p className="text-sm text-slate-500">{t("resolutionTime.empty")}</p>
   )}
   {resolutionTimeQuery.isSuccess && resolutionTimeQuery.data.resolvedCount > 0 && (
     <div className="flex flex-col gap-1 text-sm">
       <span className="text-2xl font-semibold text-slate-900">
         {formatRemaining(resolutionTimeQuery.data.averageResolutionMs!)}
       </span>
       <span className="text-slate-500">
         {t("resolutionTime.detail", { count: resolutionTimeQuery.data.resolvedCount })}
       </span>
     </div>
   )}
   ```
   Reuses `apps/web/src/lib/sla.ts`'s existing `formatRemaining(ms)`
   (`"2h 15m"`/`"45m"`/`"<1m"`) rather than writing a second duration
   formatter — its logic (floor to minutes, split into hours/minutes) is
   generic duration formatting, not inherently about a *countdown*
   despite the function's name predating this use case; introducing a
   near-duplicate formatter for the same math is a worse outcome than one
   doc-comment noting the reuse at the new call site. (For a resolution
   time spanning multiple days this renders as e.g. `"52h 30m"` rather
   than `"2d 4h 30m"` — a minor, explicitly accepted readability
   trade-off, not a defect, in exchange for zero new formatting code.)
   `reports-view.tsx`'s grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`)
   becomes `lg:grid-cols-6` for the sixth card.

## Files expected to change

**Backend**
- `apps/api/prisma/schema.prisma` — add `resolvedAt` to `Ticket`.
- `apps/api/prisma/migrations/<timestamp>_add_ticket_resolved_at/migration.sql` — generated.
- `apps/api/src/modules/tickets/tickets.service.ts` — `RESOLVED_STATUSES` set + transition logic in `updateTicket`.
- `apps/api/src/modules/tickets/tickets.service.spec.ts` — new tests for the transition logic.
- `apps/api/src/modules/reporting/reporting.service.ts` — `ResolutionTimeSummary` + `getResolutionTime`.
- `apps/api/src/modules/reporting/reporting.service.spec.ts` — new unit tests.
- `apps/api/src/modules/reporting/reporting.controller.ts` — new route.
- `apps/api/test/reporting.e2e-spec.ts` — new e2e tests (including reopen/re-resolve and date-range).

**Frontend**
- `apps/web/src/lib/reporting-api.ts` — `ResolutionTimeSummary` + `getResolutionTime`.
- `apps/web/src/hooks/use-reporting.ts` — `useResolutionTimeQuery`.
- `apps/web/src/components/reporting/reports-view.tsx` — new card, grid change.
- `apps/web/src/components/reporting/reports-view.spec.tsx` — new tests.
- `apps/web/messages/{en,ar}.json` — `reporting.resolutionTime.{heading,empty,detail}`.

## Acceptance / Done Criteria

- A ticket newly transitioning into `RESOLVED` or `CLOSED` (from `OPEN`/
  `IN_PROGRESS`) gets `resolvedAt` set to the current time.
- A ticket transitioning out of `{RESOLVED, CLOSED}` back to `{OPEN,
  IN_PROGRESS}` gets `resolvedAt` cleared to `null`.
- A ticket moving between `RESOLVED` and `CLOSED` (already in the
  resolved tier both before and after) does not change `resolvedAt`.
- A ticket resolved, reopened, then resolved again gets a fresh
  `resolvedAt`, not the original one.
- `PATCH /tickets/:id` calls that never cross the resolved/not-resolved
  boundary produce a `data` object with no `resolvedAt` key at all
  (existing "only includes fields present" test unchanged).
- `GET /reports/resolution-time` returns `{ resolvedCount: 0,
  averageResolutionMs: null }` when no ticket has ever resolved in the
  window; a correct average otherwise.
- The date range (`?from=&to=`) filters by `Ticket.resolvedAt`, proven by
  a `[today,today]` vs `[yesterday,yesterday]` delta test mirroring the
  other five reports' own Story 93 tests.
- Omitting `from`/`to` reproduces the exact all-time query shape (no
  `resolvedAt` range key at all in the `where`, only the `not: null`
  guard).
- `ReportsView` renders the new card in the existing empty/populated
  states, with a shaped `stat` skeleton while loading.

## Verification Plan

- `pnpm --filter @crm/api prisma:generate`
- `apps/api` unit: `tickets.service.spec.ts` (new `resolvedAt` transition
  tests), `reporting.service.spec.ts` (new `getResolutionTime` tests) —
  then the full `pnpm --filter @crm/api test`.
- `apps/api` e2e: new tests in `reporting.e2e-spec.ts`, run in isolation
  first (`npx vitest run test/reporting.e2e-spec.ts --no-file-parallelism`
  from `apps/api`, per `CLAUDE.md` §5's documented fallback since
  `prisma migrate reset --force` is blocked in this sandbox), then a full
  `pnpm --filter @crm/api test:e2e` sweep (accepting the two pre-existing,
  documented `identity.e2e-spec.ts` isolation defects as unrelated, per
  `CLAUDE.md` §5/§13).
- `apps/web`: new `reports-view.spec.tsx` tests, then full
  `pnpm --filter @crm/web test`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `git status --short` / `git diff --stat` review before commit —
  confirm the pre-existing, unrelated `identity.service.ts` modification
  is not staged.
