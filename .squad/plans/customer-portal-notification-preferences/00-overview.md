# customer-portal-notification-preferences — plan overview

Entry point for the **customer-portal-notification-preferences** feature.
Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 90  | [90-story-customer-portal-notification-preferences.md](./90-story-customer-portal-notification-preferences.md) | Customer Portal — Notification Preferences | — | `notification-preferences` Story 58 (the exact per-user preference shape this story mirrors for a Contact), `customer-portal-notification-delivery` Story 86 (`CustomerNotificationRealtimeListener`/`usePortalNotifications`/`PortalNotifications`, the exact two event types and client mount point this story's filter is added to), `customer-portal-notification-history-frontend` Story 89 (`NotificationHistoryView`, the page this story's new Preferences section is added to) |

## Dependency notes

- Selected via a fresh, whole-repository Recon after Story 89
  (`CLAUDE.md` §2/§8). Story 89's own plan doc explicitly named this exact
  gap and explicitly declined it only because, at that time, closing it
  first would have inverted the natural dependency order ("shipping a UI
  for an unreachable endpoint's preferences before the endpoint itself has
  any UI"). `GET /portal/notifications` now has a real, reachable frontend
  consumer (Story 89), so that objection no longer applies — this is the
  natural next increment for the Customer Portal's Notifications surface.
- **Why this, over other candidates surfaced during Recon:**
  - *Communication/Channels* (`EMAIL`/`WHATSAPP`/`SMS` provider adapters)
    and *Integrations* (ERP/external adapters) remain ineligible per
    `CLAUDE.md` §2 — no concrete provider decision exists anywhere in the
    repository (`docs/architecture/12-risks-tradeoffs-and-scope.md` still
    records "Revisit when: Not expected to be revisited" for the
    buy-channels policy; `docs/architecture/09-integrations.md` still
    describes the ERP adapter's protocol as open until a future story names
    it). Unchanged since Stories 86/87/88/89's own Recon notes.
  - *Channels — quick replies* (the still-unbuilt half of the Channels
    domain's documented "channel configuration, inbound/outbound messages,
    threads, quick replies") is a real, standing gap and a legitimate
    future candidate, but this story's own gap is more directly
    dependency-correct right now: it is a one-step-away completion of
    infrastructure Story 86/88/89 already fully built (the exact
    `NotificationPreference` shape, the exact `CustomerNotificationRealtimeListener`
    two-event surface, the exact `NotificationHistoryView` page to extend),
    where quick replies would be new schema/UI built from nothing. Per
    `CLAUDE.md` §2's priority order, closing an already-scoped,
    one-increment-away gap over an already-shipped foundation outranks
    starting a brand-new capability of comparable size.
  - *"Mark as read"/unread-count state* — a real, disclosed non-goal of
    Story 89, but it requires a genuinely new `NotificationLog` schema
    column (`isRead`) touched by both read paths (agent + portal) and by
    every future write path; it is a materially larger, riskier,
    two-domain change than one new contact-scoped preference table. Left
    for a dedicated future story exactly as Story 89 disclosed.
  - *Reporting's "saved dashboards"* — unchanged from Stories 88/89's own
    rejection: no existing per-user dashboard-configuration data model
    exists anywhere in the repository to extend.
- **Dependency correctness**: builds only on infrastructure already fully
  in place and untouched by this story — `CustomerNotificationRealtimeListener`
  (Story 86, unmodified), `usePortalNotifications`/`PortalNotifications`
  (Story 86, extended the same additive way `BranchNotifications` was
  extended by Story 58 on the agent side), `NotificationHistoryView`
  (Story 89, extended the same additive way `NotificationHistoryView`
  (`apps/web`) was extended by Story 58 on the agent side).
- **Architectural coherence**: a brand-new `PortalNotificationPreference`
  Prisma model, not a widened `NotificationPreference` — mirrors this
  exact codebase's own established precedent for the identical situation
  (`ContactRefreshToken` is a separate table from `RefreshToken`, not a
  widened shared one, specifically "so the `customers` schema keeps owning
  everything about a Contact's lifecycle, and so the already-battle-tested
  `RefreshToken`/`User` relationship is never touched" — that table's own
  doc comment). `NotificationPreference` (Story 58) is untouched by this
  story: zero regression risk to its own already-shipped, already-tested
  behavior.
- **Product value**: lets a customer mute the live in-app toast for either
  of the two events the Customer Portal notifies them about
  (`ticket.updated`, agent-reply `channel.message.created`), for
  themselves — the portal-side counterpart of a real, already-shipped
  agent-side capability (Story 58), closing the Notifications domain's
  "per-user preferences" line from `docs/architecture/03-domain-boundaries.md`
  for the Customer Portal audience too.
- **Risk reduction**: none specific; purely additive (new table, new
  routes, one new provider/export, one extended component) — no existing
  route, table, or component behavior changes for a caller who never
  touches the new endpoints.
- **Smallness**: mirrors an already-proven, already-tested pattern
  (Story 58) nearly file-for-file, adapted from `User`/`userId` to
  `Contact`/`contactId` and from three agent-facing event types to the two
  portal-facing ones — the smallest concretely-scoped Notifications-domain
  gap identified across the whole-repository Recon.
