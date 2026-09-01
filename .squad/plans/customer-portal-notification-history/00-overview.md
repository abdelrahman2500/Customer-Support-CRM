# customer-portal-notification-history — plan overview

Entry point for the **customer-portal-notification-history** feature.
Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 88  | [88-story-customer-portal-notification-history.md](./88-story-customer-portal-notification-history.md) | Customer Portal — Notification History | — | `customer-portal-notification-delivery` Story 86 (`CustomerNotificationRealtimeListener`, `customer:{customerId}:notifications` room), `notifications-read-endpoint` Story 36 (`NotificationsService`/`NotificationLog`/`NotificationsController` pattern), `identity-audit-logging` / `ticket-escalation-notification-reaction` Story 19 (`NotificationLog`'s `dedupeKey`/catch-and-log listener precedent) |

## Dependency notes

- Selected via a fresh, whole-repository Recon after Story 87
  (`CLAUDE.md` §2/§8). Re-confirms the Recon lead flagged at the end of
  Story 86's own plan doc: that story's "Non-goals carried forward
  deliberately" section explicitly named **"no `NotificationLog`
  persistence for portal events, no notification history/read
  endpoint"** as deferred, not solved, and pointed at the exact
  precedent this story now follows — the agent side went live-delivery-
  only first (Stories 20/22/24) and only later got a persisted-history
  read endpoint (Story 36), a per-event preference toggle (Story 58),
  and templates (Story 61), each its own separate, later story. Story 88
  is that same second increment, for the portal, and nothing more.
- **Why this, not Reporting's "saved dashboards"**: `docs/architecture/
  03-domain-boundaries.md`'s Reporting row is fully served today by five
  fixed, read-only `GET /reports/*` endpoints (Stories 56/59/60) with a
  matching read-only `apps/web` view (`reports-view.tsx`) — there is no
  existing per-user dashboard-configuration concept anywhere in the
  repository to "save" (no widget model, no layout persistence, no saved-
  view selector), so building "saved dashboards" now would mean inventing
  a new customization data model from nothing rather than completing an
  already-started, already-scoped increment. Portal notification history,
  by contrast, is a named, disclosed gap with a proven three-times-over
  implementation pattern (Stories 36/58/61) sitting one small step away.
  Per `CLAUDE.md` §2's priority order, a concrete, already-scoped gap with
  a proven pattern (architectural coherence, dependency correctness) beats
  a comparably-sized but structurally novel feature with no disclosed
  need behind it yet.
- **Why not Communication/Channels' `EMAIL`/`WHATSAPP`/`SMS` or the
  Integrations domain**: unchanged since Stories 86/87's own notes —
  `docs/architecture/12-risks-tradeoffs-and-scope.md`'s trade-off table
  still records no concrete provider decision for any of those channels
  ("Revisit when: Not expected to be revisited" for the general buy-
  channels policy), and `docs/architecture/09-integrations.md` still
  describes the ERP adapter's protocol as "open until a future story
  names them." Both remain ineligible for selection under `CLAUDE.md` §2.
- **Dependency correctness**: builds only on infrastructure already fully
  in place and untouched by this story — `NotificationLog` (Story 18/19),
  `NotificationsService`/`NotificationsController` (Story 36),
  `CustomerNotificationRealtimeListener`'s already-established
  `customerId` recipient-resolution boundary (Story 86), and
  `PortalService.getAuthenticatedContact` (Story 52/53). Nothing new is
  invented structurally.
- **Architectural coherence**: stays inside the `Notifications` domain's
  existing `notifications` schema and its established "listener records a
  `NotificationLog` row; a separate read-only controller/service exposes
  it" split (Story 18/19 vs. Story 36) — this story is a second listener
  and a second, differently-scoped read method on the same model, not a
  new module or a new pattern. `PortalModule` gains one more imported
  module and one more thin controller injecting an already-exported
  service directly, exactly like `PortalKnowledgeBaseController`/
  `PortalChatController`/`PortalBrandingController` already do.
- **Product value**: closes the Notifications domain's remaining
  Customer-Portal gap named in `docs/architecture/03-domain-boundaries.md`
  ("Notifications... Owns... delivery logs") — today a portal customer who
  was not looking at the portal at the exact moment a live toast fired
  (Story 86) has no way to ever learn what they missed. This is the same
  real functional gap Story 36 closed on the agent side.
- **Risk reduction**: none specific; this is a small, additive, read-only
  extension with no behavior change to any existing endpoint other than
  one new `where` clause on the already-existing agent-facing
  `GET /notifications` (added to keep its result set unchanged — see the
  story's own Design decisions and its regression test).
- **Non-goals carried forward deliberately** (same "first increment"
  scoping Story 36 itself used): no per-event preference toggle for the
  portal (mirrors Story 58, a later, separate story on the agent side), no
  notification templates, no "mark as read" state (`NotificationLog` has
  no such column anywhere in this codebase today — inventing one is out of
  scope), no `apps/portal` frontend surface consuming the new endpoint
  (mirrors Story 36's own "backend endpoint now, frontend later" precedent
  — Story 39 added the agent-side frontend in a separate, later story), and
  no email/SMS/WhatsApp delivery.
