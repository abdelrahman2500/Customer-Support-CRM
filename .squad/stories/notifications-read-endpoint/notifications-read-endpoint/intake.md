> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/notifications-read-endpoint/notifications-read-endpoint/intake.md`

---

## Feature

- **Feature name (display):** Backend Foundation — Notification Read Endpoint
- **Feature slug:** `notifications-read-endpoint`

## Title

```text
Backend Foundation: Notification Read Endpoint
```

## Description

```text
NotificationLog has been written by two listeners (Stories 18/19) since it was introduced, but NotificationsModule has explicitly had "no controller yet" — the model has no HTTP surface at all. This blocks a future Notification History UI.

This story adds GET /notifications, read-only, scoped through the notification's own `ticket` relation (ticket.branchId) rather than NotificationLog.branchId directly — that column is nullable and is always null for ticket.escalated rows (confirmed in TicketEscalatedNotificationListener's own doc comment); scoping through the relation is the only way to include every notification row for the caller's branch without silently dropping every escalation notification. A new "notification:read" permission is added to the existing catalog.
```

## Acceptance criteria

```text
- GET /notifications returns every NotificationLog row whose ticket belongs to the caller's branch, ordered newest-first, requiring the new "notification:read" permission.
- A ticket.escalated row (branchId column null) is correctly included and its returned branchId resolves via the ticket relation, not left null.
- Unauthenticated → 401; Agent-role (no permission) → 403.
- No new Prisma model, migration, notification-delivery mechanism, or mutation endpoint. No frontend UI.
- apps/web, apps/portal, schema.prisma/migrations, and every unrelated backend module are untouched.
- Unit tests (notifications.service.spec.ts) and a new e2e spec cover empty/populated/scoping/permission cases, including a real sla.at_risk and a real ticket.escalated notification produced via the real EventEmitter2 (the same deterministic technique sla-at-risk-notification.e2e-spec.ts already established).
```

## Dependencies

- **Blocked by:** `sla-at-risk-notification-reaction` Story 18, `ticket-escalation-notification-reaction` Story 19 (`NotificationLog` model, both listeners).
- **Depends on code areas:** `apps/api/src/modules/notifications/**` (new controller/service, module updated), `apps/api/prisma/seed.ts` (new permission key only).

## Extra notes

- Part of the approved 35/36/37 backend-foundation batch — owns the `notifications` module exclusively; zero file overlap with Stories 35/37.
- The ticket-relation scoping choice is a mechanical correctness fix applying this codebase's own existing tenant-scoping rule to a schema quirk it already documented — not a new business rule or product decision.

## Out of scope

- Pagination/filtering (no existing list endpoint in this codebase has any), notification delivery, a frontend Notification Center (future, separate story).
