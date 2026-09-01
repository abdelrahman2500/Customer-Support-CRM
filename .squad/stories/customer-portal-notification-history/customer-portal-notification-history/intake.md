> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/customer-portal-notification-history/customer-portal-notification-history/intake.md`

---

## Feature

- **Feature name (display):** Notifications / Customer Portal
- **Feature slug (folder under `plans/`):** `customer-portal-notification-history`

## Title

```text
Story 88 — Customer Portal: Notification History
```

## Description

```text
Story 86 gave the Customer Portal live in-app notification delivery
(a toast for ticket.updated and agent-reply channel.message.created,
relayed into a customer:{customerId}:notifications Socket.IO room) but
explicitly deferred persistence: a customer who was not looking at the
portal at the moment a notification fired has no way to ever learn what
they missed. This mirrors a gap the agent side already closed once
before: Stories 20/22 shipped live-only delivery, and Story 36 later
added a persisted NotificationLog read endpoint (GET /notifications).
This story is that same second increment, for the portal: a new
PortalNotificationLogListener persists the identical two events Story 86
already relays live (under the identical senderUserId filter for
channel.message.created) into NotificationLog, scoped by a new nullable
customerId column, and a new GET /portal/notifications endpoint exposes
a customer's own history, newest first.
```

## Acceptance criteria

```text
- [ ] NotificationLog gains a nullable customerId column (additive
      migration) with a Customer relation; existing writers
      (SlaAtRiskNotificationListener, TicketEscalatedNotificationListener)
      are unchanged and continue to leave it null.
- [ ] A new PortalNotificationLogListener persists a NotificationLog row
      for every ticket.updated (dedupeKey: `${ticketId}:${updatedAt}`)
      and for every channel.message.created whose senderUserId is set
      (dedupeKey: message.id), scoped to the ticket's customerId;
      catch-and-log, never rethrows, idempotent on retry.
- [ ] NotificationsService.listNotifications() (agent-facing,
      GET /notifications) adds `customerId: null` to its where clause so
      its result set is unchanged by this story.
- [ ] A new NotificationsService.listNotificationsForCustomer(customerId)
      returns that customer's own NotificationLog rows, newest first,
      reusing the existing NotificationSummary shape.
- [ ] NotificationsModule exports NotificationsService; PortalModule
      imports NotificationsModule.
- [ ] A new GET /portal/notifications endpoint (@PortalRoute()) resolves
      the caller's customerId via PortalService.getAuthenticatedContact
      and returns listNotificationsForCustomer's result.
- [ ] New unit tests cover the new listener (both handlers, the
      senderUserId filter, idempotency, error swallowing) and the two
      NotificationsService changes (including a regression assertion that
      listNotifications() excludes customerId-scoped rows).
- [ ] New e2e coverage (apps/api/test/portal-notifications.e2e-spec.ts):
      a full create-ticket/agent-update/agent-reply flow followed by
      GET /portal/notifications returning both rows, and an assertion
      that GET /notifications for the same branch/ticket does NOT include
      either new row; unauthenticated and wrong-audience requests
      rejected with 401.
- [ ] Typecheck, lint, build, and apps/api's unit + this story's e2e
      coverage pass.
```

## Dependencies

- Story 18/19 — `sla-at-risk-notification-reaction` /
  `ticket-escalation-notification-reaction` (`NotificationLog`, the
  `dedupeKey`-based idempotent-listener pattern).
- Story 36 — `notifications-read-endpoint` (`NotificationsService`,
  `NotificationsController`, `NotificationSummary`).
- Story 52/53 — `customer-portal-authentication-foundation` /
  `customer-portal-ticket-submission-tracking` (`PortalService.
  getAuthenticatedContact`, `@PortalRoute()`).
- Story 86 — `customer-portal-notification-delivery`
  (`CustomerNotificationRealtimeListener`, the exact event pair and
  `senderUserId` filter this story persists a durable copy of).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Any per-event notification-preference toggle for the portal.
- Notification templates.
- "Mark as read"/unread-count state on `NotificationLog`.
- Any `apps/portal` frontend surface consuming the new endpoint (backend-
  only, mirrors Story 36's own precedent).
- `EMAIL`/`WHATSAPP`/`SMS` delivery — still blocked on an unresolved
  external-provider decision.
- Any change to what Story 86 already relays live over Socket.IO.
