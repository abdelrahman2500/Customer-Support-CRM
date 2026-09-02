import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AttachmentsService } from "./attachments.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";
import type { S3StorageService } from "./s3-storage.service";
import { MAX_ATTACHMENT_SIZE_BYTES } from "./attachment-limits";

function buildPrismaMock() {
  return {
    ticket: {
      findFirst: vi.fn(),
    },
    ticketAttachment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
    },
    customerAttachment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
}

function buildTenantContextMock(branchId: string | null = "branch-1", userId: string | null = "user-1") {
  return {
    userId,
    requireBranchScope: vi.fn(() => {
      if (!branchId) {
        throw new Error("TenantContext: no active branch on this request");
      }
      return { branchId };
    }),
  };
}

function buildS3StorageMock() {
  return {
    uploadObject: vi.fn(),
    getPresignedDownloadUrl: vi.fn(),
  };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
  s3Mock: ReturnType<typeof buildS3StorageMock>,
): AttachmentsService {
  return new AttachmentsService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
    s3Mock as unknown as S3StorageService,
  );
}

describe("AttachmentsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let s3Storage: ReturnType<typeof buildS3StorageMock>;
  let service: AttachmentsService;

  const validFile = {
    originalname: "screenshot.png",
    size: 1024,
    mimetype: "image/png",
    buffer: Buffer.from("fake-image-bytes"),
  };

  const attachmentRow = {
    id: "attachment-1",
    ticketId: "ticket-1",
    key: "tickets/ticket-1/some-uuid",
    filename: "screenshot.png",
    size: 1024,
    mimeType: "image/png",
    uploadedByUserId: "user-1",
    uploadedByContactId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    s3Storage = buildS3StorageMock();
    service = createService(prisma, tenantContext, s3Storage);
  });

  describe("uploadAttachment", () => {
    it("throws NotFoundException for an unknown/out-of-scope ticket id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.uploadAttachment("missing-id", validFile)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(s3Storage.uploadObject).not.toHaveBeenCalled();
    });

    it("rejects a file exceeding the size limit before any S3 call", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });

      await expect(
        service.uploadAttachment("ticket-1", {
          ...validFile,
          size: MAX_ATTACHMENT_SIZE_BYTES + 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(s3Storage.uploadObject).not.toHaveBeenCalled();
      expect(prisma.ticketAttachment.create).not.toHaveBeenCalled();
    });

    it("rejects a disallowed MIME type before any S3 call", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });

      await expect(
        service.uploadAttachment("ticket-1", { ...validFile, mimetype: "application/x-msdownload" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(s3Storage.uploadObject).not.toHaveBeenCalled();
      expect(prisma.ticketAttachment.create).not.toHaveBeenCalled();
    });

    it("uploads to S3 with a server-generated key and records the metadata row", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.create.mockResolvedValue(attachmentRow);

      const result = await service.uploadAttachment("ticket-1", validFile);

      expect(s3Storage.uploadObject).toHaveBeenCalledWith(
        expect.stringMatching(/^tickets\/ticket-1\//),
        validFile.buffer,
        "image/png",
      );
      expect(prisma.ticketAttachment.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          key: expect.stringMatching(/^tickets\/ticket-1\//),
          filename: "screenshot.png",
          size: 1024,
          mimeType: "image/png",
          uploadedByUserId: "user-1",
        },
      });
      // `AttachmentSummary` never exposes the raw S3 `key` to the caller.
      const { key: _key, ...expectedSummary } = attachmentRow;
      expect(result).toEqual(expectedSummary);
    });

    it("never derives the S3 key from the client-supplied filename", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.create.mockResolvedValue(attachmentRow);

      await service.uploadAttachment("ticket-1", {
        ...validFile,
        originalname: "../../etc/passwd",
      });

      const [key] = s3Storage.uploadObject.mock.calls[0] as [string, Buffer, string];
      expect(key).not.toContain("passwd");
      expect(key).not.toContain("..");
    });
  });

  describe("listAttachments", () => {
    it("throws NotFoundException for an unknown/out-of-scope ticket id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.listAttachments("missing-id")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns [] for a ticket with no attachments", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.findMany.mockResolvedValue([]);

      const result = await service.listAttachments("ticket-1");

      expect(result).toEqual([]);
    });

    it("scopes the query to the ticket, ordered createdAt desc", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.findMany.mockResolvedValue([attachmentRow]);

      const result = await service.listAttachments("ticket-1");

      expect(prisma.ticketAttachment.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        orderBy: { createdAt: "desc" },
      });
      const { key: _key, ...expectedSummary } = attachmentRow;
      expect(result).toEqual([expectedSummary]);
    });
  });

  describe("getDownloadUrl", () => {
    it("throws NotFoundException for an unknown/out-of-scope ticket id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getDownloadUrl("missing-id", "attachment-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws NotFoundException for an unknown attachment id", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.findFirst.mockResolvedValue(null);

      await expect(
        service.getDownloadUrl("ticket-1", "missing-attachment"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns a presigned URL for the attachment's S3 key", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.findFirst.mockResolvedValue(attachmentRow);
      s3Storage.getPresignedDownloadUrl.mockResolvedValue("https://minio.local/presigned-url");

      const result = await service.getDownloadUrl("ticket-1", "attachment-1");

      expect(prisma.ticketAttachment.findFirst).toHaveBeenCalledWith({
        where: { id: "attachment-1", ticketId: "ticket-1" },
      });
      expect(s3Storage.getPresignedDownloadUrl).toHaveBeenCalledWith(attachmentRow.key);
      expect(result).toBe("https://minio.local/presigned-url");
    });
  });

  // Story 103 — Customer Portal: Ticket Attachment Upload. Mirrors every
  // agent-side ticket test above, scoped by customerId instead of branchId,
  // and setting uploadedByContactId instead of uploadedByUserId.
  describe("uploadAttachmentForCustomer", () => {
    it("throws NotFoundException for a ticket not owned by this customer", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadAttachmentForCustomer("ticket-1", "customer-1", "contact-1", validFile),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: "ticket-1", customerId: "customer-1" },
        select: { id: true },
      });
      expect(s3Storage.uploadObject).not.toHaveBeenCalled();
    });

    it("rejects a file exceeding the size limit before any S3 call", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });

      await expect(
        service.uploadAttachmentForCustomer("ticket-1", "customer-1", "contact-1", {
          ...validFile,
          size: MAX_ATTACHMENT_SIZE_BYTES + 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(s3Storage.uploadObject).not.toHaveBeenCalled();
      expect(prisma.ticketAttachment.create).not.toHaveBeenCalled();
    });

    it("uploads to S3 and records the metadata row with uploadedByContactId, never uploadedByUserId", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.create.mockResolvedValue({
        ...attachmentRow,
        uploadedByUserId: null,
        uploadedByContactId: "contact-1",
      });

      const result = await service.uploadAttachmentForCustomer(
        "ticket-1",
        "customer-1",
        "contact-1",
        validFile,
      );

      expect(s3Storage.uploadObject).toHaveBeenCalledWith(
        expect.stringMatching(/^tickets\/ticket-1\//),
        validFile.buffer,
        "image/png",
      );
      expect(prisma.ticketAttachment.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          key: expect.stringMatching(/^tickets\/ticket-1\//),
          filename: "screenshot.png",
          size: 1024,
          mimeType: "image/png",
          uploadedByContactId: "contact-1",
        },
      });
      expect(result).toMatchObject({ uploadedByUserId: null, uploadedByContactId: "contact-1" });
    });
  });

  describe("listAttachmentsForCustomer", () => {
    it("throws NotFoundException for a ticket not owned by this customer", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.listAttachmentsForCustomer("ticket-1", "customer-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("scopes the query to the ticket, ordered createdAt desc — same list every agent sees", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.findMany.mockResolvedValue([attachmentRow]);

      const result = await service.listAttachmentsForCustomer("ticket-1", "customer-1");

      expect(prisma.ticketAttachment.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        orderBy: { createdAt: "desc" },
      });
      const { key: _key, ...expectedSummary } = attachmentRow;
      expect(result).toEqual([expectedSummary]);
    });
  });

  describe("getDownloadUrlForCustomer", () => {
    it("throws NotFoundException for a ticket not owned by this customer", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.getDownloadUrlForCustomer("ticket-1", "customer-1", "attachment-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws NotFoundException for an unknown attachment id", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.findFirst.mockResolvedValue(null);

      await expect(
        service.getDownloadUrlForCustomer("ticket-1", "customer-1", "missing-attachment"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns a presigned URL for the attachment's S3 key", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketAttachment.findFirst.mockResolvedValue(attachmentRow);
      s3Storage.getPresignedDownloadUrl.mockResolvedValue("https://minio.local/presigned-url");

      const result = await service.getDownloadUrlForCustomer(
        "ticket-1",
        "customer-1",
        "attachment-1",
      );

      expect(prisma.ticketAttachment.findFirst).toHaveBeenCalledWith({
        where: { id: "attachment-1", ticketId: "ticket-1" },
      });
      expect(s3Storage.getPresignedDownloadUrl).toHaveBeenCalledWith(attachmentRow.key);
      expect(result).toBe("https://minio.local/presigned-url");
    });
  });

  // Story 67 — Customer Attachments. Mirrors every ticket-side test above.
  describe("uploadCustomerAttachment", () => {
    it("throws NotFoundException for an unknown/out-of-scope customer id", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadCustomerAttachment("missing-id", validFile),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(s3Storage.uploadObject).not.toHaveBeenCalled();
    });

    it("rejects a file exceeding the size limit before any S3 call", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });

      await expect(
        service.uploadCustomerAttachment("customer-1", {
          ...validFile,
          size: MAX_ATTACHMENT_SIZE_BYTES + 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(s3Storage.uploadObject).not.toHaveBeenCalled();
      expect(prisma.customerAttachment.create).not.toHaveBeenCalled();
    });

    it("rejects a disallowed MIME type before any S3 call", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });

      await expect(
        service.uploadCustomerAttachment("customer-1", {
          ...validFile,
          mimetype: "application/x-msdownload",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(s3Storage.uploadObject).not.toHaveBeenCalled();
      expect(prisma.customerAttachment.create).not.toHaveBeenCalled();
    });

    it("uploads to S3 with a server-generated key and records the metadata row", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.customerAttachment.create.mockResolvedValue({
        ...attachmentRow,
        id: "customer-attachment-1",
        customerId: "customer-1",
        key: "customers/customer-1/some-uuid",
      });

      const result = await service.uploadCustomerAttachment("customer-1", validFile);

      expect(s3Storage.uploadObject).toHaveBeenCalledWith(
        expect.stringMatching(/^customers\/customer-1\//),
        validFile.buffer,
        "image/png",
      );
      expect(prisma.customerAttachment.create).toHaveBeenCalledWith({
        data: {
          customerId: "customer-1",
          key: expect.stringMatching(/^customers\/customer-1\//),
          filename: "screenshot.png",
          size: 1024,
          mimeType: "image/png",
          uploadedByUserId: "user-1",
        },
      });
      expect(result).toMatchObject({ id: "customer-attachment-1", customerId: "customer-1" });
      expect(result).not.toHaveProperty("key");
    });
  });

  describe("listCustomerAttachments", () => {
    it("throws NotFoundException for an unknown/out-of-scope customer id", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.listCustomerAttachments("missing-id")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("scopes the query to the customer, ordered createdAt desc", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.customerAttachment.findMany.mockResolvedValue([]);

      await service.listCustomerAttachments("customer-1");

      expect(prisma.customerAttachment.findMany).toHaveBeenCalledWith({
        where: { customerId: "customer-1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("getCustomerAttachmentDownloadUrl", () => {
    it("throws NotFoundException for an unknown/out-of-scope customer id", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.getCustomerAttachmentDownloadUrl("missing-id", "attachment-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws NotFoundException for an unknown attachment id", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.customerAttachment.findFirst.mockResolvedValue(null);

      await expect(
        service.getCustomerAttachmentDownloadUrl("customer-1", "missing-attachment"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns a presigned URL for the attachment's S3 key", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.customerAttachment.findFirst.mockResolvedValue({
        ...attachmentRow,
        customerId: "customer-1",
      });
      s3Storage.getPresignedDownloadUrl.mockResolvedValue("https://minio.local/presigned-url");

      const result = await service.getCustomerAttachmentDownloadUrl("customer-1", "attachment-1");

      expect(prisma.customerAttachment.findFirst).toHaveBeenCalledWith({
        where: { id: "attachment-1", customerId: "customer-1" },
      });
      expect(result).toBe("https://minio.local/presigned-url");
    });
  });
});
