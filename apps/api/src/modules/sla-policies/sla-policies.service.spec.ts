import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SlaPoliciesService } from "./sla-policies.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    slaPolicy: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
    },
    ticketCategory: {
      findFirst: vi.fn(),
    },
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
): SlaPoliciesService {
  return new SlaPoliciesService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

describe("SlaPoliciesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: SlaPoliciesService;

  const baseDto = { responseTargetMinutes: 60, resolutionTargetMinutes: 480 };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("createSlaPolicy", () => {
    it("assigns branchId from TenantContext, not from the DTO", async () => {
      prisma.slaPolicy.create.mockResolvedValue({
        id: "policy-1",
        departmentId: null,
        categoryId: null,
        priority: null,
        responseTargetMinutes: 60,
        resolutionTargetMinutes: 480,
        isActive: true,
      });

      const result = await service.createSlaPolicy(baseDto);

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.slaPolicy.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          departmentId: null,
          categoryId: null,
          priority: null,
          responseTargetMinutes: 60,
          resolutionTargetMinutes: 480,
        },
      });
      expect(result).toEqual({
        id: "policy-1",
        departmentId: null,
        categoryId: null,
        priority: null,
        responseTargetMinutes: 60,
        resolutionTargetMinutes: 480,
        isActive: true,
      });
    });

    it("throws NotFoundException when the department isn't in the caller's branch", async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.createSlaPolicy({ ...baseDto, departmentId: "dept-from-elsewhere" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.department.findFirst).toHaveBeenCalledWith({
        where: { id: "dept-from-elsewhere", branchId: "branch-1" },
      });
      expect(prisma.slaPolicy.create).not.toHaveBeenCalled();
    });

    it("passes through provided categoryId/priority/departmentId when given", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
      prisma.ticketCategory.findFirst.mockResolvedValue({ id: "category-1" });
      prisma.slaPolicy.create.mockResolvedValue({
        id: "policy-1",
        departmentId: "dept-1",
        categoryId: "category-1",
        priority: "HIGH",
        responseTargetMinutes: 30,
        resolutionTargetMinutes: 240,
        isActive: true,
      });

      await service.createSlaPolicy({
        departmentId: "dept-1",
        categoryId: "category-1",
        priority: "HIGH" as never,
        responseTargetMinutes: 30,
        resolutionTargetMinutes: 240,
      });

      expect(prisma.slaPolicy.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          departmentId: "dept-1",
          categoryId: "category-1",
          priority: "HIGH",
          responseTargetMinutes: 30,
          resolutionTargetMinutes: 240,
        },
      });
    });

    it("throws NotFoundException when the category isn't in the caller's branch", async () => {
      prisma.ticketCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.createSlaPolicy({ ...baseDto, categoryId: "category-from-elsewhere" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticketCategory.findFirst).toHaveBeenCalledWith({
        where: { id: "category-from-elsewhere", branchId: "branch-1" },
      });
      expect(prisma.slaPolicy.create).not.toHaveBeenCalled();
    });
  });

  describe("listSlaPolicies", () => {
    it("scopes the query to the caller's active branch", async () => {
      prisma.slaPolicy.findMany.mockResolvedValue([]);

      await service.listSlaPolicies();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.slaPolicy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
      );
    });
  });

  describe("getSlaPolicy", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.slaPolicy.findFirst.mockResolvedValue(null);

      await expect(service.getSlaPolicy("missing-id")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.slaPolicy.findFirst).toHaveBeenCalledWith({
        where: { id: "missing-id", branchId: "branch-1" },
      });
    });
  });

  /**
   * Story S-9 — a policy may not resolve before it responds.
   *
   * This is what makes `sortBy=slaUrgency` orderable by `responseTargetAt`
   * alone: with the pair guaranteed non-inverted, that column IS
   * `LEAST(response, resolution)`, the target the agent-facing SLA status
   * treats as governing.
   */
  describe("target ordering (Story S-9)", () => {
    it("rejects a create whose resolution target precedes its response target", async () => {
      await expect(
        service.createSlaPolicy({
          ...baseDto,
          responseTargetMinutes: 480,
          resolutionTargetMinutes: 60,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.slaPolicy.create).not.toHaveBeenCalled();
    });

    it("allows equal targets: respond and resolve within the same window", async () => {
      prisma.slaPolicy.create.mockResolvedValue({
        id: "policy-1",
        departmentId: null,
        categoryId: null,
        priority: null,
        responseTargetMinutes: 30,
        resolutionTargetMinutes: 30,
        isActive: true,
      });

      await service.createSlaPolicy({
        ...baseDto,
        responseTargetMinutes: 30,
        resolutionTargetMinutes: 30,
      });

      // Equal leaves the two targets tied, never inverted.
      expect(prisma.slaPolicy.create).toHaveBeenCalledOnce();
    });

    it("rejects an update that would invert the pair via BOTH fields", async () => {
      prisma.slaPolicy.findFirst.mockResolvedValue({
        id: "policy-1",
        responseTargetMinutes: 60,
        resolutionTargetMinutes: 480,
      });

      await expect(
        service.updateSlaPolicy("policy-1", {
          responseTargetMinutes: 480,
          resolutionTargetMinutes: 60,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.slaPolicy.update).not.toHaveBeenCalled();
    });

    it("rejects an update that inverts the pair by lowering ONLY the resolution target", async () => {
      prisma.slaPolicy.findFirst.mockResolvedValue({
        id: "policy-1",
        responseTargetMinutes: 60,
        resolutionTargetMinutes: 480,
      });

      // The reason this rule lives in the service and not on the DTO: the
      // request body alone is legal in isolation, and only the stored
      // response target reveals the inversion.
      await expect(
        service.updateSlaPolicy("policy-1", { resolutionTargetMinutes: 30 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.slaPolicy.update).not.toHaveBeenCalled();
    });

    it("rejects an update that inverts the pair by raising ONLY the response target", async () => {
      prisma.slaPolicy.findFirst.mockResolvedValue({
        id: "policy-1",
        responseTargetMinutes: 60,
        resolutionTargetMinutes: 480,
      });

      await expect(
        service.updateSlaPolicy("policy-1", { responseTargetMinutes: 600 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.slaPolicy.update).not.toHaveBeenCalled();
    });

    it("allows an update that keeps the pair ordered", async () => {
      prisma.slaPolicy.findFirst.mockResolvedValue({
        id: "policy-1",
        responseTargetMinutes: 60,
        resolutionTargetMinutes: 480,
      });

      await service.updateSlaPolicy("policy-1", { resolutionTargetMinutes: 240 });

      expect(prisma.slaPolicy.update).toHaveBeenCalledWith({
        where: { id: "policy-1" },
        data: { resolutionTargetMinutes: 240 },
      });
    });

    it("does not reject an update that touches neither target", async () => {
      prisma.slaPolicy.findFirst.mockResolvedValue({
        id: "policy-1",
        responseTargetMinutes: 60,
        resolutionTargetMinutes: 480,
      });

      await service.updateSlaPolicy("policy-1", { isActive: false });

      expect(prisma.slaPolicy.update).toHaveBeenCalledOnce();
    });
  });

  describe("updateSlaPolicy", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.slaPolicy.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSlaPolicy("missing-id", { isActive: false }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.slaPolicy.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when reassigning to a department outside the caller's branch", async () => {
      prisma.slaPolicy.findFirst.mockResolvedValue({ id: "policy-1" });
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSlaPolicy("policy-1", { departmentId: "dept-from-elsewhere" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.slaPolicy.update).not.toHaveBeenCalled();
    });

    it("only includes fields present in the DTO", async () => {
      prisma.slaPolicy.findFirst.mockResolvedValue({ id: "policy-1" });

      await service.updateSlaPolicy("policy-1", { isActive: false });

      expect(prisma.slaPolicy.update).toHaveBeenCalledWith({
        where: { id: "policy-1" },
        data: { isActive: false },
      });
    });
  });
});
