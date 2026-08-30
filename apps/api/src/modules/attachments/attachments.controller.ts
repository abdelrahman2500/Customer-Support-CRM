import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type { AttachmentSummary, UploadedFile as UploadedFileShape } from "./attachments.service";
import { AttachmentsService } from "./attachments.service";

/**
 * Story 66 — see docs/architecture/04-data-and-multitenancy.md. Mounted
 * under `tickets/:id/attachments`, not `attachments/*` — mirrors every
 * other ticket sub-resource in this codebase (`:id/notes`, `:id/history`,
 * `:id/csat`) despite this controller living in its own module (plan
 * Design item 2). No new permission: `ticket:update` gates the upload
 * (a mutation), `ticket:read` gates list/download — the exact mapping
 * `TicketsController`'s own note/history sub-resources already use.
 */
@ApiTags("tickets")
@ApiBearerAuth()
@Controller("tickets/:id/attachments")
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @RequirePermissions("ticket:update")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  create(
    @Param("id") ticketId: string,
    @UploadedFile() file: UploadedFileShape,
  ): Promise<AttachmentSummary> {
    return this.attachmentsService.uploadAttachment(ticketId, file);
  }

  @Get()
  @RequirePermissions("ticket:read")
  list(@Param("id") ticketId: string): Promise<AttachmentSummary[]> {
    return this.attachmentsService.listAttachments(ticketId);
  }

  /**
   * Returns the short-lived presigned S3 URL as JSON, rather than a `302`
   * redirect — a browser `fetch()` cannot reliably read a `Location`
   * header off a followed cross-origin redirect (an "opaque redirect" in
   * "manual" mode exposes no headers at all), and a plain `<a href>`
   * cannot attach the `Authorization` bearer header a redirect endpoint
   * would need to pass `AuthGuard` in the first place. Returning the URL
   * as data lets the frontend make one authenticated JSON call, then
   * perform a plain top-level browser navigation to the presigned URL —
   * which is not subject to CORS at all (unlike a script-initiated fetch
   * read), so no MinIO/S3 CORS configuration is needed either. The API
   * still never proxies the binary itself (plan Design item 4).
   */
  @Get(":attachmentId/download")
  @RequirePermissions("ticket:read")
  async getDownloadUrl(
    @Param("id") ticketId: string,
    @Param("attachmentId") attachmentId: string,
  ): Promise<{ url: string }> {
    const url = await this.attachmentsService.getDownloadUrl(ticketId, attachmentId);
    return { url };
  }
}
