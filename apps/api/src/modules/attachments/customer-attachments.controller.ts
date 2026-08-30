import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type {
  CustomerAttachmentSummary,
  UploadedFile as UploadedFileShape,
} from "./attachments.service";
import { AttachmentsService } from "./attachments.service";

/**
 * Story 67 — mirrors `AttachmentsController` exactly (route shape,
 * `FileInterceptor`, JSON-download-URL response), scoped to `Customer`
 * instead of `Ticket`. Registered in the same `AttachmentsModule` —
 * mirrors `NotificationsModule`'s own precedent of hosting two distinct
 * controllers over one shared service/module. `customer:update` gates
 * upload, `customer:read` gates list/download — no new permission.
 */
@ApiTags("customers")
@ApiBearerAuth()
@Controller("customers/:id/attachments")
export class CustomerAttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @RequirePermissions("customer:update")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  create(
    @Param("id") customerId: string,
    @UploadedFile() file: UploadedFileShape,
  ): Promise<CustomerAttachmentSummary> {
    return this.attachmentsService.uploadCustomerAttachment(customerId, file);
  }

  @Get()
  @RequirePermissions("customer:read")
  list(@Param("id") customerId: string): Promise<CustomerAttachmentSummary[]> {
    return this.attachmentsService.listCustomerAttachments(customerId);
  }

  @Get(":attachmentId/download")
  @RequirePermissions("customer:read")
  async getDownloadUrl(
    @Param("id") customerId: string,
    @Param("attachmentId") attachmentId: string,
  ): Promise<{ url: string }> {
    const url = await this.attachmentsService.getCustomerAttachmentDownloadUrl(
      customerId,
      attachmentId,
    );
    return { url };
  }
}
