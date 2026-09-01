import { Controller, Get, Body, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import { CreateChannelMessageDto } from "../tickets/dto/create-channel-message.dto";
import { AiChatService } from "../ai/ai-chat.service";
import type { AiChatResultResponse, ChatMessageSummary } from "../ai/ai-chat.service";

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
 */
@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal/chat")
export class PortalChatController {
  constructor(private readonly aiChatService: AiChatService) {}

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

  /** A portal-issued token always carries `branchId` — mirrors
   * `PortalKnowledgeBaseController`'s own identical guard. */
  private requireBranchId(claims: JwtAccessTokenClaims): string {
    if (!claims.branchId) {
      throw new UnauthorizedException("Token has no associated branch");
    }
    return claims.branchId;
  }
}
