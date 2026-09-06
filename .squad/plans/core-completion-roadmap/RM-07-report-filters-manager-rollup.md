# RM-07 — Reports: Cross-Dimension Filters + Manager Cross-Branch Rollup

**Priority:** P1 · **Complexity:** Large · **Blocked:** No · **Phase:** 2 (Reporting)

## Goal

Add branch/department/agent/category filter parameters to all eight
`ReportingService` endpoints, and a distinct cross-branch rollup path for a
caller holding a new, explicitly-scoped cross-branch reporting permission.

## Why it exists

Every one of the eight report endpoints is locked to the caller's single
active branch (`TenantContext.requireBranchScope()`) with no
department/agent/category filter beyond what a couple of reports already
group by internally. There is no way for anyone — including a
multi-branch-overseeing manager — to see an aggregated, cross-branch view.
The current seed baseline has no distinct manager role either; any role
with `report:read` sees the same single-branch report as anyone else with
that permission.

## Dependencies

None technically, though sequenced before `RM-08` (charts) so the chart
work reads the final, filterable query shape rather than being reworked
after.

## Backend work

- Extend `ReportDateRangeQueryDto` with optional `departmentId`, `agentId`
  (i.e. `assignedToUserId`), and `categoryId` filters; thread each through
  the relevant `ReportingService` methods' existing Prisma `where` clauses
  (most already filter by `branchId` — add the new fields as additional,
  optional `AND` conditions).
- New permission `report:read-cross-branch` (a superset capability, not a
  replacement for `report:read`) — granted to a new, admin-creatable role
  shape (no code changes needed to create such a role; RBAC is already
  fully general, per Core 10's COMPLETE status) or explicitly to
  `SuperAdmin` at minimum.
- A new cross-branch aggregation path: for a caller with
  `report:read-cross-branch`, each report method accepts a `branchIds`
  array (defaulting to "all branches the org has") instead of the single
  `TenantContext`-resolved branch, returning either an aggregated total or
  a per-branch breakdown (decide the exact shape per-endpoint during
  implementation — a per-branch breakdown is the more useful default for
  ticket-volume/SLA-compliance/agent-performance; a single aggregated number
  is sufficient for CSAT).

## Frontend work

- Filter controls (department/agent/category dropdowns, reusing existing
  picker components already used elsewhere — e.g. the ticket list's own
  category/agent filters) added to `reports-view.tsx`.
- A branch-selector (visible only to a caller with the new permission)
  toggling between "my branch" and "all branches" / a specific subset.

## Worker/realtime work

None.

## Schema/migration work

None — no new tables; only new query parameters and one new permission row
in the existing `Permission` catalog (seeded, not a schema change).

## Tests

- `reporting.service.spec.ts` — extend for each new filter dimension and
  the cross-branch path.
- `reporting.e2e-spec.ts` — extend: a caller without
  `report:read-cross-branch` cannot pass `branchIds` (400 or silently
  ignored — decide and assert one behavior consistently); a caller with it
  sees the correct aggregated/per-branch data.

## Acceptance criteria

- Every report can be filtered by department/agent/category within a
  branch.
- A caller with `report:read-cross-branch` sees an aggregated multi-branch
  view; everyone else's existing single-branch behavior is unchanged.
- No report endpoint's existing (pre-this-story) callers see any behavior
  change.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/web test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
