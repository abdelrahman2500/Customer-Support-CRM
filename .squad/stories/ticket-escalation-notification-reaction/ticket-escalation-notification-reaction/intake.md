# Story intake

- Folder: `.squad/stories/ticket-escalation-notification-reaction/ticket-escalation-notification-reaction/intake.md`

## Feature

- **Feature name (display):** Ticket Escalation Notification Reaction
- **Feature slug (folder under `plans/`):** `ticket-escalation-notification-reaction`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

## Title

```text
Ticket Escalation Notification Reaction
```

## Description

```text
Establish the next consumer in the existing ticket escalation event chain by making the Notifications domain react to `ticket.escalated`.

Story 17 established the flow:

ticket escalation caused by SLA breach
→ `sla.escalated`
→ `TicketEscalationListener`
→ `ticket.escalated`

Story 19 gives that final event a real consumer. The Notifications domain should record that a ticket escalation occurred using the existing `NotificationLog` established by Story 18.

This is a record-only notification reaction, not notification delivery.

The listener must subscribe to the existing `TICKET_ESCALATED_EVENT` emitted by the Ticketing domain and persist an appropriate `NotificationLog` entry. The design must reuse the existing Notifications infrastructure where semantically appropriate rather than introducing another notification table solely for this event.

The idempotency identity must be derived from the actual `TicketEscalatedEvent` payload and the semantics of one ticket-escalation transition. Do not blindly reuse the SLA-specific `(eventType, ticketId, targetType, targetAt)` identity from Story 18 if those SLA fields are not part of the ticket escalation event.

The reaction must be idempotent: repeated delivery of the same logical `ticket.escalated` event must not create duplicate notification-log records.

The Notifications domain must remain independent of the Ticketing implementation. Communication must happen through the existing domain event contract; the Notifications module must not import `TicketsModule` or access Ticketing-owned Prisma data directly.

This story completes the currently observed event chain:

`sla.breached`
→ `SlaEscalationListener`
→ `sla.escalated`
→ `TicketEscalationListener`
→ `ticket.escalated`
→ `Notifications`

The story deliberately stops at durable recording. Recipient resolution, preferences, templates, channel selection, delivery, provider integrations, retries, and background notification jobs remain future work.
```

## Acceptance criteria

```text
- [ ] `NotificationsModule` consumes the existing `TICKET_ESCALATED_EVENT`.

- [ ] A `ticket.escalated` event results in exactly one durable notification-log record for the corresponding logical escalation transition.

- [ ] Duplicate delivery of the same logical `ticket.escalated` event does not create a second notification-log record.

- [ ] The idempotency key is derived from the actual `TicketEscalatedEvent` payload and is documented in the implementation/plan.

- [ ] The implementation reuses the existing `NotificationLog` model when that model can represent the event correctly; no separate notification table is introduced without a demonstrated domain requirement.

- [ ] The resulting notification-log record identifies the event as `ticket.escalated` and preserves the event information required by the Notifications domain.

- [ ] The listener does not mutate `Ticket`, `SlaTicketTarget`, `SlaPolicy`, or any other Ticketing/SLA-owned state.

- [ ] The listener does not emit another domain event.

- [ ] No new HTTP endpoint or permission is introduced.

- [ ] No recipient resolution, notification preferences, template rendering, localization, channel selection, email/SMS/push delivery, or provider integration is introduced.

- [ ] No new BullMQ queue or worker behavior is introduced.

- [ ] `NotificationsModule` does not import `TicketsModule` or `SlaPoliciesModule`; communication remains event-based.

- [ ] Existing `ticket.escalated` emission behavior from Story 17 remains unchanged.

- [ ] Story 18's `sla.at_risk` notification reaction remains unchanged.

- [ ] Unit tests cover successful persistence, duplicate/idempotent delivery, failure handling, and correct event subscription.

- [ ] An integration/e2e test proves that emitting `ticket.escalated` against real infrastructure creates the expected notification-log record and suppresses duplicate delivery.

- [ ] Existing API tests and relevant regression suites continue to pass.

- [ ] Protected areas remain untouched: `apps/worker/**`, `apps/api/src/queues/**`, `business-hours-calculator.ts`, and Story 17's escalation listeners.
```

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| None                           |            |

## Dependencies

- **Blocked by / related ids:** None
- **Depends on code areas or other stories:**

  - Story 17 — `sla-breach-escalation`
  - Story 18 — `sla-at-risk-notification-reaction`
  - `apps/api/src/modules/tickets/tickets.events.ts`
  - `apps/api/src/modules/tickets/ticket-escalation.listener.ts`
  - `apps/api/src/modules/notifications/`
  - `apps/api/prisma/schema.prisma`

## Extra notes

- `ticket.escalated` is currently emitted but has no consumer anywhere in `apps/api/src`.
- Story 18 established `NotificationLog` as the first durable reaction inside the Notifications domain.
- This story should be kept intentionally narrow and should not turn into the full NotificationService/delivery implementation described by the architecture.
- The planner must inspect the actual `TicketEscalatedEvent` payload before finalizing the persistence and idempotency design.
- Do not assume SLA-specific fields such as `targetType` or `targetAt` exist on the ticket escalation event.
- Preserve the existing domain ownership boundaries.

## Technical hints

- Repositories/roots: `.`
- Primary language: `typescript`
- Existing event: `TICKET_ESCALATED_EVENT`
- Existing event producer: `apps/api/src/modules/tickets/ticket-escalation.listener.ts`
- Existing notification consumer precedent: `apps/api/src/modules/notifications/sla-at-risk-notification.listener.ts`
- Existing persistence model: `NotificationLog`
- Existing Notifications module: `apps/api/src/modules/notifications/notifications.module.ts`
- Existing Prisma schema: `apps/api/prisma/schema.prisma`
- Existing event transport: `EventEmitter2`

## Out of scope

- Full notification delivery system
- Recipient resolution
- Agent/user notification preferences
- Notification templates
- Locale-aware rendering
- Email delivery
- SMS delivery
- Push delivery
- In-app delivery
- External notification providers
- Notification channel adapters
- Notification delivery retries
- Delivery-status workflow
- Notification BullMQ queue
- `apps/worker/**` changes
- `AutomationRule`
- Generic trigger/condition/action engine
- New HTTP endpoints
- New permissions
- Frontend changes
- Changes to `Ticket` state
- Changes to SLA state
- Changes to `SlaTicketTarget`
- Changes to `SlaPolicy`
- Changes to Story 17 escalation listeners
- Changes to Story 18's `sla.at_risk` reaction
