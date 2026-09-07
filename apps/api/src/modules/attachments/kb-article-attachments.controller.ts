import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type {
  KbArticleAttachmentSummary,
  UploadedFile as UploadedFileShape,
} from "./attachments.service";
import { AttachmentsService } from "./attachments.service";

/**
 * RM-28 — mirrors `CustomerAttachmentsController` exactly (route shape,
 * `FileInterceptor`, JSON-download-URL response), scoped to a Knowledge
 * Base article instead of a `Customer`. Registered in the same
 * `AttachmentsModule` — mirrors that module's own "one module hosts
 * several entity-attachment controllers over one shared service" precedent.
 * No new permission: `kb:update` gates upload, `kb:read` gates
 * list/download — the same mapping this codebase already uses for every
 * other attachment sub-resource.
 */
@ApiTags("knowledge-base")
@ApiBearerAuth()
@Controller("knowledge-base/articles/:id/attachments")
export class KbArticleAttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @RequirePermissions("kb:update")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  create(
    @Param("id") articleId: string,
    @UploadedFile() file: UploadedFileShape,
  ): Promise<KbArticleAttachmentSummary> {
    return this.attachmentsService.uploadKbArticleAttachment(articleId, file);
  }

  @Get()
  @RequirePermissions("kb:read")
  list(@Param("id") articleId: string): Promise<KbArticleAttachmentSummary[]> {
    return this.attachmentsService.listKbArticleAttachments(articleId);
  }

  @Get(":attachmentId/download")
  @RequirePermissions("kb:read")
  async getDownloadUrl(
    @Param("id") articleId: string,
    @Param("attachmentId") attachmentId: string,
  ): Promise<{ url: string }> {
    const url = await this.attachmentsService.getKbArticleAttachmentDownloadUrl(
      articleId,
      attachmentId,
    );
    return { url };
  }
}
