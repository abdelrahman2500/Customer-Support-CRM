import { Controller, Get, Body, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import { CreateChannelMessageDto } from "../tickets/dto/create-channel-message.dto";
import { AiChatService } from "../ai/ai-chat.service";
import type { AiChatResultResponse, ChatMessageSummary } from "../ai/ai-chat.service";
import { PortalTicketsService } from "./portal-tickets.service";

/**
 * Story 80 — Customer Portal AI Chatbot (Foundation). Every route is
 * `@PortalRoute()`, mirroring `PortalTicketsController`/
 * `PortalKnowledgeBaseController` exactly. `AiChatService` is injected
 * directly (no intermediate `PortalChatService`) — mirrors
 * `PortalKnowledgeBaseController`'s own precedent: `AiChatService`'s
 * methods already take `contactId` directly, with no extra
 * `customerId`-style resolution step needed first.
 *
 * `CreateChannelMessageDto` (`{ body: string }`) is reused verbatim for
 * the chat-message body — identical shape/validation to
 * `PortalTicketsController.sendMessage`'s own reuse of it.
 *
 * Story 85 — `escalate` also injects `PortalTicketsService` (the only
 * route here that does): the escalation orchestration composes
 * `AiChatService` with `TicketsService`/`TicketChannelService`, and
 * `PortalTicketsService` already does exactly that kind of composition
 * (see its own doc comment).
 */
@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal/chat")
export class PortalChatController {
  constructor(
    private readonly aiChatService: AiChatService,
    private readonly portalTicketsService: PortalTicketsService,
  ) {}

  @PortalRoute()
  @Post("sessions")
  start(@Req() request: Request): Promise<{ id: string }> {
    const claims = request.user as JwtAccessTokenClaims;
    return this.aiChatService.startSession(claims.sub, this.requireBranchId(claims));
  }

  @PortalRoute()
  @Post("sessions/:id/messages")
  sendMessage(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() dto: CreateChannelMessageDto,
  ): Promise<{ id: string; outcome: "PENDING" | "DISABLED" }> {
    const claims = request.user as JwtAccessTokenClaims;
    return this.aiChatService.sendMessage(claims.sub, id, dto.body);
  }

  @PortalRoute()
  @Get("sessions/:id/messages")
  getMessages(@Req() request: Request, @Param("id") id: string): Promise<ChatMessageSummary[]> {
    const claims = request.user as JwtAccessTokenClaims;
    return this.aiChatService.getMessages(claims.sub, id);
  }

  @PortalRoute()
  @Get("sessions/:id/ai/:logId")
  getAiResult(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("logId") logId: string,
  ): Promise<AiChatResultResponse> {
    const claims = request.user as JwtAccessTokenClaims;
    return this.aiChatService.getAiResult(claims.sub, id, logId);
  }

  /** Story 85 — AI Chat: Escalate to a Human Ticket. */
  @PortalRoute()
  @Post("sessions/:id/escalate")
  escalate(@Req() request: Request, @Param("id") id: string): Promise<{ ticketId: string }> {
    const claims = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.escalateChatSession(claims.sub, id);
  }

  /** A portal-issued token always carries `branchId` — mirrors
   * `PortalKnowledgeBaseController`'s own identical guard. */
  private requireBranchId(claims: JwtAccessTokenClaims): string {
    if (!claims.branchId) {
      throw new UnauthorizedException("Token has no associated branch");
    }
    return claims.branchId;
  }
}
