import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { ChannelMessage, ChannelType } from "@prisma/client";
import type { Job, Queue } from "bullmq";
import * as Sentry from "@sentry/node";
import { PrismaService } from "../prisma/prisma.service";
import { sendViaNoOpAdapter } from "./no-op-channel-adapter";
import {
  CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE,
  type ChannelMessageDeliveryOutcomeJobPayload,
  type ChannelMessageSummaryPayload,
} from "./channel-message-delivery-events.types";

/**
 * Must stay identical to `CHANNEL_MESSAGE_DELIVERY_QUEUE` in
 * apps/api/src/queues/channel-message-delivery.producer.ts.
 */
export const CHANNEL_MESSAGE_DELIVERY_QUEUE = "channel-message-delivery";

/** Must stay identical to `ChannelMessageDeliveryJobPayload` in
 * apps/api/src/queues/channel-message-delivery.producer.ts. */
export interface ChannelMessageDeliveryJobPayload {
  channelMessageId: string;
  ticketId: string;
  channelType: ChannelType;
  body: string;
}

/**
 * RM-13 — `apps/worker`'s half of the channel-delivery hand-back,
 * mirroring `SlaTimerProcessor`'s/`AiProcessingProcessor`'s exact
 * "durably updates the row via this app's own `PrismaService`, never
 * through an API-side service call" convention: on a successful send,
 * this writes `deliveryStatus: SENT` directly, then hands the outcome
 * back to `apps/api` purely so `ChannelMessageDeliveryEventsBridgeProcessor`
 * can relay it over the realtime socket — the hand-back carries zero
 * business logic of its own.
 *
 * Calls `sendViaNoOpAdapter` — a no-op stand-in for a real Phase-5
 * provider (see that module's own doc comment) — so this processor
 * proves the queue/status-update loop end-to-end today, with no real
 * external transport plugged in yet. `RM-14`'s adapter registry is what
 * a real provider will eventually replace this call with.
 *
 * On a failure that exhausts every configured retry attempt (the
 * producer sets `attempts: 3`, this repository's first configured BullMQ
 * retry policy — see the producer's own doc comment), `onFailed` below
 * marks the row `FAILED` and hands that outcome back too. A failure that
 * still has attempts remaining hands back nothing — BullMQ's own
 * scheduled retry will call `process()` again, exactly as if this were
 * the first attempt.
 */
@Injectable()
@Processor(CHANNEL_MESSAGE_DELIVERY_QUEUE)
export class ChannelMessageDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelMessageDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE)
    private readonly handbackQueue: Queue<ChannelMessageDeliveryOutcomeJobPayload>,
  ) {
    super();
  }

  async process(job: Job<ChannelMessageDeliveryJobPayload>): Promise<void> {
    const result = await sendViaNoOpAdapter({
      channelMessageId: job.data.channelMessageId,
      body: job.data.body,
    });

    const message = await this.prisma.channelMessage.update({
      where: { id: job.data.channelMessageId },
      data: { deliveryStatus: "SENT", externalMessageId: result.externalMessageId },
    });

    await this.handbackQueue.add("delivery-sent", {
      ticketId: job.data.ticketId,
      message: toSummaryPayload(message),
    });
    this.logger.log(`Marked channel message ${job.data.channelMessageId} SENT`);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<ChannelMessageDeliveryJobPayload> | undefined, error: Error): Promise<void> {
    Sentry.captureException(error, {
      tags: { queue: CHANNEL_MESSAGE_DELIVERY_QUEUE, jobId: job?.id },
    });

    if (!job) {
      return;
    }
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < attempts) {
      // Attempts remain — BullMQ's own scheduled retry handles this; no
      // hand-back yet, the message stays PENDING.
      return;
    }

    const message = await this.prisma.channelMessage.update({
      where: { id: job.data.channelMessageId },
      data: { deliveryStatus: "FAILED", failureReason: error.message, retryCount: job.attemptsMade },
    });

    await this.handbackQueue.add("delivery-failed", {
      ticketId: job.data.ticketId,
      message: toSummaryPayload(message),
    });
    this.logger.warn(
      `Channel message ${job.data.channelMessageId} FAILED after ${job.attemptsMade} attempt(s): ${error.message}`,
    );
  }
}

function toSummaryPayload(message: ChannelMessage): ChannelMessageSummaryPayload {
  return {
    id: message.id,
    ticketId: message.ticketId,
    channelType: message.channelType,
    direction: message.direction,
    senderContactId: message.senderContactId,
    senderUserId: message.senderUserId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    deliveryStatus: message.deliveryStatus,
    externalMessageId: message.externalMessageId,
    failureReason: message.failureReason,
    retryCount: message.retryCount,
  };
}
