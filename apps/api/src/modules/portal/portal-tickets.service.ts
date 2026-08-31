import { Injectable } from "@nestjs/common";
import { TicketsService } from "../tickets/tickets.service";
import type {
  TicketCsatSummary,
  TicketHistoryEntrySummary,
  TicketSummary,
} from "../tickets/tickets.service";
import { TicketChannelService } from "../tickets/ticket-channel.service";
import type { ChannelMessageSummary } from "../channels/channel-messages.service";
import { PortalService } from "./portal.service";
import type { PortalCreateTicketDto } from "./dto/portal-create-ticket.dto";
import type { SubmitCsatDto } from "./dto/submit-csat.dto";
import type { CreateChannelMessageDto } from "../tickets/dto/create-channel-message.dto";

/**
 * Story 53 — composes `PortalService.getAuthenticatedContact` (resolves the
 * authenticated Contact's `customerId`, reusing its existing
 * portal-access-still-valid check) with `TicketsService`'s new
 * customer-scoped methods (see that service's own "Story 53" section) —
 * keeps `PortalTicketsController` thin and avoids duplicating
 * contact-resolution logic (plan Design item 6).
 */
@Injectable()
export class PortalTicketsService {
  constructor(
    private readonly portalService: PortalService,
    private readonly ticketsService: TicketsService,
    private readonly ticketChannelService: TicketChannelService,
  ) {}

  /** `createTicketForContact` resolves the Contact (and its Customer/branch)
   * itself, so no separate resolution step is needed here. */
  createTicket(contactId: string, dto: PortalCreateTicketDto): Promise<TicketSummary> {
    return this.ticketsService.createTicketForContact(contactId, dto);
  }

  async listTickets(contactId: string): Promise<TicketSummary[]> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.listTicketsForCustomer(customerId);
  }

  async getTicket(contactId: string, ticketId: string): Promise<TicketSummary> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.getTicketForCustomer(ticketId, customerId);
  }

  async getTicketHistory(
    contactId: string,
    ticketId: string,
  ): Promise<TicketHistoryEntrySummary[]> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.getTicketHistoryForCustomer(ticketId, customerId);
  }

  /** Story 55 — feedback/CSAT for a resolved/closed ticket. */
  async submitCsat(
    contactId: string,
    ticketId: string,
    dto: SubmitCsatDto,
  ): Promise<{ id: string }> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.submitCsatForCustomer(ticketId, customerId, contactId, dto);
  }

  async getCsat(contactId: string, ticketId: string): Promise<TicketCsatSummary | null> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.getCsatForCustomer(ticketId, customerId);
  }

  /**
   * Story 77 — Customer Portal Live Chat, the customer-facing half.
   * Composes `TicketChannelService`'s customer-scoped methods exactly the
   * way every other method here composes `TicketsService`'s own
   * customer-scoped ones — `contactId` doubles as the message's
   * `senderContactId`, `customerId` scopes ticket-ownership authorization.
   */
  async sendMessage(
    contactId: string,
    ticketId: string,
    dto: CreateChannelMessageDto,
  ): Promise<ChannelMessageSummary> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketChannelService.createCustomerMessage(ticketId, customerId, contactId, dto.body);
  }

  async getMessages(contactId: string, ticketId: string): Promise<ChannelMessageSummary[]> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketChannelService.listMessagesForCustomer(ticketId, customerId);
  }
}
