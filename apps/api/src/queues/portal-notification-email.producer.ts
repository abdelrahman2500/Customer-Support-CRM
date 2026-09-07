import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";

/**
 * Must stay identical to `PORTAL_NOTIFICATION_EMAIL_QUEUE` in
 * apps/worker/src/queues/portal-notification-email.processor.ts — no
 * cross-app shared-constants mechanism exists in this repository (Story
 * 14's own precedent for `HEALTH_CHECK_QUEUE`), so this is a deliberately
 * duplicated literal, not an import.
 */
export const PORTAL_NOTIFICATION_EMAIL_QUEUE = "portal-notification-email";

/** The two portal event types `PortalNotificationLogListener` already
 * persists — `PORTAL_NOTIFICATION_EVENT_TYPES`
 * (`portal-notification-preferences.service.ts`) is this same pair. */
export type PortalNotificationEmailEventType = "ticket.updated" | "channel.message.created";

/** Deliberately minimal — the worker-side processor re-resolves the
 * recipient/subject/locale fresh from `ticketId` via its own
 * `PrismaService`, mirroring `EmailAdapter.send()`'s own "own Prisma
 * access, never trust stale payload data" convention (RM-15). */
export interface PortalNotificationEmailJobPayload {
  ticketId: string;
  eventType: PortalNotificationEmailEventType;
}

/**
 * RM-19 — the API-side producer for `portal-notification-email`. No
 * `attempts`/`backoff` override (the bare BullMQ default of 1 attempt,
 * same as `sla-timers`/`ai-processing`/`task-reminders`) — deliberately
 * *not* `channel-message-delivery`'s own `attempts: 3` retry policy: a
 * notification email is best-effort supplementary delivery of a
 * notification that already exists in-app/in-portal, not a conversational
 * message a customer is depending on receiving — see
 * `PortalNotificationEmailProcessor`'s own doc comment for the full
 * reasoning. `PortalNotificationLogListener` is this queue's only
 * producer, and only calls `enqueue` once it has already confirmed (via
 * `PortalNotificationPreferencesService`) that the recipient contact has
 * this event type enabled.
 */
@Injectable()
export class PortalNotificationEmailProducer {
  constructor(
    @InjectQueue(PORTAL_NOTIFICATION_EMAIL_QUEUE)
    private readonly queue: Queue<PortalNotificationEmailJobPayload>,
  ) {}

  async enqueue(
    payload: PortalNotificationEmailJobPayload,
  ): Promise<Job<PortalNotificationEmailJobPayload>> {
    return this.queue.add("send", payload);
  }
}
