import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";

/**
 * Must stay identical to `AGENT_NOTIFICATION_EMAIL_QUEUE` in
 * apps/worker/src/queues/agent-notification-email.processor.ts — no
 * cross-app shared-constants mechanism exists in this repository (Story
 * 14's own precedent for `HEALTH_CHECK_QUEUE`, reused unchanged by RM-19's
 * `PORTAL_NOTIFICATION_EMAIL_QUEUE`), so this is a deliberately duplicated
 * literal, not an import.
 */
export const AGENT_NOTIFICATION_EMAIL_QUEUE = "agent-notification-email";

/**
 * RM-26 — Agent Email Notification Delivery. The three existing
 * `NotificationLog`-persisting listeners that resolve to exactly one
 * recipient agent: `SlaAtRiskNotificationListener`/
 * `TicketEscalatedNotificationListener` (the ticket's current
 * `assignedToUserId`) and `TicketMentionNotificationListener` (the
 * mentioned agent). `sla.breached` has no such listener of its own (its
 * only reaction persists `SlaEscalation` and re-emits `sla.escalated`,
 * which becomes `ticket.escalated` — already covered) — deliberately not
 * given its own agent-notification-email path here.
 */
export type AgentNotificationEmailEventType = "sla.at_risk" | "ticket.escalated" | "ticket.mentioned";

/** Deliberately minimal, mirroring `PortalNotificationEmailJobPayload`'s own
 * "own Prisma access, never trust stale payload data" convention (RM-15/19)
 * — the worker-side processor re-resolves the recipient's email and the
 * ticket's subject fresh via `recipientUserId`/`ticketId` at send time.
 * `recipientUserId` itself is NOT re-derived by the worker (unlike the
 * portal processor's `contactId`, which it re-reads off the ticket): for
 * `ticket.mentioned` there is no ticket column to re-derive "who was
 * mentioned" from, so the caller (already required to resolve this same id
 * to check the recipient's `NotificationPreference`) passes it through. */
export interface AgentNotificationEmailJobPayload {
  ticketId: string;
  eventType: AgentNotificationEmailEventType;
  recipientUserId: string;
}

/**
 * RM-26 — the API-side producer for `agent-notification-email`. No
 * `attempts`/`backoff` override, mirroring `PortalNotificationEmailProducer`'s
 * own bare-default choice for the identical reason: a notification email is
 * best-effort supplementary delivery of a notification that already exists
 * in-app, not a conversational message an agent is depending on receiving.
 */
@Injectable()
export class AgentNotificationEmailProducer {
  constructor(
    @InjectQueue(AGENT_NOTIFICATION_EMAIL_QUEUE)
    private readonly queue: Queue<AgentNotificationEmailJobPayload>,
  ) {}

  async enqueue(
    payload: AgentNotificationEmailJobPayload,
  ): Promise<Job<AgentNotificationEmailJobPayload>> {
    return this.queue.add("send", payload);
  }
}
