> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/reporting-saved-dashboards/reporting-saved-dashboards/intake.md`

---

## Feature

- **Feature name (display):** Reporting & Analytics — Saved Dashboards
- **Feature slug (folder under `plans/`):** `reporting-saved-dashboards`

## Title

```text
Story 110 — Reporting & Analytics: Saved Dashboards
```

## Description

```text
docs/architecture/03-domain-boundaries.md names "saved dashboards" as
part of what the Reporting & Analytics domain owns, alongside its
materialized views/read models -- a capability that has never been
implemented. ReportingService (Story 56, extended by 59/60/93/99)
implements six read-only, branch-scoped report endpoints but nothing
persists a saved arrangement of them. This story adds a new
ReportDashboard/ReportDashboardWidget schema (a new "reporting" Postgres
schema -- the first table this domain actually owns), lets a caller save
a named, ordered subset of the 6 existing report widgets, optionally
shared read-only with their branch, and wires apps/web's Reports screen
to pick between "All reports" (today's unchanged default) and a saved
dashboard.
```

## Acceptance criteria

```text
- [ ] New reporting Postgres schema; ReportDashboard/
      ReportDashboardWidget/ReportWidgetType created; crm_app (Story
      115) granted on the new schema.
- [ ] POST/GET/GET:id/PATCH/DELETE /reports/dashboards -- create,
      list (own + shared), get one (404 otherwise), owner-only
      update/delete (404 for a non-owner).
- [ ] All 5 routes reuse report:read -- no new permission.
- [ ] Duplicate widgetType in one dashboard rejected at the DTO layer.
- [ ] apps/web Reports screen: "All reports" default unchanged, plus a
      picker over own/shared dashboards rendering only saved widgets in
      saved order via the existing ReportCard component and shared
      date-range control; owner-only save/update/delete actions.
- [ ] Unit coverage for DashboardsService and DTO validation.
- [ ] e2e coverage: create/list/shared-visibility/update/delete/404
      lifecycle, including a non-owner's update/delete 404ing.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures.
```

## Dependencies

- Story 56 — Reporting & Analytics Foundation (`ReportingService`, the
  6 report methods a widget references).
- Story 59/60/93/99 — the agent-performance/ticket-aging metrics, the
  shared `{from, to}` date-range control, and resolution-time — all
  reused unchanged by a saved dashboard's widgets.
- Story 115 — the `crm_app` runtime role this story's migration extends
  to the new `reporting` schema.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- New chart types / visualization config (no charting library exists).
- Per-widget saved date range (the existing shared page-level control
  applies uniformly, per Story 93's own explicit decision against
  per-card independent controls).
- Free-form drag/resize grid layout.
- Per-user/per-role sharing ACL (binary isShared only).
- Scheduled export/email delivery of a dashboard.
- Customer Portal exposure.
- A new permission key.
