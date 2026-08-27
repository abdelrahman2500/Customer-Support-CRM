# ticket-escalation-notification-reaction — plan overview

Entry point for the **ticket-escalation-notification-reaction** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 19  | [19-story-ticket-escalation-notification-reaction.md](./19-story-ticket-escalation-notification-reaction.md) | Ticket Escalation Notification Reaction | — | `sla-breach-escalation` Story 17, `sla-at-risk-notification-reaction` Story 18 |

## Dependency notes

- New feature slug, but extends the existing `Notifications` domain (`apps/api/src/modules/notifications/`, `notifications` schema) Story 18 established — this is that domain's second reaction, not a new module or schema.
- Consumes `ticket.escalated` (Story 17, `apps/api/src/modules/tickets/tickets.events.ts`), the last remaining emitted-with-zero-consumers domain event in the codebase, without modifying `TicketEscalationListener` or any Story 17 code.
- `TicketEscalatedEvent`'s payload (`{ ticket: TicketSummary; actorUserId: string | null }`) carries no SLA-shaped fields (`branchId`/`targetType`/`targetAt`) — this story's idempotency design and `NotificationLog` schema extension both follow directly from that fact, not from reusing Story 18's SLA-specific identity unchanged.
- Reuses `NotificationLog` (Story 18) rather than introducing a second notification table — extends it additively (nullable columns, a second unique constraint) without altering Story 18's own existing constraint, data shape, or behavior.
- Does not modify `apps/worker/**`, `apps/api/src/queues/**`, `business-hours-calculator.ts`, or any Story 17/18 listener code.
