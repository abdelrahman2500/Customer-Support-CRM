# Story 110 — Reporting & Analytics: Saved Dashboards

## Goal

Let a caller save a named, ordered arrangement of the 6 existing report
widgets (ticket volume, SLA compliance, CSAT, agent performance, ticket
aging, resolution time) as a "dashboard," optionally shared read-only
with their whole branch — closing
`docs/architecture/03-domain-boundaries.md`'s named-but-unbuilt gap
("Materialized views/read models and **saved dashboards**").

## Non-goals

- No new chart types or visualization config — a widget is a saved
  reference to one of the 6 existing `ReportingService` methods,
  verbatim. This codebase has no charting library anywhere.
- No per-widget saved date range. `reports-view.tsx`'s existing,
  page-level `{from, to}` control (Story 93) applies uniformly to every
  widget on a dashboard, exactly as it already does today's fixed
  six-card grid — no per-widget override.
- No free-form drag/resize grid layout. A dashboard's widgets are an
  ordered list (`position`), rendered through the exact same responsive
  CSS grid and `ReportCard` component `reports-view.tsx` already uses.
- No per-user/per-role sharing ACL. Sharing is a single `isShared`
  boolean: private-to-owner, or read-only to the whole branch (any
  caller holding `report:read`).
- No scheduled export/email delivery of a dashboard — a separate,
  materially larger Notifications-adjacent capability.
- No Customer Portal exposure — Reporting & Analytics has always been
  agent/admin-only (`ReportingController`'s existing `report:read` gate).
- No new permission key — every dashboard endpoint reuses `report:read`.

## Design

### Schema (`apps/api/prisma/schema.prisma`)

First table Reporting & Analytics actually owns (today `ReportingService`
only reads tables other domains own) — a new logical schema,
`"reporting"`, added to `datasource db { schemas = [...] }`.

```prisma
enum ReportWidgetType {
  TICKET_VOLUME
  SLA_COMPLIANCE
  CSAT
  AGENT_PERFORMANCE
  TICKET_AGING
  RESOLUTION_TIME

  @@schema("reporting")
}

model ReportDashboard {
  id          String   @id @default(uuid())
  branchId    String   @map("branch_id")
  branch      Branch   @relation(fields: [branchId], references: [id])
  ownerUserId String   @map("owner_user_id")
  owner       User     @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  name        String
  isShared    Boolean  @default(false) @map("is_shared")
  widgets     ReportDashboardWidget[]
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([branchId, isShared])
  @@index([ownerUserId])
  @@map("report_dashboards")
  @@schema("reporting")
}

model ReportDashboardWidget {
  id          String           @id @default(uuid())
  dashboardId String           @map("dashboard_id")
  dashboard   ReportDashboard  @relation(fields: [dashboardId], references: [id], onDelete: Cascade)
  widgetType  ReportWidgetType @map("widget_type")
  position    Int
  createdAt   DateTime         @default(now()) @map("created_at")

  @@unique([dashboardId, position])
  @@unique([dashboardId, widgetType])
  @@map("report_dashboard_widgets")
  @@schema("reporting")
}
```

`Branch` gains `reportDashboards ReportDashboard[]`; `User` gains
`reportDashboards ReportDashboard[]` — mirrors every other
branch-/user-scoped table's existing back-relation convention
(`quickReplies`/`notificationPreferences`).

`onDelete: Cascade` on `owner`: deleting a `User` removes their saved
dashboards, mirroring `NotificationPreference`'s identical precedent (no
precedent anywhere in this schema for orphaning a personal-config row
instead). No `onDelete` override on `branch` — `Branch` rows are never
actually deleted by any existing code path (mirrors `QuickReply`'s own
plain, unmodified `branch` relation).

Migration also extends Story 115's `crm_app` runtime role to the new
`reporting` schema (`GRANT USAGE`/table grants/`ALTER DEFAULT
PRIVILEGES`, identical shape to that migration's other 9 schemas) — a
schema that migration could not have anticipated, since it didn't exist
yet.

### Backend (`apps/api/src/modules/reporting`)

- New `dashboards.service.ts` (`DashboardsService`), alongside the
  existing `reporting.service.ts` in the same module — not a new
  top-level module: both own the same domain
  (`docs/architecture/03-domain-boundaries.md`'s single "Reporting &
  Analytics" row), mirroring how `QuickRepliesService` lives inside the
  existing `ChannelsModule` rather than a new one.
  - `createDashboard(dto)` — `{branchId}` from
    `TenantContext.requireBranchScope()`, `ownerUserId` from a private
    `requireAuthenticatedUserId()` helper (mirrors
    `TicketChannelService`'s/`AttachmentsService`'s identical
    convention: plain `Error` if absent, never reached in practice since
    every route is behind `AuthGuard`). Creates the dashboard and its
    widgets (by `widgetType`, in the given order — `position` assigned
    from array index) in one `prisma.$transaction`.
  - `listDashboards()` — branch-scoped, returns dashboards the caller
    owns **or** that are `isShared: true`, each with its ordered
    widgets. `orderBy: [{ ownerUserId: ... }]`... no — simplest,
    deterministic: `orderBy: { createdAt: "asc" }`, mirrors
    `QuickRepliesService.listQuickReplies`.
  - `getDashboard(id)` — same visibility rule as `listDashboards`
    (`findFirst({ where: { id, branchId, OR: [{ ownerUserId: callerId
    }, { isShared: true }] } })`); `NotFoundException` otherwise (never
    `ForbiddenException` — that class appears nowhere in
    `apps/api/src/modules`, matching every existing convention here).
  - `updateDashboard(id, dto)` — `name`/`isShared`/`widgets` (full
    replace of the widget list, same all-or-nothing shape `createDashboard`
    uses) all optional; ownership-scoped write
    (`findFirst({ where: { id, branchId, ownerUserId: callerId } })`) —
    a shared dashboard is read-only to everyone but its owner, so a
    non-owner gets the same `NotFoundException` as a nonexistent id
    (mirrors `QuickRepliesService.updateQuickReply`'s identical
    ownership-via-404 convention, just keyed on `ownerUserId` too, not
    only `branchId`).
  - `deleteDashboard(id)` — same ownership-scoped guarantee as
    `updateDashboard`.
- New DTOs (`dto/create-dashboard.dto.ts`, `dto/update-dashboard.dto.ts`):
  `name` (`@IsString @MinLength(1) @MaxLength(200)`, mirrors
  `CreateQuickReplyDto.title`), `isShared` (`@IsOptional @IsBoolean`,
  defaults to `false` at the service layer, mirrors
  `UpdateQuickReplyDto.isActive`), `widgetTypes: ReportWidgetType[]`
  (`@IsArray @ArrayMinSize(1) @ArrayUnique @IsEnum(ReportWidgetType, {
  each: true })` — order in the array is the saved `position`; the
  `@@unique([dashboardId, widgetType])` constraint means a widget type
  can appear at most once per dashboard, which `@ArrayUnique` also
  rejects earlier, with a clearer validation-layer message).
- New `dashboards.controller.ts` (`DashboardsController`), registered
  alongside `ReportingController` in `ReportingModule` — mirrors
  `QuickRepliesController` living alongside `NotificationTemplatesController`
  inside `ChannelsModule`:
  - `POST /reports/dashboards` (`report:read`)
  - `GET /reports/dashboards` (`report:read`)
  - `GET /reports/dashboards/:id` (`report:read`)
  - `PATCH /reports/dashboards/:id` (`report:read`)
  - `DELETE /reports/dashboards/:id` (`report:read`)
- `ReportingModule`'s `providers` gains `DashboardsService`;
  `controllers` gains `DashboardsController`. No new module, no new
  permission-catalog entry in `prisma/seed.ts`.

### Frontend (`apps/web`)

- `src/lib/reporting-api.ts` gains `ReportDashboard`/`ReportDashboardWidget`
  types and `listDashboards`/`getDashboard`/`createDashboard`/
  `updateDashboard`/`deleteDashboard`, mirroring this file's own existing
  function-per-endpoint shape.
- `src/hooks/use-reporting.ts` gains `useDashboardsQuery`/
  `useDashboardQuery(id)` plus `useCreateDashboardMutation`/
  `useUpdateDashboardMutation`/`useDeleteDashboardMutation`
  (React Query, invalidating `["reports", "dashboards"]` on success —
  mirrors this codebase's existing mutation-then-invalidate convention,
  e.g. `use-quick-replies.ts`).
- `reports-view.tsx` gains a dashboard picker above the existing
  six-card grid: a `<select>` of the caller's own + shared dashboards,
  plus "All reports" (today's existing, unchanged, un-saved default —
  still the initial state, so no existing behavior changes for a caller
  who never saves one) and "Save current view as dashboard…" /
  "Delete"/"Share" actions for the owner. Selecting a saved dashboard
  filters which `ReportCard`s render (by `widgetType`, in its saved
  `position` order) — same cards, same `ReportCard` component, same
  shared `{from, to}` range control, just a subset/reorder instead of
  always all six.
- New translation keys under `apps/web/messages/{en,ar}.json`'s existing
  `reporting` namespace (`reporting.dashboards.*`) — mirrors every prior
  story's own "add keys to the existing namespace" pattern.

## Acceptance criteria

- [ ] New `reporting` Postgres schema; `ReportDashboard`/
      `ReportDashboardWidget`/`ReportWidgetType` created; `crm_app`
      granted on the new schema (Story 115 extended, not re-litigated).
- [ ] `POST /reports/dashboards` creates a dashboard + ordered widgets
      atomically; `GET /reports/dashboards` lists the caller's own +
      shared dashboards; `GET /reports/dashboards/:id` returns one
      (owned or shared) with 404 otherwise; `PATCH`/`DELETE` are
      owner-only (404 for a non-owner, including on a shared dashboard).
- [ ] All 5 dashboard routes reuse `report:read` — no new permission.
- [ ] Duplicate `widgetType` in one dashboard rejected at the DTO layer.
- [ ] `apps/web`'s Reports screen: an "All reports" default (today's
      unchanged six-card grid) plus a picker over the caller's own and
      shared dashboards; selecting one renders only its saved widgets,
      in its saved order, through the existing `ReportCard` component
      and shared date-range control; owner-only save/update/delete
      actions.
- [ ] Unit coverage: `DashboardsService`'s create/list/get/update/delete
      (ownership/shared-visibility/404 branches) and DTO validation.
- [ ] e2e coverage: create → appears in list (as owner) → visible to a
      second branch member only once `isShared: true` → update
      (rename/reorder/re-share) → delete → 404 afterward; a non-owner's
      update/delete attempt on someone else's (shared or private)
      dashboard 404s.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures (CLAUDE.md §13).

## Verification plan

```
cd apps/api && npx prisma migrate dev --create-only --name add_report_dashboards
cd apps/api && npx prisma migrate deploy
pnpm --filter @crm/api exec vitest run src/modules/reporting
npx vitest run test/reporting-dashboards.e2e-spec.ts --no-file-parallelism   # from apps/api, .env sourced
pnpm --filter @crm/web exec vitest run src/components/reporting src/hooks/use-reporting.spec.ts
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full sweep
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
