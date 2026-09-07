import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateTicketKbReferenceDto } from "./dto/create-ticket-kb-reference.dto";
import type { TicketKbReferenceSummary } from "./tickets.service";
import { TicketsService } from "./tickets.service";

/**
 * RM-05 — mirrors `CustomerNotesController`'s exact shape (RM-02): a
 * dedicated `tickets/:id/kb-references` controller, same module, same
 * service. `ticket:update` gates create/delete (mutations — matches
 * `AttachmentsController`'s own choice for its upload route), `ticket:read`
 * gates list.
 */
@ApiTags("tickets")
@ApiBearerAuth()
@Controller("tickets/:id/kb-references")
export class TicketKbReferencesController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @RequirePermissions("ticket:update")
  create(
    @Param("id") ticketId: string,
    @Body() dto: CreateTicketKbReferenceDto,
  ): Promise<TicketKbReferenceSummary> {
    return this.ticketsService.createTicketKbReference(ticketId, dto);
  }

  @Get()
  @RequirePermissions("ticket:read")
  list(@Param("id") ticketId: string): Promise<TicketKbReferenceSummary[]> {
    return this.ticketsService.listTicketKbReferences(ticketId);
  }

  @Delete(":referenceId")
  @RequirePermissions("ticket:update")
  remove(
    @Param("id") ticketId: string,
    @Param("referenceId") referenceId: string,
  ): Promise<{ id: string }> {
    return this.ticketsService.deleteTicketKbReference(ticketId, referenceId);
  }
}
