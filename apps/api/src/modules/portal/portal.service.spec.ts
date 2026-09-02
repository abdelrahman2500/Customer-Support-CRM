import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { PortalService } from "./portal.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { EnvConfig } from "../../common/config/env.validation";

vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn(async (plain: string) => `hashed:${plain}`),
}));

// Imported after the mock so the mocked implementation is what portal.service.ts sees.
import * as bcrypt from "bcryptjs";

function buildPrismaMock() {
  return {
    contact: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    contactRefreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

function buildJwtServiceMock() {
  return { signAsync: vi.fn(async () => "signed.access.token") };
}

function buildConfigServiceMock(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    JWT_REFRESH_TTL_DAYS: 7,
    JWT_REFRESH_SECRET: "unit-test-refresh-secret-at-least-32-chars-long",
  };
  return { get: vi.fn((key: string) => overrides[key] ?? defaults[key]) };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  jwtMock: ReturnType<typeof buildJwtServiceMock>,
  configMock: ReturnType<typeof buildConfigServiceMock>,
): PortalService {
  return new PortalService(
    prismaMock as unknown as PrismaService,
    jwtMock as unknown as JwtService,
    configMock as unknown as ConfigService<EnvConfig, true>,
  );
}

describe("PortalService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let jwtService: ReturnType<typeof buildJwtServiceMock>;
  let configService: ReturnType<typeof buildConfigServiceMock>;
  let service: PortalService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    jwtService = buildJwtServiceMock();
    configService = buildConfigServiceMock();
    service = createService(prisma, jwtService, configService);
  });

  describe("login", () => {
    it("issues a customer-audience access/refresh pair on valid credentials", async () => {
      prisma.contact.findFirst.mockResolvedValue({
        id: "contact-1",
        passwordHash: "hashed:correct-password",
        customer: { branchId: "branch-1", isActive: true },
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      prisma.contactRefreshToken.create.mockResolvedValue({ id: "rt-1" });

      const result = await service.login("jane@example.com", "correct-password");

      expect(result.accessToken).toBe("signed.access.token");
      expect(typeof result.refreshToken).toBe("string");
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: "contact-1",
        audience: "customer",
        branchId: "branch-1",
        departmentId: null,
        roles: [],
      });
      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: { email: "jane@example.com", passwordHash: { not: null } },
        include: { customer: true },
      });
    });

    it("rejects an unknown email", async () => {
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(service.login("nobody@example.com", "whatever")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects the wrong password", async () => {
      prisma.contact.findFirst.mockResolvedValue({
        id: "contact-1",
        passwordHash: "hashed:correct-password",
        customer: { branchId: "branch-1", isActive: true },
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.login("jane@example.com", "wrong-password")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects a contact whose owning Customer has been deactivated, even with the correct password", async () => {
      prisma.contact.findFirst.mockResolvedValue({
        id: "contact-1",
        passwordHash: "hashed:correct-password",
        customer: { branchId: "branch-1", isActive: false },
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(service.login("jane@example.com", "correct-password")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // Story 100 — same generic message as every other login rejection,
      // deliberately not distinguishing "deactivated" from "wrong password".
      await expect(service.login("jane@example.com", "correct-password")).rejects.toThrow(
        "Invalid email or password",
      );
    });
  });

  describe("refresh", () => {
    const validRecord = {
      id: "rt-1",
      contactId: "contact-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    it("rotates a valid refresh token", async () => {
      prisma.contactRefreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.contact.findUnique.mockResolvedValue({
        id: "contact-1",
        passwordHash: "hashed:whatever",
        customer: { branchId: "branch-1", isActive: true },
      });
      prisma.contactRefreshToken.create.mockResolvedValue({ id: "rt-2" });

      const result = await service.refresh("presented-raw-token");

      expect(result.accessToken).toBe("signed.access.token");
      expect(prisma.contactRefreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: expect.objectContaining({ replacedBy: "rt-2" }),
      });
    });

    it("rejects an unknown token", async () => {
      prisma.contactRefreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh("no-such-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects an expired token", async () => {
      prisma.contactRefreshToken.findUnique.mockResolvedValue({
        ...validRecord,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.refresh("expired-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects an already-revoked (reused) token", async () => {
      prisma.contactRefreshToken.findUnique.mockResolvedValue({
        ...validRecord,
        revokedAt: new Date(),
      });

      await expect(service.refresh("revoked-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects when the contact no longer has portal access", async () => {
      prisma.contactRefreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.contact.findUnique.mockResolvedValue({
        id: "contact-1",
        passwordHash: null,
        customer: { branchId: "branch-1", isActive: true },
      });

      await expect(service.refresh("presented-raw-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects when the contact's owning Customer has been deactivated mid-session", async () => {
      prisma.contactRefreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.contact.findUnique.mockResolvedValue({
        id: "contact-1",
        passwordHash: "hashed:whatever",
        customer: { branchId: "branch-1", isActive: false },
      });

      await expect(service.refresh("presented-raw-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.contactRefreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe("revoke", () => {
    it("updates matching, still-active refresh tokens", async () => {
      prisma.contactRefreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.revoke("some-raw-token");

      expect(prisma.contactRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("does not throw when the token no longer exists", async () => {
      prisma.contactRefreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revoke("gone-token")).resolves.toBeUndefined();
    });
  });

  describe("getAuthenticatedContact", () => {
    it("returns the contact's public shape", async () => {
      prisma.contact.findUnique.mockResolvedValue({
        id: "contact-1",
        email: "jane@example.com",
        fullName: "Jane Doe",
        customerId: "customer-1",
        passwordHash: "hashed:whatever",
      });

      const result = await service.getAuthenticatedContact("contact-1");

      expect(result).toEqual({
        id: "contact-1",
        email: "jane@example.com",
        fullName: "Jane Doe",
        customerId: "customer-1",
      });
    });

    it("throws UnauthorizedException when the contact no longer exists", async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.getAuthenticatedContact("missing")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException when the contact no longer has portal access", async () => {
      prisma.contact.findUnique.mockResolvedValue({
        id: "contact-1",
        email: "jane@example.com",
        fullName: "Jane Doe",
        customerId: "customer-1",
        passwordHash: null,
      });

      await expect(service.getAuthenticatedContact("contact-1")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
