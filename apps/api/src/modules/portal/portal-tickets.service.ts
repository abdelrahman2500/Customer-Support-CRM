import { Injectable } from "@nestjs/common";
import { TicketsService } from "../tickets/tickets.service";
import type {
  TicketCsatSummary,
  TicketHistoryEntrySummary,
  TicketSummary,
} from "../tickets/tickets.service";
import { PortalService } from "./portal.service";
import type { PortalCreateTicketDto } from "./dto/portal-create-ticket.dto";
import type { SubmitCsatDto } from "./dto/submit-csat.dto";

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
}
