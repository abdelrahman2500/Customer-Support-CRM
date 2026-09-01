# customer-portal-notification-history-frontend — plan overview

Entry point for the **customer-portal-notification-history-frontend**
feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 89  | [89-story-customer-portal-notification-history-frontend.md](./89-story-customer-portal-notification-history-frontend.md) | Customer Portal — Notification History (Frontend) | — | `customer-portal-notification-history` Story 88 (`GET /portal/notifications`, `NotificationSummary`), `customer-portal-ticket-submission-tracking` Story 53 (`useMyTicketsQuery`, `TicketListView`'s plain-Tailwind list convention), `customer-portal-notification-delivery` Story 86 (`notifications` i18n namespace, `PortalHeader` nav-link convention) |

## Dependency notes

- Selected via a fresh, whole-repository Recon after Story 88
  (`CLAUDE.md` §2/§8). Directly closes the exact gap Story 88's own plan
  doc named as deferred, not solved: its "Non-goals carried forward
  deliberately" section explicitly listed **"no `apps/portal` frontend
  surface consuming the new endpoint... mirrors Story 36's own 'backend
  endpoint now, frontend later' precedent — Story 39 added the agent-side
  frontend in a separate, later story."** Story 89 is that same second
  increment for the portal: `GET /portal/notifications` has existed since
  Story 88 with zero frontend consumer, exactly the position
  `GET /notifications` was in between Stories 36 and 39.
- **Why this, over other candidates surfaced during Recon:**
  - *Communication/Channels* (`EMAIL`/`WHATSAPP`/`SMS`) and *Integrations*
    (ERP/external adapters) remain ineligible per `CLAUDE.md` §2 — no
    concrete provider decision exists anywhere in the repository
    (`docs/architecture/12-risks-tradeoffs-and-scope.md` still records
    "Revisit when: Not expected to be revisited" for the buy-channels
    policy; `docs/architecture/09-integrations.md` still describes the ERP
    adapter's protocol as open until a future story names it). Unchanged
    since Stories 86/87/88's own Recon notes.
  - *Portal notification preferences* (mirroring agent-side Story 58) and
    *notification templates for the portal* (mirroring Story 61) are both
    real, disclosed non-goals of Story 88, but both are strictly smaller
    in product value than simply making the already-built, already-tested
    backend endpoint reachable at all — today `GET /portal/notifications`
    has no consumer anywhere in this repository, so no portal customer can
    exercise it. Shipping a UI for an unreachable endpoint's preferences
    before the endpoint itself has any UI would invert the natural
    dependency order.
  - *Reporting's "saved dashboards"* — unchanged from Story 88's own
    rejection of this candidate: no existing per-user
    dashboard-configuration data model exists anywhere in the repository to
    extend; building one now would mean inventing a new customization
    concept from nothing rather than completing an already-scoped,
    one-step-away increment.
- **Dependency correctness**: consumes only infrastructure already fully
  in place and untouched by this story — `GET /portal/notifications`
  (Story 88, unmodified), `PortalService`'s existing auth/session plumbing
  (Story 52), `apiFetch`'s existing token-refresh-on-401 client (Story 52),
  and `PortalHeader`/`(customer)/layout.tsx`'s existing nav/layout shell
  (Stories 52-86). Nothing on the backend changes.
- **Architectural coherence**: stays inside the Customer Portal's existing
  "presentation/access boundary, not a data owner" role
  (`docs/architecture/03-domain-boundaries.md`) — a new read-only page,
  API client file, and query hook, following the exact
  `tickets-api.ts`/`use-portal-tickets.ts`/`TicketListView` three-file
  split Story 53 already established, and the exact
  `notifications-api.ts`/`use-notifications.ts`/`NotificationHistoryView`
  split `apps/web` already used for the equivalent agent-side Story 39.
- **Product value**: closes the Customer Portal's last remaining
  Notifications-domain gap — a customer can now actually retrieve what
  they missed, not merely have a backend endpoint theoretically capable of
  telling them.
- **Risk reduction**: none specific; purely additive frontend surface, zero
  behavior change to any existing route, page, or component.
- **Smallness**: the natural tiebreaker here — this is the smallest
  concretely-scoped gap identified across the whole-repository Recon (three
  small new files plus one nav link and a handful of i18n keys, mirroring
  an already-proven pattern twice over — Story 39 on the agent side, and
  this exact backend endpoint's own Story 88).
- **Non-goals carried forward deliberately**: no portal notification
  preferences UI, no notification-templates UI, no "mark as read" state (no
  such column exists on `NotificationLog`), no polling/realtime merge with
  the existing live toaster (the history view is a plain, on-demand
  `GET`-backed list — Story 86's toaster is untouched), no changes to the
  agent-facing `apps/web` notification history view.
