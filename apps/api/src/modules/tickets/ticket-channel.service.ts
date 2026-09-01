import { Injectable } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { ChannelMessagesService } from "../channels/channel-messages.service";
import type { ChannelMessageSummary } from "../channels/channel-messages.service";
import { TicketsService } from "./tickets.service";

/**
 * Story 77 — Customer Portal Live Chat, the first real `ChannelMessage`
 * consumer. Composes the already-exported `TicketsService` (ticket
 * authorization/loading) with `ChannelMessagesService` (persistence),
 * mirroring exactly how `TicketAiService` composes `TicketsService` with
 * `AiGatewayService` (Story 73's own precedent) — `TicketsModule` imports
 * `ChannelsModule` for this, mirroring `AiModule`'s own import.
 *
 * Every method reuses `TicketsService.getTicket`/`getTicketForCustomer`,
 * so branch scope, Story 68's department-visibility filter, and the
 * customer-scoped `customerId` check all apply identically — a caller can
 * never send/read a channel message for a ticket they couldn't otherwise
 * read. `PortalTicketsService` calls this service's customer-scoped
 * methods directly, the same way it already calls `TicketsService`'s own
 * customer-scoped methods (Story 53's precedent).
 *
 * `LIVE_CHAT` and (Story 85) `AI_CHAT` are the only two `ChannelType`
 * values reachable from this service — the other three still have no
 * producer (see Story 77's plan Non-goals).
 */
@Injectable()
export class TicketChannelService {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly channelMessagesService: ChannelMessagesService,
    private readonly tenantContext: TenantContext,
  ) {}

  /** `userId` is resolved from `TenantContext`, not a controller-passed
   * param — mirrors `TicketsService.createTicketNote`'s own
   * `requireAuthenticatedUserId()` convention exactly. */
  async createAgentMessage(ticketId: string, body: string): Promise<ChannelMessageSummary> {
    await this.ticketsService.getTicket(ticketId);
    const userId = this.requireAuthenticatedUserId();
    return this.channelMessagesService.createOutboundFromUser(ticketId, "LIVE_CHAT", userId, body);
  }

  async listMessagesForAgent(ticketId: string): Promise<ChannelMessageSummary[]> {
    await this.ticketsService.getTicket(ticketId);
    return this.channelMessagesService.listForTicket(ticketId);
  }

  async createCustomerMessage(
    ticketId: string,
    customerId: string,
    contactId: string,
    body: string,
  ): Promise<ChannelMessageSummary> {
    await this.ticketsService.getTicketForCustomer(ticketId, customerId);
    return this.channelMessagesService.createInboundFromContact(ticketId, "LIVE_CHAT", contactId, body);
  }

  async listMessagesForCustomer(ticketId: string, customerId: string): Promise<ChannelMessageSummary[]> {
    await this.ticketsService.getTicketForCustomer(ticketId, customerId);
    return this.channelMessagesService.listForTicket(ticketId);
  }

  /**
   * Story 85 — replays a just-escalated `ChatSession`'s transcript onto a
   * brand-new ticket, in order. No authorization check of its own — the
   * caller (`PortalTicketsService.escalateChatSession`) just created
   * `ticketId` for this exact `contactId` a moment ago, mirroring
   * `AiGatewayService`'s own "no ticket-authorization logic of its own"
   * precedent (Story 73).
   */
  async recordAiChatTranscript(
    ticketId: string,
    contactId: string,
    messages: { role: "CUSTOMER" | "ASSISTANT"; body: string }[],
  ): Promise<void> {
    for (const message of messages) {
      if (message.role === "CUSTOMER") {
        await this.channelMessagesService.createInboundFromContact(
          ticketId,
          "AI_CHAT",
          contactId,
          message.body,
        );
      } else {
        await this.channelMessagesService.createSystemMessage(
          ticketId,
          "AI_CHAT",
          "OUTBOUND",
          message.body,
        );
      }
    }
  }

  /** Mirrors `TicketsService`'s own private `requireAuthenticatedUserId`
   * exactly (same error, same `TenantContext.userId` source). */
  private requireAuthenticatedUserId(): string {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no authenticated user on this request");
    }
    return userId;
  }
}
