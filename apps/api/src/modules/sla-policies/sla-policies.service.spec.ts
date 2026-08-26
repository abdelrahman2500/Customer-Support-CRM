import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
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
        category: null,
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
          category: null,
          priority: null,
          responseTargetMinutes: 60,
          resolutionTargetMinutes: 480,
        },
      });
      expect(result).toEqual({
        id: "policy-1",
        departmentId: null,
        category: null,
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

    it("passes through provided category/priority/departmentId when given", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
      prisma.slaPolicy.create.mockResolvedValue({
        id: "policy-1",
        departmentId: "dept-1",
        category: "billing",
        priority: "HIGH",
        responseTargetMinutes: 30,
        resolutionTargetMinutes: 240,
        isActive: true,
      });

      await service.createSlaPolicy({
        departmentId: "dept-1",
        category: "billing",
        priority: "HIGH" as never,
        responseTargetMinutes: 30,
        resolutionTargetMinutes: 240,
      });

      expect(prisma.slaPolicy.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          departmentId: "dept-1",
          category: "billing",
          priority: "HIGH",
          responseTargetMinutes: 30,
          resolutionTargetMinutes: 240,
        },
      });
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
