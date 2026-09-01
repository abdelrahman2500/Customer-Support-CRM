import { Injectable } from "@nestjs/common";
import { CustomersService } from "../customers/customers.service";
import { TicketsService } from "./tickets.service";
import type { TicketSummary } from "./tickets.service";
import { TicketChannelService } from "./ticket-channel.service";
import type { SubmitWebFormTicketDto } from "./dto/submit-web-form-ticket.dto";

/**
 * Story 87 — Communication/Channels: Public Web-Form Ticket Intake. The
 * orchestrator for the one public, unauthenticated write endpoint in the
 * repository — composes `CustomersService` (new find-or-create entry
 * point), `TicketsService` (the existing "customer-scoped, no
 * `TenantContext`" `createTicketForContact` path, Story 53), and
 * `TicketChannelService` (the new `recordWebFormMessage`), mirroring
 * exactly how `PortalTicketsService.escalateChatSession` (Story 85)
 * composes the same three kinds of collaborators for its own multi-step
 * "resolve identity, create ticket, record message(s)" flow.
 */
@Injectable()
export class WebFormIntakeService {
  constructor(
    private readonly customersService: CustomersService,
    private readonly ticketsService: TicketsService,
    private readonly ticketChannelService: TicketChannelService,
  ) {}

  async submit(dto: SubmitWebFormTicketDto): Promise<TicketSummary> {
    const { contactId } = await this.customersService.findOrCreateContactForWebForm(
      dto.branchId,
      { fullName: dto.fullName, email: dto.email, phone: dto.phone },
    );
    const ticket = await this.ticketsService.createTicketForContact(contactId, {
      subject: dto.subject,
      category: dto.category,
    });
    await this.ticketChannelService.recordWebFormMessage(ticket.id, contactId, dto.message);
    return ticket;
  }
}
