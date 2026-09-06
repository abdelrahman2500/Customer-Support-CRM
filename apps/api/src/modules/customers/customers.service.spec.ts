import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CustomersService } from "./customers.service";
import type { CustomerSummary } from "./customers.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    branch: {
      findFirst: vi.fn(),
    },
    customer: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      // Story S-8e — see the matching note in `tickets.service.spec.ts`.
      count: vi.fn().mockResolvedValue(0),
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
    customerNote: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: unknown) => unknown)(undefined);
    }),
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

  describe("listCustomerOptions", () => {
    it("scopes to the caller's branch and returns only id + displayName", async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: "customer-2", displayName: "Acme Corp" },
        { id: "customer-1", displayName: "Zenith Ltd" },
      ]);

      const result = await service.listCustomerOptions();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        select: { id: true, displayName: true },
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
      });
      expect(result).toEqual([
        { id: "customer-2", displayName: "Acme Corp" },
        { id: "customer-1", displayName: "Zenith Ltd" },
      ]);
    });

    it("takes no page/pageSize: a picker has to be able to offer every option", async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.listCustomerOptions();

      // Story S-8d — the whole reason this endpoint exists separately from
      // `GET /customers`. If it ever grew `skip`/`take`, customers past
      // the first page would become unselectable when creating a ticket.
      const args = prisma.customer.findMany.mock.calls[0]![0];
      expect(args).not.toHaveProperty("skip");
      expect(args).not.toHaveProperty("take");
    });

    it("does not filter out inactive customers", async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.listCustomerOptions();

      // Matches what the picker showed before this endpoint existed, so no
      // existing ticket-creation flow loses an option it used to have.
      expect(prisma.customer.findMany.mock.calls[0]![0].where).toEqual({ branchId: "branch-1" });
    });

    it("refuses to run without an active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.listCustomerOptions()).rejects.toThrow(/no active branch/);
      expect(prisma.customer.findMany).not.toHaveBeenCalled();
    });
  });

  describe("listCustomers", () => {
    /** Story S-8e — the default page: `asc` is now queried as `asc` (Story
     * 106 had to query `desc` and reverse), with `id` as the tiebreaker. */
    const DEFAULT_PAGE = {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: 0,
      take: 25,
    };

    it("scopes the query to the caller's active branch", async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: "customer-1", displayName: "Acme Corp", isActive: true },
      ]);
      prisma.customer.count.mockResolvedValue(1);

      const result = await service.listCustomers();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        ...DEFAULT_PAGE,
      });
      expect(result).toEqual({
        items: [{ id: "customer-1", displayName: "Acme Corp", isActive: true }],
        total: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      });
    });

    // Story 101 — search/isActive/sort query params.
    it("omitting every query param asks for the first page, unfiltered", async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.listCustomers({});

      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        ...DEFAULT_PAGE,
      });
    });

    it("filters by displayName, case-insensitively, when search is given", async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.listCustomers({ search: "acme" });

      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: {
          branchId: "branch-1",
          displayName: { contains: "acme", mode: "insensitive" },
        },
        ...DEFAULT_PAGE,
      });
    });

    it("filters by isActive: true", async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.listCustomers({ isActive: "true" });

      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", isActive: true },
        ...DEFAULT_PAGE,
      });
    });

    it("filters by isActive: false", async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.listCustomers({ isActive: "false" });

      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", isActive: false },
        ...DEFAULT_PAGE,
      });
    });

    it("sorts by displayName descending when requested", async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      await service.listCustomers({ sortBy: "displayName", sortDir: "desc" });

      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: [{ displayName: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
      });
    });

    // Story S-8e — pagination, replacing Story 106's 500-row cap.
    describe("pagination (Story S-8e)", () => {
      it("queries the requested direction directly instead of reversing in memory", async () => {
        const older = { id: "customer-older", displayName: "Alpha", isActive: true };
        const newer = { id: "customer-newer", displayName: "Beta", isActive: true };
        // Prisma, asked for `asc`, returns oldest-first - and that is now
        // exactly what is asked for, so the service passes it straight
        // through. Story 106 asked for `desc` and reversed the array,
        // which only reproduced the right list below the cap.
        prisma.customer.findMany.mockResolvedValue([older, newer]);

        const result = await service.listCustomers();

        expect(prisma.customer.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
        );
        expect(result.items.map((c: CustomerSummary) => c.id)).toEqual([
          "customer-older",
          "customer-newer",
        ]);
      });

      it("does not reverse when sortDir is explicitly desc", async () => {
        const older = { id: "customer-older", displayName: "Alpha", isActive: true };
        const newer = { id: "customer-newer", displayName: "Beta", isActive: true };
        prisma.customer.findMany.mockResolvedValue([newer, older]);

        const result = await service.listCustomers({ sortDir: "desc" });

        expect(result.items.map((c: CustomerSummary) => c.id)).toEqual([
          "customer-newer",
          "customer-older",
        ]);
      });

      it("no longer caps the query at a fixed row count", async () => {
        prisma.customer.findMany.mockResolvedValue([]);

        await service.listCustomers({ isActive: "true" });

        // Story 106's unconditional `take: 500` made every row past it
        // unreachable; `take` is now the page size and `skip` reaches the
        // rest.
        const args = prisma.customer.findMany.mock.calls[0]![0];
        expect(args.take).toBe(25);
        expect(args.skip).toBe(0);
      });

      it("translates a page number into the right offset", async () => {
        prisma.customer.findMany.mockResolvedValue([]);

        await service.listCustomers({ page: 3, pageSize: 10 });

        expect(prisma.customer.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 20, take: 10 }),
        );
      });

      it("counts over exactly the same where clause it fetches with", async () => {
        prisma.customer.findMany.mockResolvedValue([]);
        prisma.customer.count.mockResolvedValue(0);

        await service.listCustomers({ search: "acme", isActive: "true" });

        // A `total` counted over a wider scope than `items` would report
        // rows the caller cannot reach - here, customers in another branch.
        const where = {
          branchId: "branch-1",
          displayName: { contains: "acme", mode: "insensitive" },
          isActive: true,
        };
        expect(prisma.customer.count).toHaveBeenCalledWith({ where });
        expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
      });

      it("reports the total and page count from the count query", async () => {
        prisma.customer.findMany.mockResolvedValue([]);
        prisma.customer.count.mockResolvedValue(57);

        const result = await service.listCustomers({ pageSize: 25 });

        expect(result.total).toBe(57);
        expect(result.totalPages).toBe(3);
      });

      it("returns an empty page past the end without losing the metadata", async () => {
        prisma.customer.findMany.mockResolvedValue([]);
        prisma.customer.count.mockResolvedValue(5);

        const result = await service.listCustomers({ page: 99 });

        expect(result).toEqual({ items: [], total: 5, page: 99, pageSize: 25, totalPages: 1 });
      });
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
        {
          id: "contact-1",
          fullName: "Jane Doe",
          email: "jane@example.com",
          phone: null,
          isPrimary: true,
          passwordHash: null,
        },
      ]);

      const result = await service.listContacts("customer-1");

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: "customer-1" } }),
      );
      expect(result).toEqual([
        {
          id: "contact-1",
          fullName: "Jane Doe",
          email: "jane@example.com",
          phone: null,
          isPrimary: true,
          hasPortalAccess: false,
        },
      ]);
    });

    it("reports hasPortalAccess: true for a contact with a password hash set", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findMany.mockResolvedValue([
        {
          id: "contact-1",
          fullName: "Jane Doe",
          email: "jane@example.com",
          phone: null,
          isPrimary: true,
          passwordHash: "hashed",
        },
      ]);

      const result = await service.listContacts("customer-1");

      expect(result[0]).toEqual(
        expect.objectContaining({ id: "contact-1", hasPortalAccess: true }),
      );
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
        passwordHash: null,
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
        hasPortalAccess: false,
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

  describe("findOrCreateContactForWebForm", () => {
    const input = { fullName: "Jane Doe", email: "jane@example.com", phone: "555-0100" };

    it("throws NotFoundException for an unknown branch id", async () => {
      prisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.findOrCreateContactForWebForm("missing-branch", input),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: "missing-branch", isActive: true },
      });
      expect(prisma.contact.findFirst).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an inactive branch (excluded by the isActive filter)", async () => {
      prisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.findOrCreateContactForWebForm("branch-1", input)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("reuses an existing Contact/Customer pair found by (branchId, email)", async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: "branch-1", isActive: true });
      prisma.contact.findFirst.mockResolvedValue({
        id: "contact-1",
        customerId: "customer-1",
        email: "jane@example.com",
      });

      const result = await service.findOrCreateContactForWebForm("branch-1", input);

      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: { email: "jane@example.com", customer: { branchId: "branch-1" } },
      });
      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.contact.create).not.toHaveBeenCalled();
      expect(result).toEqual({ customerId: "customer-1", contactId: "contact-1" });
    });

    it("creates a new Customer + primary Contact when none exists", async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: "branch-1", isActive: true });
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: "customer-new", branchId: "branch-1" });
      prisma.contact.create.mockResolvedValue({ id: "contact-new", customerId: "customer-new" });

      const result = await service.findOrCreateContactForWebForm("branch-1", input);

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: { branchId: "branch-1", displayName: "Jane Doe" },
      });
      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: {
          customerId: "customer-new",
          fullName: "Jane Doe",
          email: "jane@example.com",
          phone: "555-0100",
          isPrimary: true,
        },
      });
      expect(result).toEqual({ customerId: "customer-new", contactId: "contact-new" });
    });

    it("defaults phone to null when omitted", async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: "branch-1", isActive: true });
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: "customer-new", branchId: "branch-1" });
      prisma.contact.create.mockResolvedValue({ id: "contact-new", customerId: "customer-new" });

      await service.findOrCreateContactForWebForm("branch-1", {
        fullName: "Jane Doe",
        email: "jane@example.com",
      });

      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ phone: null }) }),
      );
    });

    it("scopes the lookup to the given branch — a same-email contact in another branch is not found, so a new Customer is created there instead", async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: "branch-2", isActive: true });
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: "customer-branch-2", branchId: "branch-2" });
      prisma.contact.create.mockResolvedValue({
        id: "contact-branch-2",
        customerId: "customer-branch-2",
      });

      const result = await service.findOrCreateContactForWebForm("branch-2", input);

      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: { email: "jane@example.com", customer: { branchId: "branch-2" } },
      });
      expect(result).toEqual({ customerId: "customer-branch-2", contactId: "contact-branch-2" });
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

  describe("revokeContactPortalAccess", () => {
    it("throws NotFoundException when the contact doesn't belong to the customer", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeContactPortalAccess("customer-1", "missing-contact"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contact.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the parent customer isn't in scope", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeContactPortalAccess("missing-customer", "contact-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contact.findFirst).not.toHaveBeenCalled();
    });

    it("clears the password hash and revokes every existing refresh token", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst.mockResolvedValue({ id: "contact-1", passwordHash: "hashed" });
      prisma.contact.update.mockResolvedValue({ id: "contact-1" });
      prisma.contactRefreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.revokeContactPortalAccess("customer-1", "contact-1");

      expect(result).toEqual({ id: "contact-1" });
      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: "contact-1" },
        data: { passwordHash: null },
      });
      expect(prisma.contactRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { contactId: "contact-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  // RM-02 — Customer Notes. Mirrors `TicketsService`'s own
  // `getTicketNotes`/`createTicketNote` test shape exactly.
  describe("listCustomerNotes", () => {
    it("throws NotFoundException for an unknown/out-of-scope customer id", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.listCustomerNotes("missing-id")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.customerNote.findMany).not.toHaveBeenCalled();
    });

    it("returns [] for a customer with no notes", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.customerNote.findMany.mockResolvedValue([]);

      const result = await service.listCustomerNotes("customer-1");

      expect(result).toEqual([]);
    });

    it("scopes and orders notes chronologically (asc) once the customer is confirmed in scope", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.customerNote.findMany.mockResolvedValue([
        {
          id: "note-1",
          customerId: "customer-1",
          authorUserId: "user-1",
          body: "Prefers email over phone.",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);

      const result = await service.listCustomerNotes("customer-1");

      expect(prisma.customerNote.findMany).toHaveBeenCalledWith({
        where: { customerId: "customer-1" },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual([
        {
          id: "note-1",
          customerId: "customer-1",
          authorUserId: "user-1",
          body: "Prefers email over phone.",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
    });

    it("never returns another customer's notes (tenant/customer isolation)", async () => {
      // requireCustomerInScope itself only looks up { id, branchId } — a
      // customer-1-scoped id belonging to a different branch already 404s
      // before findMany is ever reached; this proves the findMany call
      // itself is always filtered to the one customerId in scope, never a
      // caller-supplied filter that could widen it.
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.customerNote.findMany.mockResolvedValue([]);

      await service.listCustomerNotes("customer-1");

      expect(prisma.customerNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: "customer-1" } }),
      );
    });
  });

  describe("createCustomerNote", () => {
    it("throws NotFoundException for a customer not in the caller's branch, never creating a note", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.createCustomerNote("missing-id", { body: "Some note" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.customerNote.create).not.toHaveBeenCalled();
    });

    it("creates the note as the authenticated actor, never a caller-supplied author", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.customerNote.create.mockResolvedValue({
        id: "note-1",
        customerId: "customer-1",
        authorUserId: "user-1",
        body: "Prefers email over phone.",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const result = await service.createCustomerNote("customer-1", {
        body: "Prefers email over phone.",
      });

      expect(prisma.customerNote.create).toHaveBeenCalledWith({
        data: { customerId: "customer-1", authorUserId: "user-1", body: "Prefers email over phone." },
      });
      expect(result).toEqual({
        id: "note-1",
        customerId: "customer-1",
        authorUserId: "user-1",
        body: "Prefers email over phone.",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });

    it("throws when there is no active user on the request", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      tenantContext = buildTenantContextMock("branch-1", null);
      service = createService(prisma, tenantContext);

      await expect(
        service.createCustomerNote("customer-1", { body: "x" }),
      ).rejects.toThrow(/no authenticated user/);
      expect(prisma.customerNote.create).not.toHaveBeenCalled();
    });
  });
});
