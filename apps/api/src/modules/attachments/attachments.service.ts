import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { S3StorageService } from "./s3-storage.service";
import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from "./attachment-limits";

export interface AttachmentSummary {
  id: string;
  ticketId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedByUserId: string;
  createdAt: Date;
}

export interface UploadedFile {
  originalname: string;
  size: number;
  mimetype: string;
  buffer: Buffer;
}

/**
 * Story 66 — see docs/architecture/03-domain-boundaries.md ("Customer
 * Management" owns "attachment metadata"). Ticket branch/existence
 * scoping is a direct `this.prisma.ticket.findFirst` read, not an import
 * of `TicketsService` — mirrors `TicketCsatResponse`'s own disclosed
 * "scoped through the Ticket relation" convention and avoids a circular
 * module import between `TicketsModule` and this new module.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly s3Storage: S3StorageService,
  ) {}

  async uploadAttachment(ticketId: string, file: UploadedFile): Promise<AttachmentSummary> {
    await this.findTicketInScope(ticketId);

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds the ${MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)}MB size limit`,
      );
    }
    if (!(ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed`);
    }

    // Server-generated key — never derived from the client-supplied
    // filename (plan Security risks/mitigations: "no path/key injection").
    const key = `tickets/${ticketId}/${randomUUID()}`;
    await this.s3Storage.uploadObject(key, file.buffer, file.mimetype);

    const uploadedByUserId = this.requireAuthenticatedUserId();
    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        key,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedByUserId,
      },
    });
    return toAttachmentSummary(attachment);
  }

  async listAttachments(ticketId: string): Promise<AttachmentSummary[]> {
    await this.findTicketInScope(ticketId);
    const attachments = await this.prisma.ticketAttachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
    });
    return attachments.map(toAttachmentSummary);
  }

  async getDownloadUrl(ticketId: string, attachmentId: string): Promise<string> {
    await this.findTicketInScope(ticketId);
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, ticketId },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    return this.s3Storage.getPresignedDownloadUrl(attachment.key);
  }

  private async findTicketInScope(id: string): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }
    return ticket;
  }

  /** Every route that uploads an attachment sits behind `AuthGuard`, so
   * `TenantContext.userId` is always populated in practice; this only
   * guards the invariant, mirroring `TicketsService`'s own identical
   * `requireAuthenticatedUserId` convention. */
  private requireAuthenticatedUserId(): string {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no authenticated user on this request");
    }
    return userId;
  }
}

function toAttachmentSummary(attachment: {
  id: string;
  ticketId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedByUserId: string;
  createdAt: Date;
}): AttachmentSummary {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    filename: attachment.filename,
    size: attachment.size,
    mimeType: attachment.mimeType,
    uploadedByUserId: attachment.uploadedByUserId,
    createdAt: attachment.createdAt,
  };
}
