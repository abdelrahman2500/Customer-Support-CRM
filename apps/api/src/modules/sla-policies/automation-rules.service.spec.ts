import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { AutomationRulesService } from "./automation-rules.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    automationRule: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    userBranchRole: {
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
): AutomationRulesService {
  return new AutomationRulesService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

describe("AutomationRulesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: AutomationRulesService;

  const baseDto = { name: "Auto-assign billing", actionAssignToUserId: "user-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("createAutomationRule", () => {
    it("throws NotFoundException when actionAssignToUserId isn't in the caller's branch", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(null);

      await expect(service.createAutomationRule(baseDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.automationRule.create).not.toHaveBeenCalled();
    });

    it("assigns branchId from TenantContext, not the DTO", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue({ id: "membership-1" });
      prisma.automationRule.create.mockResolvedValue({
        id: "rule-1",
        name: "Auto-assign billing",
        isActive: true,
        conditionCategory: null,
        actionAssignToUserId: "user-1",
      });

      await service.createAutomationRule(baseDto);

      expect(prisma.automationRule.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          name: "Auto-assign billing",
          conditionCategory: null,
          actionAssignToUserId: "user-1",
        },
      });
    });

    it("passes through conditionCategory when given", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue({ id: "membership-1" });
      prisma.automationRule.create.mockResolvedValue({
        id: "rule-1",
        name: "Auto-assign billing",
        isActive: true,
        conditionCategory: "billing",
        actionAssignToUserId: "user-1",
      });

      await service.createAutomationRule({ ...baseDto, conditionCategory: "billing" });

      expect(prisma.automationRule.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ conditionCategory: "billing" }) }),
      );
    });
  });

  describe("listAutomationRules", () => {
    it("scopes the query by branch, ordered createdAt asc", async () => {
      prisma.automationRule.findMany.mockResolvedValue([]);

      await service.listAutomationRules();

      expect(prisma.automationRule.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("getAutomationRule", () => {
    it("throws NotFoundException for a rule in a different branch or unknown id", async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);

      await expect(service.getAutomationRule("rule-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns the rule when found in scope", async () => {
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        name: "Auto-assign billing",
        isActive: true,
        conditionCategory: null,
        actionAssignToUserId: "user-1",
      });

      const result = await service.getAutomationRule("rule-1");

      expect(result).toEqual({
        id: "rule-1",
        name: "Auto-assign billing",
        isActive: true,
        conditionCategory: null,
        actionAssignToUserId: "user-1",
      });
    });
  });

  describe("updateAutomationRule", () => {
    it("throws NotFoundException for a rule in a different branch or unknown id", async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAutomationRule("rule-1", { isActive: false }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.automationRule.update).not.toHaveBeenCalled();
    });

    it("validates actionAssignToUserId against the caller's branch when changed", async () => {
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        name: "Auto-assign billing",
        isActive: true,
        conditionCategory: null,
        actionAssignToUserId: "user-1",
      });
      prisma.userBranchRole.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAutomationRule("rule-1", { actionAssignToUserId: "user-2" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.automationRule.update).not.toHaveBeenCalled();
    });

    it("updates only the provided fields", async () => {
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        name: "Auto-assign billing",
        isActive: true,
        conditionCategory: null,
        actionAssignToUserId: "user-1",
      });
      prisma.automationRule.update.mockResolvedValue({ id: "rule-1" });

      const result = await service.updateAutomationRule("rule-1", { isActive: false });

      expect(prisma.automationRule.update).toHaveBeenCalledWith({
        where: { id: "rule-1" },
        data: { isActive: false },
      });
      expect(result).toEqual({ id: "rule-1" });
    });
  });
});
