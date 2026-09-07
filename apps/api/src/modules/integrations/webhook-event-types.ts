/**
 * RM-20 — the curated set of domain events a webhook subscription may
 * subscribe to (`WebhookSubscription.subscribedEventTypes`). Deliberately a
 * subset of every event this codebase's `@nestjs/event-emitter` bus
 * actually emits (`ticket.note-added`/`ticket.mentioned`/`ai.*`/
 * `task.reminder_due`/`agent.presence.changed`/`automation.rule_matched`
 * are excluded): this v1 covers the events an external system is most
 * plausibly integrating against — ticket lifecycle, SLA breach signals, and
 * inbound/outbound conversation activity — not every internal signal this
 * application raises. Extending the set later (subscribing
 * `WebhookDispatchListener` to one more `@OnEvent` and adding one more
 * entry here) is additive and does not change this shape.
 *
 * Values are the literal event-name strings already defined in
 * `tickets.events.ts`/`sla-detection.events.ts`/`channel-messages.events.ts`
 * — not re-exported from there, mirroring `PORTAL_NOTIFICATION_EVENT_TYPES`'
 * own "a small, independent literal list, not an import of every producing
 * module's own event constant" precedent (this module gains no runtime
 * dependency on Ticketing/SLA/Channels beyond the already-global event bus
 * and `PrismaService`).
 */
export const WEBHOOK_EVENT_TYPES = [
  "ticket.created",
  "ticket.updated",
  "ticket.escalated",
  "sla.at_risk",
  "sla.breached",
  "channel.message.created",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
