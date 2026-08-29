import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import { PortalCreateTicketDto } from "./dto/portal-create-ticket.dto";
import type { TicketHistoryEntrySummary, TicketSummary } from "../tickets/tickets.service";
import { PortalTicketsService } from "./portal-tickets.service";

/**
 * Story 53 — Customer Portal — Submit & Track Own Tickets. Every route is
 * `@PortalRoute()`: `AudienceGuard` requires a `customer`-audience token
 * (rejects an `agent`-audience one with 401), exactly like
 * `PortalController.me`. No RBAC/permission check applies — Contacts have
 * no role system (Story 52's own precedent).
 */
@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal/tickets")
export class PortalTicketsController {
  constructor(private readonly portalTicketsService: PortalTicketsService) {}

  @PortalRoute()
  @Post()
  create(
    @Req() request: Request,
    @Body() dto: PortalCreateTicketDto,
  ): Promise<TicketSummary> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.createTicket(contact.sub, dto);
  }

  @PortalRoute()
  @Get()
  list(@Req() request: Request): Promise<TicketSummary[]> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.listTickets(contact.sub);
  }

  @PortalRoute()
  @Get(":id")
  getOne(@Req() request: Request, @Param("id") id: string): Promise<TicketSummary> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.getTicket(contact.sub, id);
  }

  @PortalRoute()
  @Get(":id/history")
  getHistory(
    @Req() request: Request,
    @Param("id") id: string,
  ): Promise<TicketHistoryEntrySummary[]> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.getTicketHistory(contact.sub, id);
  }
}
