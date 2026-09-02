import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import { PortalCreateTicketDto } from "./dto/portal-create-ticket.dto";
import { SubmitCsatDto } from "./dto/submit-csat.dto";
import { CreateChannelMessageDto } from "../tickets/dto/create-channel-message.dto";
import type {
  TicketCsatSummary,
  TicketHistoryEntrySummary,
  TicketSummary,
} from "../tickets/tickets.service";
import type { ChannelMessageSummary } from "../channels/channel-messages.service";
import type {
  AttachmentSummary,
  UploadedFile as UploadedFileShape,
} from "../attachments/attachments.service";
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

  /**
   * Story 77 — Customer Portal Live Chat. The decided V1 scope
   * (authenticated Customer Portal users only, never anonymous visitors)
   * is enforced structurally by `@PortalRoute()` itself, exactly like
   * every other route here — no new authorization mechanism.
   */
  @PortalRoute()
  @Post(":id/messages")
  sendMessage(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() dto: CreateChannelMessageDto,
  ): Promise<ChannelMessageSummary> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.sendMessage(contact.sub, id, dto);
  }

  @PortalRoute()
  @Get(":id/messages")
  getMessages(@Req() request: Request, @Param("id") id: string): Promise<ChannelMessageSummary[]> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.getMessages(contact.sub, id);
  }

  /**
   * Story 103 — Customer Portal: Ticket Attachment Upload. Mirrors
   * `AttachmentsController.create`'s exact shape (`FileInterceptor`,
   * `multipart/form-data`) — the same file arrives through the same
   * `AttachmentsService.validateFile` size/MIME check either way.
   */
  @PortalRoute()
  @Post(":id/attachments")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  uploadAttachment(
    @Req() request: Request,
    @Param("id") id: string,
    @UploadedFile() file: UploadedFileShape,
  ): Promise<AttachmentSummary> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.uploadAttachment(contact.sub, id, file);
  }

  @PortalRoute()
  @Get(":id/attachments")
  listAttachments(
    @Req() request: Request,
    @Param("id") id: string,
  ): Promise<AttachmentSummary[]> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalTicketsService.listAttachments(contact.sub, id);
  }

  /** Returns the presigned S3 URL as JSON, mirroring
   * `AttachmentsController.getDownloadUrl`'s own doc comment for why
   * (never a redirect). */
  @PortalRoute()
  @Get(":id/attachments/:attachmentId/download")
  async getAttachmentDownloadUrl(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
  ): Promise<{ url: string }> {
    const contact = request.user as JwtAccessTokenClaims;
    const url = await this.portalTicketsService.getAttachmentDownloadUrl(
      contact.sub,
      id,
      attachmentId,
    );
    return { url };
  }
}
