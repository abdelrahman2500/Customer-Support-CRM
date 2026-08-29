import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CustomersService } from "./customers.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    customer: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contactRefreshToken: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: unknown) => unknown)(undefined);
    }),
  };
}

function buildTenantContextMock(branchId: string | null = "branch-1") {
  return {
    requireBranchScope: vi.fn(() => {
      if (!branchId) {
        throw new Error("TenantContext: no active branch on this request");
      }
      return { branchId };
    }),
  };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
): CustomersService {
  return new CustomersService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

/** Mimics the shape `PrismaClientKnownRequestError` exposes at `.code`. */
function buildUniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: "P2002",
    message: "Unique constraint failed",
  }) as Prisma.PrismaClientKnownRequestError;
}

describe("CustomersService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: CustomersService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("createCustomer", () => {
    it("assigns branchId from TenantContext, not from the DTO", async () => {
      prisma.customer.create.mockResolvedValue({
        id: "customer-1",
        branchId: "branch-1",
        displayName: "Acme Corp",
        isActive: true,
      });

      const result = await service.createCustomer({ displayName: "Acme Corp" });

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: { branchId: "branch-1", displayName: "Acme Corp" },
      });
      expect(result).toEqual({ id: "customer-1", displayName: "Acme Corp", isActive: true });
    });
  });

  describe("listCustomers", () => {
    it("scopes the query to the caller's active branch", async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: "customer-1", displayName: "Acme Corp", isActive: true },
      ]);

      const result = await service.listCustomers();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
      );
      expect(result).toEqual([{ id: "customer-1", displayName: "Acme Corp", isActive: true }]);
    });
  });

  describe("getCustomer", () => {
    it("throws NotFoundException when the customer isn't found in scope", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.getCustomer("missing-id")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: "missing-id", branchId: "branch-1" },
        include: { contacts: true },
      });
    });

    it("returns an empty contacts array when the customer has none", async () => {
      prisma.customer.findFirst.mockResolvedValue({
        id: "customer-1",
        displayName: "Acme Corp",
        isActive: true,
        contacts: [],
      });

      const result = await service.getCustomer("customer-1");

      expect(result).toEqual({
        id: "customer-1",
        displayName: "Acme Corp",
        isActive: true,
        contacts: [],
      });
    });
  });

  describe("updateCustomer", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCustomer("missing-id", { displayName: "New Name" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it("only includes fields present in the DTO", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });

      await service.updateCustomer("customer-1", { isActive: false });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: "customer-1" },
        data: { isActive: false },
      });
    });
  });

  describe("listContacts", () => {
    it("throws NotFoundException when the parent customer isn't in scope", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.listContacts("missing-customer")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.contact.findMany).not.toHaveBeenCalled();
    });

    it("scopes contacts to the parent customer once it's confirmed in scope", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findMany.mockResolvedValue([
        { id: "contact-1", fullName: "Jane Doe", email: "jane@example.com", phone: null, isPrimary: true },
      ]);

      const result = await service.listContacts("customer-1");

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: "customer-1" } }),
      );
      expect(result).toEqual([
        { id: "contact-1", fullName: "Jane Doe", email: "jane@example.com", phone: null, isPrimary: true },
      ]);
    });
  });

  describe("createContact", () => {
    const dto = { fullName: "Jane Doe" };

    it("throws NotFoundException when the parent customer isn't in scope", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.createContact("missing-customer", dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.contact.create).not.toHaveBeenCalled();
    });

    it("defaults email/phone to null and isPrimary to false when omitted", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.create.mockResolvedValue({
        id: "contact-1",
        fullName: "Jane Doe",
        email: null,
        phone: null,
        isPrimary: false,
      });

      const result = await service.createContact("customer-1", dto);

      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: {
          customerId: "customer-1",
          fullName: "Jane Doe",
          email: null,
          phone: null,
          isPrimary: false,
        },
      });
      expect(result).toEqual({
        id: "contact-1",
        fullName: "Jane Doe",
        email: null,
        phone: null,
        isPrimary: false,
      });
    });

    it("translates a P2002 unique-constraint violation into ConflictException", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(
        service.createContact("customer-1", { fullName: "Jane Doe", email: "jane@example.com" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("updateContact", () => {
    it("throws NotFoundException when the parent customer isn't in scope", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.updateContact("missing-customer", "contact-1", { fullName: "X" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contact.findFirst).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an unknown contact id within an in-scope customer", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.updateContact("customer-1", "missing-contact", { fullName: "X" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contact.update).not.toHaveBeenCalled();
    });

    it("translates a P2002 unique-constraint violation into ConflictException", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst.mockResolvedValue({ id: "contact-1", email: "old@example.com" });
      prisma.contact.update.mockRejectedValue(buildUniqueConstraintError());

      await expect(
        service.updateContact("customer-1", "contact-1", { email: "taken@example.com" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("only includes fields present in the DTO", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst.mockResolvedValue({ id: "contact-1", email: "jane@example.com" });

      await service.updateContact("customer-1", "contact-1", { isPrimary: true });

      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: "contact-1" },
        data: { isPrimary: true },
      });
    });
  });

  describe("setContactPortalPassword", () => {
    it("throws NotFoundException when the contact doesn't belong to the customer", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.setContactPortalPassword("customer-1", "missing-contact", {
          newPassword: "a-strong-password",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contact.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when the contact has no email on file", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst.mockResolvedValueOnce({ id: "contact-1", email: null });

      await expect(
        service.setContactPortalPassword("customer-1", "contact-1", {
          newPassword: "a-strong-password",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.contact.update).not.toHaveBeenCalled();
    });

    it("throws ConflictException when another contact already has portal access with the same email", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst
        .mockResolvedValueOnce({ id: "contact-1", email: "jane@example.com" })
        .mockResolvedValueOnce({ id: "contact-2" });

      await expect(
        service.setContactPortalPassword("customer-1", "contact-1", {
          newPassword: "a-strong-password",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.contact.findFirst).toHaveBeenNthCalledWith(2, {
        where: { email: "jane@example.com", passwordHash: { not: null }, id: { not: "contact-1" } },
      });
      expect(prisma.contact.update).not.toHaveBeenCalled();
    });

    it("sets the password hash and revokes every existing refresh token", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst
        .mockResolvedValueOnce({ id: "contact-1", email: "jane@example.com" })
        .mockResolvedValueOnce(null);
      prisma.contact.update.mockResolvedValue({ id: "contact-1" });
      prisma.contactRefreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.setContactPortalPassword("customer-1", "contact-1", {
        newPassword: "a-strong-password",
      });

      expect(result).toEqual({ id: "contact-1" });
      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: "contact-1" },
        data: { passwordHash: expect.any(String) },
      });
      expect(prisma.contactRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { contactId: "contact-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
