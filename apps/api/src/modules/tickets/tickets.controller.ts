import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import type { TicketHistoryEntrySummary, TicketSummary } from "./tickets.service";
import { TicketsService } from "./tickets.service";

@ApiTags("tickets")
@ApiBearerAuth()
@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @RequirePermissions("ticket:create")
  create(@Body() dto: CreateTicketDto): Promise<TicketSummary> {
    return this.ticketsService.createTicket(dto);
  }

  @Get()
  @RequirePermissions("ticket:read")
  list(): Promise<TicketSummary[]> {
    return this.ticketsService.listTickets();
  }

  @Get(":id")
  @RequirePermissions("ticket:read")
  getOne(@Param("id") id: string): Promise<TicketSummary> {
    return this.ticketsService.getTicket(id);
  }

  @Patch(":id")
  @RequirePermissions("ticket:update")
  update(@Param("id") id: string, @Body() dto: UpdateTicketDto): Promise<{ id: string }> {
    return this.ticketsService.updateTicket(id, dto);
  }

  @Get(":id/history")
  @RequirePermissions("ticket:read")
  getHistory(@Param("id") id: string): Promise<TicketHistoryEntrySummary[]> {
    return this.ticketsService.getTicketHistory(id);
  }
}
