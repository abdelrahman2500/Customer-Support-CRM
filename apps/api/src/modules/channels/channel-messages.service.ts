import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { ChannelMessageDirection, ChannelType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "./channel-messages.events";

export interface ChannelMessageSummary {
  id: string;
  ticketId: string;
  channelType: ChannelType;
  direction: ChannelMessageDirection;
  senderContactId: string | null;
  senderUserId: string | null;
  body: string;
  createdAt: Date;
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
 */
@Injectable()
export class ChannelMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
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
  };
}
