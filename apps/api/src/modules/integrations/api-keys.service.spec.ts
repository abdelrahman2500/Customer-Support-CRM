import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeysService } from "./api-keys.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";
import type { ApiKeyHasher } from "./api-key-hash";

function buildPrismaMock() {
  return {
    apiKey: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

function buildTenantContextMock(
  branchId: string | null = "branch-1",
  userId: string | null = "user-1",
) {
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

function buildHasherMock() {
  return { hash: vi.fn((raw: string) => `hashed(${raw})`) };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
  hasherMock: ReturnType<typeof buildHasherMock>,
): ApiKeysService {
  return new ApiKeysService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
    hasherMock as unknown as ApiKeyHasher,
  );
}

const ROW = {
  id: "key-1",
  branchId: "branch-1",
  label: "CI bot",
  hashedKey: "hashed(irrelevant)",
  keyPrefix: "crmk_abc",
  scopes: ["integration:read"],
  expiresAt: null,
  revokedAt: null,
  createdByUserId: "user-1",
  lastUsedAt: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

describe("ApiKeysService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let hasher: ReturnType<typeof buildHasherMock>;
  let service: ApiKeysService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    hasher = buildHasherMock();
    service = createService(prisma, tenantContext, hasher);
  });

  describe("createApiKey", () => {
    it("generates a raw key, hashes it via ApiKeyHasher, and persists only the hash", async () => {
      prisma.apiKey.create.mockResolvedValue(ROW);

      const result = await service.createApiKey({ label: "CI bot", scopes: ["integration:read"] });

      expect(hasher.hash).toHaveBeenCalledWith(result.rawKey);
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          label: "CI bot",
          hashedKey: `hashed(${result.rawKey})`,
          keyPrefix: result.rawKey.slice(0, 8),
          scopes: ["integration:read"],
          expiresAt: null,
          createdByUserId: "user-1",
        },
      });
    });

    it("returns the raw key exactly once, alongside the rest of the summary", async () => {
      prisma.apiKey.create.mockResolvedValue(ROW);

      const result = await service.createApiKey({ label: "CI bot", scopes: ["integration:read"] });

      expect(result).toEqual({
        id: "key-1",
        label: "CI bot",
        keyPrefix: expect.any(String),
        scopes: ["integration:read"],
        expiresAt: null,
        revokedAt: null,
        createdByUserId: "user-1",
        lastUsedAt: null,
        createdAt: ROW.createdAt,
        rawKey: expect.any(String),
      });
    });

    it("parses an ISO expiresAt into a Date, when given", async () => {
      prisma.apiKey.create.mockResolvedValue({ ...ROW, expiresAt: new Date("2025-01-01T00:00:00.000Z") });

      await service.createApiKey({
        label: "CI bot",
        scopes: ["integration:read"],
        expiresAt: "2025-01-01T00:00:00.000Z",
      });

      expect(prisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ expiresAt: new Date("2025-01-01T00:00:00.000Z") }),
        }),
      );
    });

    it("throws when no authenticated user exists on TenantContext", async () => {
      tenantContext = buildTenantContextMock("branch-1", null);
      service = createService(prisma, tenantContext, hasher);

      await expect(
        service.createApiKey({ label: "CI bot", scopes: ["integration:read"] }),
      ).rejects.toThrow(/no authenticated user/);
    });
  });

  describe("listApiKeys", () => {
    it("scopes the query to the caller's branch and never returns hashedKey/rawKey", async () => {
      prisma.apiKey.findMany.mockResolvedValue([ROW]);

      const result = await service.listApiKeys();

      expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result[0]).not.toHaveProperty("hashedKey");
      expect(result[0]).not.toHaveProperty("rawKey");
      expect(result[0]).toHaveProperty("keyPrefix");
    });
  });

  describe("revokeApiKey", () => {
    it("404s when the key is outside the caller's branch", async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revokeApiKey("key-1")).rejects.toThrow(/not found/i);
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it("sets revokedAt, leaving the row (not a hard delete)", async () => {
      prisma.apiKey.findFirst.mockResolvedValue(ROW);

      await service.revokeApiKey("key-1");

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: "key-1" },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("is idempotent — revoking an already-revoked key does not error or re-update", async () => {
      prisma.apiKey.findFirst.mockResolvedValue({ ...ROW, revokedAt: new Date("2024-06-01T00:00:00.000Z") });

      await expect(service.revokeApiKey("key-1")).resolves.toBeUndefined();
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });
  });
});
