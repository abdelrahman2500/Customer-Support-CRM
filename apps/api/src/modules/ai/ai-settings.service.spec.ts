import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiSettingsService } from "./ai-settings.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    aiSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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
): AiSettingsService {
  return new AiSettingsService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

describe("AiSettingsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: AiSettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("getSettings", () => {
    it("scopes the lookup by branch", async () => {
      prisma.aiSettings.findUnique.mockResolvedValue(null);

      await service.getSettings();

      expect(prisma.aiSettings.findUnique).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
      });
    });

    it("returns all-enabled defaults when the branch has no settings row yet", async () => {
      prisma.aiSettings.findUnique.mockResolvedValue(null);

      const result = await service.getSettings();

      expect(result).toEqual({
        summarizeEnabled: true,
        suggestReplyEnabled: true,
        categorizeEnabled: true,
        chatEnabled: true,
      });
    });

    it("returns the existing settings when a row exists", async () => {
      prisma.aiSettings.findUnique.mockResolvedValue({
        summarizeEnabled: false,
        suggestReplyEnabled: true,
        categorizeEnabled: false,
        chatEnabled: true,
      });

      const result = await service.getSettings();

      expect(result).toEqual({
        summarizeEnabled: false,
        suggestReplyEnabled: true,
        categorizeEnabled: false,
        chatEnabled: true,
      });
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.getSettings()).rejects.toThrow(/no active branch/);
    });
  });

  describe("updateSettings", () => {
    it("upserts on the branch id, defaulting every field to true on create", async () => {
      prisma.aiSettings.upsert.mockResolvedValue({
        summarizeEnabled: false,
        suggestReplyEnabled: true,
        categorizeEnabled: true,
        chatEnabled: true,
      });

      await service.updateSettings({ summarizeEnabled: false });

      expect(prisma.aiSettings.upsert).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        create: {
          branchId: "branch-1",
          summarizeEnabled: false,
          suggestReplyEnabled: true,
          categorizeEnabled: true,
          chatEnabled: true,
        },
        update: {
          summarizeEnabled: false,
        },
      });
    });

    it("updates only the provided fields, leaving others untouched", async () => {
      prisma.aiSettings.upsert.mockResolvedValue({
        summarizeEnabled: true,
        suggestReplyEnabled: true,
        categorizeEnabled: true,
        chatEnabled: false,
      });

      await service.updateSettings({ chatEnabled: false });

      expect(prisma.aiSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { chatEnabled: false } }),
      );
    });

    it("returns the resulting settings summary", async () => {
      prisma.aiSettings.upsert.mockResolvedValue({
        summarizeEnabled: true,
        suggestReplyEnabled: true,
        categorizeEnabled: true,
        chatEnabled: false,
      });

      const result = await service.updateSettings({ chatEnabled: false });

      expect(result).toEqual({
        summarizeEnabled: true,
        suggestReplyEnabled: true,
        categorizeEnabled: true,
        chatEnabled: false,
      });
    });
  });

  describe("isFeatureEnabled", () => {
    it("returns true for every feature when the branch has no settings row", async () => {
      prisma.aiSettings.findUnique.mockResolvedValue(null);

      expect(await service.isFeatureEnabled("branch-1", "SUMMARIZE")).toBe(true);
      expect(await service.isFeatureEnabled("branch-1", "CHAT")).toBe(true);
    });

    it("reads the matching column for each feature", async () => {
      prisma.aiSettings.findUnique.mockResolvedValue({
        summarizeEnabled: false,
        suggestReplyEnabled: true,
        categorizeEnabled: false,
        chatEnabled: true,
      });

      expect(await service.isFeatureEnabled("branch-1", "SUMMARIZE")).toBe(false);
      expect(await service.isFeatureEnabled("branch-1", "SUGGEST_REPLY")).toBe(true);
      expect(await service.isFeatureEnabled("branch-1", "CATEGORIZE")).toBe(false);
      expect(await service.isFeatureEnabled("branch-1", "CHAT")).toBe(true);
    });

    it("scopes the lookup by the given branchId, never the ambient TenantContext", async () => {
      prisma.aiSettings.findUnique.mockResolvedValue(null);

      await service.isFeatureEnabled("some-other-branch", "CHAT");

      expect(prisma.aiSettings.findUnique).toHaveBeenCalledWith({
        where: { branchId: "some-other-branch" },
      });
      expect(tenantContext.requireBranchScope).not.toHaveBeenCalled();
    });
  });
});
