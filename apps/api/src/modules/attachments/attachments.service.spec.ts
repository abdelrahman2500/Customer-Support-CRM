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
});
