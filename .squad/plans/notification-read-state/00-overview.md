# notification-read-state — plan overview

Entry point for the **notification-read-state** feature. Stories execute in
order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 92  | [92-story-notification-read-state.md](./92-story-notification-read-state.md) | Notification Read-State (Unread Count + Mark as Read) | — | `in-app-notification-delivery` Story 22/36 (`NotificationLog`, `NotificationsService.listNotifications`), `customer-portal-notification-history` Story 88 (`NotificationLog.customerId`, `PortalNotificationsController`/`listNotificationsForCustomer`), `notification-preferences` Story 58 and `customer-portal-notification-preferences` Story 90 (the exact "self-scoped by the caller's own id, no `TenantContext`/no permission for the portal side" controller shape this story's mark-as-read routes mirror) |

## Dependency notes

- Selected via a dedicated Story 92 Recon performed after Story 91
  (`CLAUDE.md` §2/§8; see that Recon's report for the full candidate
  survey). Notification Read-State was named as a real, undone gap in four
  consecutive prior plan docs (Stories 88, 89, 90, 91) and declined each
  time only because a more directly dependency-correct catch-up candidate
  existed that round. All of those catch-up candidates are now shipped, and
  the fresh, whole-repository Recon performed for Story 92 found no new
  candidate that outranks it — every alternative surfaced (Channels
  configuration/threads, Email/WhatsApp/SMS, Integrations/ERP, KB
  pgvector/semantic search, saved dashboards, SSO) is either externally
  blocked (`CLAUDE.md` §2's provider-decision rule) or too speculative to
  scope (no concrete, disclosed requirement exists anywhere in the
  repository).
- **Critical architectural correction made during Recon**: `NotificationLog`
  rows are **not per-recipient** — agent-facing rows are shared by every
  agent in a branch (scoped by `ticket.branchId`), and portal rows are
  shared by every `Contact` of a customer (scoped by `customerId`). A naive
  `NotificationLog.isRead`/`readAt` column, as an earlier checkpoint's
  framing implied, would let one recipient's read action silently mark a
  notification read for every other recipient sharing that branch/customer
  scope. This story instead adds a **per-recipient "read up to" cursor** —
  `User.notificationsReadAt` (agent) / `Contact.notificationsReadAt`
  (portal) — computing "unread" as `NotificationLog.loggedAt > cursor`,
  exactly the architecture recommended by the Story 92 Recon.
- **Why this, over other candidates** (full detail in the Story 92 Recon
  report): every provider-blocked or speculative candidate is unchanged
  since Stories 88–91's own rejections; no new prerequisite was satisfied
  for any of them this round. Notification Read-State is the only
  candidate that is simultaneously concrete, fully unblocked, and
  previously pre-validated as a real, disclosed gap.
- **Dependency correctness**: builds only on infrastructure already fully
  in place and untouched by this story — `NotificationLog` (Stories 22/88,
  schema unchanged except the new recipient-side columns),
  `NotificationsService`/`NotificationsController` (Story 36, extended with
  new methods/routes, existing ones untouched), `PortalNotificationsController`
  (Story 88, untouched), and the self-scoped-PATCH controller shape Stories
  58/90 already established.
- **Architectural coherence**: the read cursor lives on the existing
  recipient identity model (`User`/`Contact`) as a plain nullable column —
  mirroring this codebase's own precedent for adding a single scalar flag
  directly to an existing core model via migration (`Role.isActive`,
  `Branch.isActive`/`Department.isActive`), rather than a table (which this
  codebase reserves for genuinely multi-row per-recipient state, e.g.
  `NotificationPreference`'s one-row-per-event-type shape — a single
  cursor has no such multiplicity).
- **Product value**: gives an agent and a portal customer a real, working
  "what's new since I last looked" signal, closing the exact gap the
  existing on-demand history views (Stories 39/89) have had since they
  shipped.
- **Risk reduction**: none specific; additive columns and additive routes
  only — no existing route, table, or component behavior changes for a
  caller who never calls the new endpoints.
- **Smallness**: two nullable columns, four new routes (two per surface),
  two small self-scoped service methods, and a minimal badge/count added to
  two already-existing views — no new table, no new module.
- **Non-goals carried forward deliberately**: no per-notification
  read/unread join table, no `NotificationLog.isRead`, no realtime
  unread-count push over Socket.IO, no changes to the transient toaster
  (`BranchNotifications`/portal `NotificationToaster`), no notification
  templates/preferences changes, no pagination of the underlying list
  endpoints (a real, separate, smaller-priority gap — see the Story 92
  Recon's candidate table).
