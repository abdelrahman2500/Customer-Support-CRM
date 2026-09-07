import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { ChannelMessage, ChannelType } from "@prisma/client";
import type { Job, Queue } from "bullmq";
import * as Sentry from "@sentry/node";
import { PrismaService } from "../prisma/prisma.service";
import { ChannelAdapterRegistry } from "../channels/channel-adapter-registry";
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
 * RM-14 — resolves `job.data.channelType` through `ChannelAdapterRegistry`
 * (replacing RM-13's own bespoke `sendViaNoOpAdapter` stand-in, now
 * deleted — this is the "real one" that story's own doc comment already
 * promised) and calls the resolved adapter's `send()`. `EMAIL`/
 * `WHATSAPP`/`SMS` have no registered adapter yet — that call resolves
 * `undefined`, and the message deliberately stays `PENDING`: not
 * configured is not the same as failed, so nothing is marked `FAILED`,
 * no retry is scheduled, and no hand-back fires (nothing actually
 * changed). A Phase 5 story registers a real adapter for one of these,
 * not `apps/worker` itself.
 *
 * On a failure that exhausts every configured retry attempt (the
 * producer sets `attempts: 3`, this repository's first configured BullMQ
 * retry policy — see the producer's own doc comment), `onFailed` below
 * marks the row `FAILED` and hands that outcome back too. A failure that
 * still has attempts remaining hands back nothing — BullMQ's own
 * scheduled retry will call `process()` again, exactly as if this were
 * the first attempt.
 *
 * RM-15 — a minimal, schema-free idempotency guard: `process()` never
 * calls `adapter.send()` for a row already `SENT`/`DELIVERED` (checked
 * against the same `findUniqueOrThrow` read `send()` itself needs, no
 * extra query). This is not a claim of true exactly-once SMTP delivery —
 * a real mail transport can accept a message and then have the
 * connection drop before this process ever records that success, and a
 * subsequent retry of that *same* attempt has no way to know the first
 * one actually landed. What this guard *does* rule out is the case this
 * repository's own architecture could otherwise create: a second,
 * independent job for a message BullMQ already completed (a stray
 * duplicate enqueue, a replayed job) re-sending it. BullMQ itself
 * remains the only retry authority — this guard adds no second retry
 * mechanism, only a check before the one send this method ever performs
 * per invocation.
 */
@Injectable()
@Processor(CHANNEL_MESSAGE_DELIVERY_QUEUE)
export class ChannelMessageDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelMessageDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterRegistry: ChannelAdapterRegistry,
    @InjectQueue(CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE)
    private readonly handbackQueue: Queue<ChannelMessageDeliveryOutcomeJobPayload>,
  ) {
    super();
  }

  async process(job: Job<ChannelMessageDeliveryJobPayload>): Promise<void> {
    const adapter = this.adapterRegistry.resolve(job.data.channelType);
    if (!adapter) {
      this.logger.warn(
        `No adapter configured for channel ${job.data.channelType} — message ${job.data.channelMessageId} stays PENDING`,
      );
      return;
    }

    const row = await this.prisma.channelMessage.findUniqueOrThrow({
      where: { id: job.data.channelMessageId },
    });
    if (row.deliveryStatus === "SENT" || row.deliveryStatus === "DELIVERED") {
      this.logger.warn(
        `Channel message ${job.data.channelMessageId} is already ${row.deliveryStatus} — skipping a duplicate send`,
      );
      return;
    }
    const result = await adapter.send(row);

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
