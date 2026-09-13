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

      expect(result).toEqual({
        appName: null,
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        navigationLayout: null,
      });
    });

    it("returns the existing config when one exists", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue({
        appName: "Acme Support",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#112233",
        secondaryColor: "#445566",
        navigationLayout: "SIDEBAR",
      });

      const result = await service.getBranding();

      expect(result).toEqual({
        appName: "Acme Support",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#112233",
        secondaryColor: "#445566",
        navigationLayout: "SIDEBAR",
      });
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.getBranding()).rejects.toThrow(/no active branch/);
    });
  });

  // Story 82 — Branding — Live Logo/Color Consumption.
  describe("getBrandingForBranch", () => {
    it("scopes the lookup by the given branchId, never the ambient TenantContext", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue(null);

      await service.getBrandingForBranch("some-other-branch");

      expect(prisma.brandingConfig.findUnique).toHaveBeenCalledWith({
        where: { branchId: "some-other-branch" },
      });
      expect(tenantContext.requireBranchScope).not.toHaveBeenCalled();
    });

    it("returns all-null defaults when the branch has no config yet", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue(null);

      const result = await service.getBrandingForBranch("branch-1");

      expect(result).toEqual({
        appName: null,
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        navigationLayout: null,
      });
    });

    it("returns the existing config when one exists", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue({
        appName: "Acme Support",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#112233",
        secondaryColor: "#445566",
        navigationLayout: "SIDEBAR",
      });

      const result = await service.getBrandingForBranch("branch-1");

      expect(result).toEqual({
        appName: "Acme Support",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#112233",
        secondaryColor: "#445566",
        navigationLayout: "SIDEBAR",
      });
    });
  });

  describe("updateBranding", () => {
    it("upserts on the branch id, passing every field through on create", async () => {
      prisma.brandingConfig.upsert.mockResolvedValue({
        appName: null,
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#112233",
        secondaryColor: null,
        navigationLayout: null,
      });

      await service.updateBranding({ logoUrl: "https://example.com/logo.png", primaryColor: "#112233" });

      expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        create: {
          branchId: "branch-1",
          appName: null,
          logoUrl: "https://example.com/logo.png",
          primaryColor: "#112233",
          secondaryColor: null,
          navigationLayout: null,
        },
        update: {
          logoUrl: "https://example.com/logo.png",
          primaryColor: "#112233",
        },
      });
    });

    it("updates only the provided fields, leaving others untouched", async () => {
      prisma.brandingConfig.upsert.mockResolvedValue({
        appName: null,
        logoUrl: null,
        primaryColor: "#abcabc",
        secondaryColor: null,
        navigationLayout: null,
      });

      await service.updateBranding({ primaryColor: "#abcabc" });

      expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { primaryColor: "#abcabc" } }),
      );
    });

    it("returns the resulting branding summary", async () => {
      prisma.brandingConfig.upsert.mockResolvedValue({
        appName: null,
        logoUrl: null,
        primaryColor: "#abcabc",
        secondaryColor: null,
        navigationLayout: null,
      });

      const result = await service.updateBranding({ primaryColor: "#abcabc" });

      expect(result).toEqual({
        appName: null,
        logoUrl: null,
        primaryColor: "#abcabc",
        secondaryColor: null,
        navigationLayout: null,
      });
    });
  });

  // Story 129 — Admin Branding & Navigation Layout Customization.
  describe("appName and navigationLayout (Story 129)", () => {
    it("returns both new fields from an existing row", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue({
        appName: "Acme Support",
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        navigationLayout: "SIDEBAR",
      });

      const result = await service.getBrandingForBranch("branch-1");

      expect(result.appName).toBe("Acme Support");
      expect(result.navigationLayout).toBe("SIDEBAR");
    });

    // `null` means "not configured" all the way to the frontend, exactly
    // like the other three fields — there is deliberately no
    // fallback-to-NAVBAR here; the single resolution point is the
    // frontend's own `resolveNavigationLayout`.
    it("returns null for both when the branch has no config row at all", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue(null);

      const result = await service.getBrandingForBranch("branch-1");

      expect(result.appName).toBeNull();
      expect(result.navigationLayout).toBeNull();
    });

    it("returns null for both when the row itself has them unset", async () => {
      prisma.brandingConfig.findUnique.mockResolvedValue({
        appName: null,
        logoUrl: "https://example.com/logo.png",
        primaryColor: null,
        secondaryColor: null,
        navigationLayout: null,
      });

      const result = await service.getBrandingForBranch("branch-1");

      expect(result.appName).toBeNull();
      expect(result.navigationLayout).toBeNull();
    });

    it("writes both on the create path of the upsert", async () => {
      prisma.brandingConfig.upsert.mockResolvedValue({
        appName: "Acme Support",
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        navigationLayout: "SIDEBAR",
      });

      await service.updateBranding({ appName: "Acme Support", navigationLayout: "SIDEBAR" });

      expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        create: {
          branchId: "branch-1",
          appName: "Acme Support",
          logoUrl: null,
          primaryColor: null,
          secondaryColor: null,
          navigationLayout: "SIDEBAR",
        },
        update: {
          appName: "Acme Support",
          navigationLayout: "SIDEBAR",
        },
      });
    });

    // The failure mode this guards: patching one new field must not clear
    // the other, which is exactly what a non-conditional `update` block
    // would do.
    it("leaves an omitted field untouched — patching navigationLayout must not clear appName", async () => {
      prisma.brandingConfig.upsert.mockResolvedValue({
        appName: "Acme Support",
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        navigationLayout: "NAVBAR",
      });

      await service.updateBranding({ navigationLayout: "NAVBAR" });

      expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { navigationLayout: "NAVBAR" } }),
      );
    });

    it("leaves navigationLayout untouched when only appName is patched", async () => {
      prisma.brandingConfig.upsert.mockResolvedValue({
        appName: "Acme Support",
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        navigationLayout: "SIDEBAR",
      });

      await service.updateBranding({ appName: "Acme Support" });

      expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { appName: "Acme Support" } }),
      );
    });
  });
});
