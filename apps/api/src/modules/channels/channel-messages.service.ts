import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { ChannelMessageDeliveryStatus, ChannelMessageDirection, ChannelType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "./channel-messages.events";
import { ChannelMessageDeliveryProducer } from "../../queues/channel-message-delivery.producer";

export interface ChannelMessageSummary {
  id: string;
  ticketId: string;
  channelType: ChannelType;
  direction: ChannelMessageDirection;
  senderContactId: string | null;
  senderUserId: string | null;
  body: string;
  createdAt: Date;
  /** RM-13 — see this file's own class doc comment. Always `DELIVERED`
   * today; the other three values have no production caller yet. */
  deliveryStatus: ChannelMessageDeliveryStatus;
  externalMessageId: string | null;
  failureReason: string | null;
  retryCount: number;
}

/**
 * Owns the `channels` schema — see docs/architecture/03-domain-
 * boundaries.md ("Communication / Channels"). Story 77 — foundation-and-
 * first-consumer together (mirrors `ticket-attachments`'s own precedent
 * of never adding schema nothing uses yet): pure `ChannelMessage`
 * persistence, no ticket-authorization logic of its own — callers
 * (`TicketChannelService`) verify ticket access *before* calling here,
 * exactly like `AiGatewayService` never checks ticket authorization
 * either. Every create emits `CHANNEL_MESSAGE_CREATED_EVENT` once, right
 * after the row is durably persisted — mirrors `TicketsService.
 * createTicketNote`'s own "emit right after persist" convention.
 *
 * RM-13 — `enqueueOutboundDelivery`/`markSent`/`markDelivered`/
 * `markFailed` add a delivery lifecycle for a future externally-delivered
 * channel (Phase 5's Email/WhatsApp/SMS adapters). No production code
 * calls `enqueueOutboundDelivery` yet — the three existing `create*`
 * methods above are completely unchanged, so every Live Chat/Web
 * Form/AI_CHAT message keeps getting `DELIVERED` immediately via the
 * schema's own default, exactly as before this story. A status
 * transition re-emits `CHANNEL_MESSAGE_CREATED_EVENT` with the row's full,
 * now-updated summary rather than a new event — `TicketRealtimeListener`
 * already relays that event to both the ticket's agent and customer
 * audiences unchanged, and the frontend's `mergeChannelMessage` now
 * upserts by id instead of only appending, so a second event for an
 * already-rendered message id patches it in place.
 */
@Injectable()
export class ChannelMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly deliveryProducer: ChannelMessageDeliveryProducer,
  ) {}

  async createInboundFromContact(
    ticketId: string,
    channelType: ChannelType,
    senderContactId: string,
    body: string,
  ): Promise<ChannelMessageSummary> {
    const message = await this.prisma.channelMessage.create({
      data: { ticketId, channelType, direction: "INBOUND", senderContactId, body },
    });
    return this.emitAndReturn(ticketId, message);
  }

  async createOutboundFromUser(
    ticketId: string,
    channelType: ChannelType,
    senderUserId: string,
    body: string,
  ): Promise<ChannelMessageSummary> {
    const message = await this.prisma.channelMessage.create({
      data: { ticketId, channelType, direction: "OUTBOUND", senderUserId, body },
    });
    return this.emitAndReturn(ticketId, message);
  }

  /**
   * Story 85 — a message with no `User`/`Contact` author at all (both
   * `senderContactId`/`senderUserId` stay `null`). Used to replay a
   * `ChatSession`'s `ASSISTANT`-role turns onto an escalated ticket: the
   * AI wrote it, not a signed-in agent and not the Contact.
   */
  async createSystemMessage(
    ticketId: string,
    channelType: ChannelType,
    direction: ChannelMessageDirection,
    body: string,
  ): Promise<ChannelMessageSummary> {
    const message = await this.prisma.channelMessage.create({
      data: { ticketId, channelType, direction, body },
    });
    return this.emitAndReturn(ticketId, message);
  }

  async listForTicket(ticketId: string): Promise<ChannelMessageSummary[]> {
    const messages = await this.prisma.channelMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
    });
    return messages.map(toSummary);
  }

  /**
   * RM-13 — creates the row `PENDING` (not the schema's `DELIVERED`
   * default — this is the one caller that explicitly opts out of it) and
   * enqueues it onto `channel-message-delivery` for a future adapter to
   * actually send. No production caller yet; a future Phase-5 adapter's
   * outbound-send code is the intended first one. Emits
   * `CHANNEL_MESSAGE_CREATED_EVENT` once, same as every other create —
   * the message appears immediately with a `PENDING` status, then
   * `markSent`/`markFailed` re-emit the same event once the queue
   * resolves it.
   */
  async enqueueOutboundDelivery(
    ticketId: string,
    channelType: ChannelType,
    senderUserId: string,
    body: string,
  ): Promise<ChannelMessageSummary> {
    const message = await this.prisma.channelMessage.create({
      data: { ticketId, channelType, direction: "OUTBOUND", senderUserId, body, deliveryStatus: "PENDING" },
    });
    await this.deliveryProducer.enqueue({ channelMessageId: message.id, ticketId, channelType, body });
    return this.emitAndReturn(ticketId, message);
  }

  /** RM-13 — a future adapter's confirmation that the provider accepted
   * the message (e.g. an SMTP relay's own accept response); not yet
   * confirmed received by the recipient (see `markDelivered`). */
  async markSent(messageId: string, externalMessageId: string): Promise<ChannelMessageSummary> {
    const message = await this.prisma.channelMessage.update({
      where: { id: messageId },
      data: { deliveryStatus: "SENT", externalMessageId },
    });
    return this.emitAndReturn(message.ticketId, message);
  }

  /** RM-13 — a future adapter's delivery-confirmation callback (e.g. a
   * provider webhook). No caller exists yet — the no-op adapter this
   * story proves the queue loop against only ever reaches `SENT`, never
   * this — but the method is implemented and tested now so the seam is
   * proven ahead of any real provider. */
  async markDelivered(messageId: string): Promise<ChannelMessageSummary> {
    const message = await this.prisma.channelMessage.update({
      where: { id: messageId },
      data: { deliveryStatus: "DELIVERED" },
    });
    return this.emitAndReturn(message.ticketId, message);
  }

  /** RM-13 — every retry attempt was exhausted; `retryCount` is the exact
   * number of attempts BullMQ made (`job.attemptsMade`), not a locally
   * re-derived count. */
  async markFailed(
    messageId: string,
    failureReason: string,
    retryCount: number,
  ): Promise<ChannelMessageSummary> {
    const message = await this.prisma.channelMessage.update({
      where: { id: messageId },
      data: { deliveryStatus: "FAILED", failureReason, retryCount },
    });
    return this.emitAndReturn(message.ticketId, message);
  }

  private async emitAndReturn(
    ticketId: string,
    message: Parameters<typeof toSummary>[0],
  ): Promise<ChannelMessageSummary> {
    const summary = toSummary(message);
    this.eventEmitter.emit(CHANNEL_MESSAGE_CREATED_EVENT, { ticketId, message: summary });
    return summary;
  }
}

function toSummary(message: {
  id: string;
  ticketId: string;
  channelType: ChannelType;
  direction: ChannelMessageDirection;
  senderContactId: string | null;
  senderUserId: string | null;
  body: string;
  createdAt: Date;
  deliveryStatus: ChannelMessageDeliveryStatus;
  externalMessageId: string | null;
  failureReason: string | null;
  retryCount: number;
}): ChannelMessageSummary {
  return {
    id: message.id,
    ticketId: message.ticketId,
    channelType: message.channelType,
    direction: message.direction,
    senderContactId: message.senderContactId,
    senderUserId: message.senderUserId,
    body: message.body,
    createdAt: message.createdAt,
    deliveryStatus: message.deliveryStatus,
    externalMessageId: message.externalMessageId,
    failureReason: message.failureReason,
    retryCount: message.retryCount,
  };
}
