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
  /** Story 103 — nullable: exactly one of `uploadedByUserId`/
   * `uploadedByContactId` is ever populated, mirroring `ChannelMessage`'s
   * own `senderUserId`/`senderContactId` shape. */
  uploadedByUserId: string | null;
  uploadedByContactId: string | null;
  createdAt: Date;
}

/** Story 67 — identical shape to `AttachmentSummary`, `customerId` instead
 * of `ticketId`. */
export interface CustomerAttachmentSummary {
  id: string;
  customerId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedByUserId: string;
  createdAt: Date;
}

/** RM-28 — identical shape to `CustomerAttachmentSummary`, `articleId`
 * instead of `customerId`. */
export interface KbArticleAttachmentSummary {
  id: string;
  articleId: string;
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
 *
 * Story 67 — the customer-side methods below mirror the ticket-side ones
 * exactly (same `validateFile` check, same server-generated-key
 * convention, same presigned-URL-as-JSON download shape), backed by a
 * separate `CustomerAttachment` model rather than a polymorphic
 * entity-type table (see that model's own doc comment).
 *
 * RM-28 — the Knowledge Base article-side methods further below mirror
 * the customer-side ones exactly (agent-only upload, same shape), backed
 * by `KnowledgeBaseArticleAttachment`.
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
    this.validateFile(file);

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

  // ---------------------------------------------------------------------
  // Story 103 — Customer Portal: Ticket Attachment Upload. Mirrors the
  // three ticket-side methods above exactly, except the ownership check
  // (`findTicketInCustomerScope`, not `findTicketInScope`) and the FK set
  // on create (`uploadedByContactId`, not `uploadedByUserId`). None of the
  // agent-facing methods above are touched.
  // ---------------------------------------------------------------------

  async uploadAttachmentForCustomer(
    ticketId: string,
    customerId: string,
    contactId: string,
    file: UploadedFile,
  ): Promise<AttachmentSummary> {
    await this.findTicketInCustomerScope(ticketId, customerId);
    this.validateFile(file);

    const key = `tickets/${ticketId}/${randomUUID()}`;
    await this.s3Storage.uploadObject(key, file.buffer, file.mimetype);

    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        key,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedByContactId: contactId,
      },
    });
    return toAttachmentSummary(attachment);
  }

  async listAttachmentsForCustomer(
    ticketId: string,
    customerId: string,
  ): Promise<AttachmentSummary[]> {
    await this.findTicketInCustomerScope(ticketId, customerId);
    const attachments = await this.prisma.ticketAttachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
    });
    return attachments.map(toAttachmentSummary);
  }

  async getDownloadUrlForCustomer(
    ticketId: string,
    customerId: string,
    attachmentId: string,
  ): Promise<string> {
    await this.findTicketInCustomerScope(ticketId, customerId);
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, ticketId },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    return this.s3Storage.getPresignedDownloadUrl(attachment.key);
  }

  // ---------------------------------------------------------------------
  // Story 67 — Customer Attachments. None of the ticket-side methods
  // above are touched.
  // ---------------------------------------------------------------------

  async uploadCustomerAttachment(
    customerId: string,
    file: UploadedFile,
  ): Promise<CustomerAttachmentSummary> {
    await this.findCustomerInScope(customerId);
    this.validateFile(file);

    const key = `customers/${customerId}/${randomUUID()}`;
    await this.s3Storage.uploadObject(key, file.buffer, file.mimetype);

    const uploadedByUserId = this.requireAuthenticatedUserId();
    const attachment = await this.prisma.customerAttachment.create({
      data: {
        customerId,
        key,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedByUserId,
      },
    });
    return toCustomerAttachmentSummary(attachment);
  }

  async listCustomerAttachments(customerId: string): Promise<CustomerAttachmentSummary[]> {
    await this.findCustomerInScope(customerId);
    const attachments = await this.prisma.customerAttachment.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    return attachments.map(toCustomerAttachmentSummary);
  }

  async getCustomerAttachmentDownloadUrl(
    customerId: string,
    attachmentId: string,
  ): Promise<string> {
    await this.findCustomerInScope(customerId);
    const attachment = await this.prisma.customerAttachment.findFirst({
      where: { id: attachmentId, customerId },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    return this.s3Storage.getPresignedDownloadUrl(attachment.key);
  }

  // ---------------------------------------------------------------------
  // RM-28 — Knowledge Base Article Attachments. Mirrors the Story 67
  // customer-side methods above exactly (same `validateFile` check, same
  // server-generated-key convention, same presigned-URL-as-JSON download
  // shape), backed by `KnowledgeBaseArticleAttachment` — agent-only
  // upload, same as `CustomerAttachment` (no portal contact ever authors a
  // KB article). None of the methods above are touched.
  // ---------------------------------------------------------------------

  async uploadKbArticleAttachment(
    articleId: string,
    file: UploadedFile,
  ): Promise<KbArticleAttachmentSummary> {
    await this.findArticleInScope(articleId);
    this.validateFile(file);

    const key = `knowledge-base-articles/${articleId}/${randomUUID()}`;
    await this.s3Storage.uploadObject(key, file.buffer, file.mimetype);

    const uploadedByUserId = this.requireAuthenticatedUserId();
    const attachment = await this.prisma.knowledgeBaseArticleAttachment.create({
      data: {
        articleId,
        key,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedByUserId,
      },
    });
    return toKbArticleAttachmentSummary(attachment);
  }

  async listKbArticleAttachments(articleId: string): Promise<KbArticleAttachmentSummary[]> {
    await this.findArticleInScope(articleId);
    const attachments = await this.prisma.knowledgeBaseArticleAttachment.findMany({
      where: { articleId },
      orderBy: { createdAt: "desc" },
    });
    return attachments.map(toKbArticleAttachmentSummary);
  }

  async getKbArticleAttachmentDownloadUrl(
    articleId: string,
    attachmentId: string,
  ): Promise<string> {
    await this.findArticleInScope(articleId);
    const attachment = await this.prisma.knowledgeBaseArticleAttachment.findFirst({
      where: { id: attachmentId, articleId },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    return this.s3Storage.getPresignedDownloadUrl(attachment.key);
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  /** Size/MIME allow-list, enforced before any S3 call — shared by both
   * the ticket- and customer-side upload methods (plan Security risks/
   * mitigations: "never trust the browser"). */
  private validateFile(file: UploadedFile): void {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds the ${MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)}MB size limit`,
      );
    }
    if (!(ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed`);
    }
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

  /** Story 103 — mirrors `TicketsService.findTicketInCustomerScope`'s
   * exact shape (`this.prisma.ticket.findFirst({ where: { id, customerId
   * } })`, no branch scoping needed — a `Customer` belongs to exactly one
   * branch already). Not a call to `TicketsService` itself: this service
   * deliberately avoids that import (see this file's own Story 66 doc
   * comment) to sidestep a module dependency it doesn't otherwise need. */
  private async findTicketInCustomerScope(
    id: string,
    customerId: string,
  ): Promise<{ id: string }> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, customerId },
      select: { id: true },
    });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }
    return ticket;
  }

  /** Mirrors `findTicketInScope` exactly, scoped to `Customer` instead. */
  private async findCustomerInScope(id: string): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const customer = await this.prisma.customer.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }

  /** RM-28 — mirrors `findCustomerInScope` exactly, scoped to
   * `KnowledgeBaseArticle` instead. */
  private async findArticleInScope(id: string): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const article = await this.prisma.knowledgeBaseArticle.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!article) {
      throw new NotFoundException("Article not found");
    }
    return article;
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
  uploadedByUserId: string | null;
  uploadedByContactId: string | null;
  createdAt: Date;
}): AttachmentSummary {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    filename: attachment.filename,
    size: attachment.size,
    mimeType: attachment.mimeType,
    uploadedByUserId: attachment.uploadedByUserId,
    uploadedByContactId: attachment.uploadedByContactId,
    createdAt: attachment.createdAt,
  };
}

function toCustomerAttachmentSummary(attachment: {
  id: string;
  customerId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedByUserId: string;
  createdAt: Date;
}): CustomerAttachmentSummary {
  return {
    id: attachment.id,
    customerId: attachment.customerId,
    filename: attachment.filename,
    size: attachment.size,
    mimeType: attachment.mimeType,
    uploadedByUserId: attachment.uploadedByUserId,
    createdAt: attachment.createdAt,
  };
}

function toKbArticleAttachmentSummary(attachment: {
  id: string;
  articleId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedByUserId: string;
  createdAt: Date;
}): KbArticleAttachmentSummary {
  return {
    id: attachment.id,
    articleId: attachment.articleId,
    filename: attachment.filename,
    size: attachment.size,
    mimeType: attachment.mimeType,
    uploadedByUserId: attachment.uploadedByUserId,
    createdAt: attachment.createdAt,
  };
}
