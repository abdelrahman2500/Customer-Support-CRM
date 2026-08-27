# in-app-notification-delivery — plan overview

Entry point for the **in-app-notification-delivery** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 22  | [22-story-in-app-notification-delivery.md](./22-story-in-app-notification-delivery.md) | In-App Notification Delivery | — | `realtime-socketio-foundation` Story 20, `sla-breach-escalation` Story 17, `sla-at-risk-notification-reaction` Story 18, `ticket-escalation-notification-reaction` Story 19 |

## Dependency notes

- New feature slug, but extends the existing `apps/api/src/realtime/` cross-cutting infrastructure Story 20 established — not a new module, room type, or transport.
- Consumes `SLA_AT_RISK_EVENT`/`SLA_BREACHED_EVENT` (Story 15) and `TICKET_ESCALATED_EVENT` (Story 17) exactly as already emitted — no existing emitter, listener, or event payload is modified.
- Reuses Story 20's `branch:{id}:notifications` room and its existing, unmodified authorization rule (`RealtimeGateway.authorizeRoom`) — this story adds a publisher into that room, not a new room type or a new authorization rule.
- Does not modify `NotificationLog`, `SlaAtRiskNotificationListener`, `TicketEscalatedNotificationListener`, `TicketRealtimeListener`, `apps/worker/**`, or any existing BullMQ queue.
- No Prisma schema/migration change — this story only broadcasts already-existing event payloads over the already-existing Socket.IO transport; it persists nothing new.
- Explicitly the approved first iteration: branch-wide, non-targeted broadcast — no recipient resolution, no preferences, no templates. Per-recipient targeting is deferred to a later story (see this story's own "Out of scope").
