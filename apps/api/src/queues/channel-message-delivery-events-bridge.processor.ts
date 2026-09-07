import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../modules/channels/channel-messages.events";
import type { ChannelMessageCreatedEvent } from "../modules/channels/channel-messages.events";
import type { ChannelMessageSummary } from "../modules/channels/channel-messages.service";

/** Same shape as `ChannelMessageSummary`, except `createdAt` — BullMQ job
 * data is JSON through Redis, so a `Date` never survives the round trip
 * as one; it arrives here a plain ISO string and is converted back to a
 * real `Date` in `process()` below, mirroring `SlaTimerEventsBridgeProcessor`'s
 * own identical `targetAt: string` → `new Date(...)` treatment. */
export type ChannelMessageSummaryPayload = Omit<ChannelMessageSummary, "createdAt"> & {
  createdAt: string;
};

/**
 * The dedicated worker-to-api channel-delivery hand-back queue —
 * apps/worker's `ChannelMessageDeliveryProcessor`
 * (apps/worker/src/queues/channel-message-delivery.processor.ts) is this
 * queue's producer and duplicates this literal with a cross-reference
 * comment, the same convention Story 15/76 established for
 * `SLA_TIMER_EVENTS_QUEUE`/`AI_PROCESSING_EVENTS_QUEUE`.
 */
export const CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE = "channel-message-delivery-events";

/** apps/worker's `ChannelMessageDeliveryProcessor` already durably wrote
 * the row (via its own `PrismaService`, mirroring `SlaTimerProcessor`'s/
 * `AiProcessingProcessor`'s own "never through an API-side service call"
 * doc-commented convention) before enqueueing this — the full,
 * already-updated summary rides along so this processor never needs its
 * own Prisma round trip to re-fetch it. */
export interface ChannelMessageDeliveryOutcomeJobPayload {
  ticketId: string;
  message: ChannelMessageSummaryPayload;
}

/**
 * RM-13 — apps/api's half of the channel-delivery hand-back, mirroring
 * `SlaTimerEventsBridgeProcessor`'s/`AiProcessingEventsBridgeProcessor`'s
 * exact restraint: translates one typed job into exactly one
 * `EventEmitter2.emit(...)` call, no Prisma, no business logic of its
 * own. Deliberately reuses `CHANNEL_MESSAGE_CREATED_EVENT` — the same
 * event `ChannelMessagesService`'s own creates already emit — rather than
 * a new event name: `TicketRealtimeListener` already relays it to both
 * the ticket's agent and customer audiences unchanged, and the frontend's
 * `mergeChannelMessage` now upserts by id, so a status-update emission
 * for an already-rendered message id patches it in place instead of
 * appending a duplicate.
 */
@Injectable()
@Processor(CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE)
export class ChannelMessageDeliveryEventsBridgeProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelMessageDeliveryEventsBridgeProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<ChannelMessageDeliveryOutcomeJobPayload>): Promise<void> {
    const payload: ChannelMessageCreatedEvent = {
      ticketId: job.data.ticketId,
      message: { ...job.data.message, createdAt: new Date(job.data.message.createdAt) },
    };
    this.eventEmitter.emit(CHANNEL_MESSAGE_CREATED_EVENT, payload);
    this.logger.log(
      `Emitted ${CHANNEL_MESSAGE_CREATED_EVENT} for channel message ${job.data.message.id} (${job.data.message.deliveryStatus})`,
    );
  }
}
