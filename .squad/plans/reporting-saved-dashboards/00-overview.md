# reporting-saved-dashboards — plan overview

Entry point for the **reporting-saved-dashboards** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 110 | [110-story-reporting-saved-dashboards.md](./110-story-reporting-saved-dashboards.md) | Reporting & Analytics — Saved Dashboards | — | Story 56 (reporting-analytics-foundation), 59/60/93/99 (reporting's 6 metrics + shared date-range control) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 115, from the
  standing, user-approved unblocked backlog. It is the last remaining
  candidate after Stories 109, 114, and 115 all shipped in this session
  — no other domain in `docs/architecture/03-domain-boundaries.md`'s
  full table surfaced a higher-priority gap under CLAUDE.md §2 in two
  independent Recon sweeps (after Story 108 and again after Story 115).
- **The gap**: `docs/architecture/03-domain-boundaries.md`'s Reporting &
  Analytics row names "Materialized views/read models **and saved
  dashboards**" among what that domain owns. `ReportingService`
  (Story 56, extended by 59/60/93/99) implements six read-only,
  branch-scoped report endpoints but nothing persists a saved
  arrangement of them — every visit to `apps/web`'s Reports screen shows
  the same fixed six-card grid, un-savable, un-shareable.
- **Why not externally blocked**: purely internal, no external
  provider/credential decision needed (unlike Communication/Channels'
  outbound-delivery work and the whole Integrations domain, both
  reconfirmed still blocked this session — no email/SMS/WhatsApp/ERP
  provider named anywhere in the repository, confirmed by a repo-wide
  grep during this Story's own Recon).
- **Design decisions this story makes** (the domain-boundary table names
  the capability but specifies no schema — resolved here, mirroring how
  Story 109 resolved KB's own deferred "decided by the feature story"
  design gap):
  - **A widget is a saved reference to one of the 6 existing
    `ReportingService` methods, verbatim** — a `ReportWidgetType` enum
    value, nothing more. No new chart types, no arbitrary visualization
    config: this codebase has no charting library anywhere (confirmed
    directly in `reports-view.tsx`'s own Story 56 doc comment), and
    inventing one is out of scope for what closes this gap.
  - **No per-widget saved date range.** `reports-view.tsx`'s own Story
    93 decision was explicit: "one dashboard-wide 'view this period'
    control, not five independent pickers — nothing in this per-card
    architecture disclosed a need for report-specific ranges." A saved
    dashboard reuses that exact same shared, page-level date-range
    control for whichever widgets it contains — introducing a
    per-widget saved range now would reintroduce the complexity that
    decision explicitly rejected, for a need no story has disclosed.
  - **Layout is an ordered list** (`position: Int`), rendered through
    the exact same `ReportCard` component and responsive grid
    `reports-view.tsx` already uses per widget — not a free-form x/y/w/h
    grid (no grid-layout library exists in this codebase; adding one
    would be unjustified new surface for a gap that only asks for
    "saved dashboards," not a drag-and-drop layout builder).
  - **Sharing is a binary `isShared` flag**, not a per-user ACL — this
    codebase has zero precedent for per-resource ACLs anywhere; every
    existing scoped resource is role+branch scoped only
    (`docs/architecture/03-domain-boundaries.md`,
    `04-data-and-multitenancy.md`). `isShared: false` (default):
    visible/editable only by the owner. `isShared: true`: visible
    read-only to any branch member holding `report:read`; still only
    editable/deletable by the owner.
  - **Permission: reuse `report:read`.** No new permission key. A
    dashboard is a saved arrangement of reports the caller can already
    query directly — gating it behind the same permission that gates
    the underlying data is the minimal correct rule. This mirrors
    `NotificationPreference`'s "personal config, no dedicated
    permission" precedent, not `QuickReply`/`AutomationRule`'s
    dedicated `create`/`update` keys (curated, cross-role content those
    two are, which a dashboard is not — it is the caller's own saved
    view over data they already see).
  - **New `reporting` Postgres schema** — `ReportingService` today reads
    only tables owned by other schemas (`ticketing`, `sla`); this is the
    first table Reporting & Analytics actually owns, so a new logical
    schema is added to `datasource.schemas` (mirrors every other
    domain's own dedicated schema). Story 115's `crm_app` runtime-role
    grants are extended to cover it — a schema `add_runtime_db_role_grants`
    did not and could not have anticipated.
- **Scope-narrowing decisions** (see the story doc's own Non-Goals for
  the full list): no drag/resize free-form grid; no per-widget chart
  type choice; no sharing to specific users/roles (branch-wide-or-private
  only); no scheduled export/email of a dashboard (a separate,
  materially larger Notifications-adjacent capability); Customer Portal
  untouched (reporting has always been agent/admin-only).
