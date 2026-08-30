import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandingService } from "./branding.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    brandingConfig: {
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
): BrandingService {
  return new BrandingService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

describe("BrandingService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: BrandingService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("getBranding", () => {
    it("scopes the lookup by branch", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue(null);

      await service.getBranding();

      expect(prisma.brandingConfig.findUnique).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
      });
    });

    it("returns all-null defaults when the branch has no config yet", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue(null);

      const result = await service.getBranding();

      expect(result).toEqual({ logoUrl: null, primaryColor: null, secondaryColor: null });
    });

    it("returns the existing config when one exists", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue({
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#112233",
        secondaryColor: "#445566",
      });

      const result = await service.getBranding();

      expect(result).toEqual({
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#112233",
        secondaryColor: "#445566",
      });
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.getBranding()).rejects.toThrow(/no active branch/);
    });
  });

  describe("updateBranding", () => {
    it("upserts on the branch id, passing every field through on create", async () => {
      prisma.brandingConfig.upsert.mockResolvedValue({
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#112233",
        secondaryColor: null,
      });

      await service.updateBranding({ logoUrl: "https://example.com/logo.png", primaryColor: "#112233" });

      expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        create: {
          branchId: "branch-1",
          logoUrl: "https://example.com/logo.png",
          primaryColor: "#112233",
          secondaryColor: null,
        },
        update: {
          logoUrl: "https://example.com/logo.png",
          primaryColor: "#112233",
        },
      });
    });

    it("updates only the provided fields, leaving others untouched", async () => {
      prisma.brandingConfig.upsert.mockResolvedValue({
        logoUrl: null,
        primaryColor: "#abcabc",
        secondaryColor: null,
      });

      await service.updateBranding({ primaryColor: "#abcabc" });

      expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { primaryColor: "#abcabc" } }),
      );
    });

    it("returns the resulting branding summary", async () => {
      prisma.brandingConfig.upsert.mockResolvedValue({
        logoUrl: null,
        primaryColor: "#abcabc",
        secondaryColor: null,
      });

      const result = await service.updateBranding({ primaryColor: "#abcabc" });

      expect(result).toEqual({ logoUrl: null, primaryColor: "#abcabc", secondaryColor: null });
    });
  });
});
