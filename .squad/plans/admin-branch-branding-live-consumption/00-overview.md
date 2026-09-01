# admin-branch-branding-live-consumption — plan overview

Entry point for the **admin-branch-branding-live-consumption** feature.
Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 82 | [82-story-branding-live-consumption.md](./82-story-branding-live-consumption.md) | Branding — Live Logo/Color Consumption | — | `admin-branch-branding` Story 62 (`BrandingConfig`, `GET /branding`, the admin config form), `agent-workspace-navigation-menu` Story 44 (`WorkspaceNav`), `customer-portal-authentication-foundation` Story 52 (`PortalHeader`), `in-app-notification-delivery` Story 24 (`BranchNotifications` — the "one branch-wide consumer wired into the authenticated layout" precedent this mirrors) |

## Dependency notes

- Closes Story 62's own disclosed non-goal: *"the live, shared-layout
  consumption is an explicit, separate follow-up once this foundation
  exists."* Fulfills `docs/architecture/08-supporting-domains.md`'s own
  still-unmet promise: *"Branding configuration... is owned by
  `AdminModule`... and consumed by both Next.js apps through Tailwind CSS
  variables."*
- Five prior Recon cycles (Stories 59, 60, 61, 63, 64's own `00-overview.md`
  dependency notes) passed over this exact gap, each time citing
  `docs/architecture/12-risks-tradeoffs-and-scope.md` risk #1 (RTL/i18n
  regressions from new `ml-`/`mr-`/`left-`/`right-` classes). That risk was
  scoped one level too broadly ("touches shared root layouts"): the
  `dir`/`lang` RTL logic lives only in each app's outermost
  `[locale]/layout.tsx`, untouched by this story. The actual, safe
  insertion point is the *nested*, already-mutable `(agent)/layout.tsx`/
  `(customer)/layout.tsx` and their own `WorkspaceNav`/`PortalHeader`
  children — the exact same shape `BranchNotifications` (Story 24) and
  `PortalHeader` itself (Story 52) already use for "one branch-wide,
  post-auth consumer." No new `ml-`/`mr-`/`left-`/`right-` class is
  introduced anywhere in this story.
- `GET /branding` (Story 62) is agent-only (`RequirePermissions
  ("branding:read")`, no meaning for a Contact, which "has no role
  system" — `PortalTicketsController`'s own doc comment). The Portal side
  needs its own, separate, `@PortalRoute()`-gated read endpoint
  (`GET /portal/branding`) — mirrors `PortalKnowledgeBaseController`'s
  own precedent of reading `claims.branchId` directly, never
  `TenantContext` (which portal requests never populate).
