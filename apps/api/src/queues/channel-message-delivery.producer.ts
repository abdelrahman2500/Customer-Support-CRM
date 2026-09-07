import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { ChannelType } from "@prisma/client";
import type { Job, Queue } from "bullmq";

/**
 * Must stay identical to `CHANNEL_MESSAGE_DELIVERY_QUEUE` in
 * apps/worker/src/queues/channel-message-delivery.processor.ts — no
 * cross-app shared-constants mechanism exists in this repository (Story
 * 14's own precedent for `HEALTH_CHECK_QUEUE`), so this is a deliberately
 * duplicated literal, not an import.
 */
export const CHANNEL_MESSAGE_DELIVERY_QUEUE = "channel-message-delivery";

/** The already-persisted `ChannelMessage` row's own fields a future
 * adapter needs to actually perform the send — `channelType` picks the
 * transport, `body` is what gets sent. */
export interface ChannelMessageDeliveryJobPayload {
  channelMessageId: string;
  ticketId: string;
  channelType: ChannelType;
  body: string;
}

/**
 * RM-13 — the API-side producer for `channel-message-delivery`
 * (`docs/architecture/09-integrations.md`'s described outbound
 * Email/SMS/WhatsApp work, not yet built — this queue is the seam Phase
 * 5's first real adapter enqueues onto). Mirrors `AiProcessingProducer`'s
 * exact one-queue/one-job-shape/one-method shape.
 *
 * `attempts`/`backoff` here are this repository's first configured BullMQ
 * retry policy — every existing queue (`sla-timers`, `ai-processing`,
 * `task-reminders`) uses bare BullMQ defaults (1 attempt, no retry),
 * because none of them represents a call to a flaky external transport.
 * An outbound send genuinely can transiently fail (a provider's rate
 * limit, a dropped connection), which is exactly what `retryCount` on
 * `ChannelMessage` exists to record — 3 attempts with an exponential
 * backoff starting at 5s is a deliberately modest starting point (no
 * production traffic exists yet to tune against), not a value copied
 * from an existing precedent.
 */
@Injectable()
export class ChannelMessageDeliveryProducer {
  constructor(
    @InjectQueue(CHANNEL_MESSAGE_DELIVERY_QUEUE)
    private readonly queue: Queue<ChannelMessageDeliveryJobPayload>,
  ) {}

  async enqueue(
    payload: ChannelMessageDeliveryJobPayload,
  ): Promise<Job<ChannelMessageDeliveryJobPayload>> {
    return this.queue.add("deliver", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
  }
}
