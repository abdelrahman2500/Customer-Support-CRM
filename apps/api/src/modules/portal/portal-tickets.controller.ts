import { Body, Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import { PortalCreateTicketDto } from "./dto/portal-create-ticket.dto";
import { SubmitCsatDto } from "./dto/submit-csat.dto";
import type {
  TicketCsatSummary,
  TicketHistoryEntrySummary,
  TicketSummary,
} from "../tickets/tickets.service";
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

  @PortalRoute()
  @Post(":id/csat")
  submitCsat(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() dto: SubmitCsatDto,
  ): Promise<{ id: string }> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.submitCsat(contact.sub, id, dto);
  }

  /**
   * `@Res()` (no `passthrough`) bypasses Nest's automatic reply — needed to
   * send a genuine `204 No Content` when no feedback has been submitted yet.
   * Returning `null` directly from a Nest handler still replies `200` with
   * an *empty* body (Nest's `isNil(body)` short-circuit in
   * `express-adapter.js`'s `reply()`), which every fetch client's
   * `response.json()` throws on — `204` is the only way to make "nothing
   * yet" distinguishable and safely parseable. Mirrored exactly by the
   * agent-facing `TicketsController.getCsat`.
   */
  @PortalRoute()
  @Get(":id/csat")
  async getCsat(
    @Req() request: Request,
    @Param("id") id: string,
    @Res() response: Response,
  ): Promise<void> {
    const contact = request.user as JwtAccessTokenClaims;
    const result: TicketCsatSummary | null = await this.portalTicketsService.getCsat(
      contact.sub,
      id,
    );
    if (!result) {
      response.status(204).send();
      return;
    }
    response.status(200).json(result);
  }
}
