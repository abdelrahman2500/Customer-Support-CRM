import { BadRequestException, Injectable } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { ChannelMessagesService } from "../channels/channel-messages.service";
import type { ChannelMessageSummary } from "../channels/channel-messages.service";
import { CustomersService } from "../customers/customers.service";
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
 *
 * RM-15 — `createAgentEmailMessage` is `EMAIL`'s own real production
 * caller of RM-13's `enqueueOutboundDelivery` (RM-13/14 both explicitly
 * documented "no production caller yet"; this is the first one). Same
 * `getTicket`-first authorization shape as `createAgentMessage`, so it
 * inherits identical branch/department scoping — no authorization logic
 * of its own. `CustomersService` (already imported into `TicketsModule`
 * for `WebFormIntakeService`, see that module's own doc comment) is
 * injected only for this one method, to resolve the ticket's contact
 * email before ever touching the delivery queue: a ticket with no
 * contact, or a contact with no email on file, is rejected immediately
 * with a clear `BadRequestException` rather than silently enqueuing a
 * message `apps/worker`'s own `EmailAdapter` could never actually
 * deliver.
 */
@Injectable()
export class TicketChannelService {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly channelMessagesService: ChannelMessagesService,
    private readonly tenantContext: TenantContext,
    private readonly customersService: CustomersService,
  ) {}

  /** `userId` is resolved from `TenantContext`, not a controller-passed
   * param — mirrors `TicketsService.createTicketNote`'s own
   * `requireAuthenticatedUserId()` convention exactly. */
  async createAgentMessage(ticketId: string, body: string): Promise<ChannelMessageSummary> {
    await this.ticketsService.getTicket(ticketId);
    const userId = this.requireAuthenticatedUserId();
    return this.channelMessagesService.createOutboundFromUser(ticketId, "LIVE_CHAT", userId, body);
  }

  /**
   * RM-15 — see this class's own doc comment. The recipient email is not
   * passed to `enqueueOutboundDelivery` itself (`ChannelMessage` has no
   * recipient field — see `ChannelAdapter.send()`'s own doc comment):
   * `apps/worker`'s `EmailAdapter` re-resolves it fresh from the ticket at
   * send time. This method's own lookup exists purely to fail fast, with
   * a clear message, before a message a real send could never complete
   * ever reaches the queue at all.
   */
  async createAgentEmailMessage(ticketId: string, body: string): Promise<ChannelMessageSummary> {
    const ticket = await this.ticketsService.getTicket(ticketId);
    const userId = this.requireAuthenticatedUserId();
    if (!ticket.contactId) {
      throw new BadRequestException("This ticket has no contact to email.");
    }
    const customer = await this.customersService.getCustomer(ticket.customerId);
    const contact = customer.contacts.find((candidate) => candidate.id === ticket.contactId);
    if (!contact?.email) {
      throw new BadRequestException("This ticket's contact has no email address on file.");
    }
    return this.channelMessagesService.enqueueOutboundDelivery(ticketId, "EMAIL", userId, body);
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

  /**
   * Story 87 — the public Web-Form intake orchestrator's final step:
   * records the submitted message on the ticket just created for this
   * contact. No authorization check of its own — mirrors
   * `recordAiChatTranscript`'s identical "caller already owns this
   * brand-new ticket/contact pairing" precedent (Story 85).
   */
  async recordWebFormMessage(ticketId: string, contactId: string, body: string): Promise<void> {
    await this.channelMessagesService.createInboundFromContact(
      ticketId,
      "WEB_FORM",
      contactId,
      body,
    );
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
