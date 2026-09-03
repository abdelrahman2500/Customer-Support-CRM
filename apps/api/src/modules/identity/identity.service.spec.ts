import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { IdentityService, hashPassword } from "./identity.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";
import type { EnvConfig } from "../../common/config/env.validation";

/** Mimics the shape `PrismaClientKnownRequestError` exposes at `.code`. */
function buildUniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: "P2002",
    message: "Unique constraint failed",
  }) as Prisma.PrismaClientKnownRequestError;
}

vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn(async (plain: string) => `hashed:${plain}`),
}));

// Imported after the mock so the mocked implementation is what identity.service.ts sees.
import * as bcrypt from "bcryptjs";

function buildPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(async (args: { data: { email: string } }) => ({
        id: "new-user-id",
        email: args.data.email,
      })),
    },
    branch: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    userBranchRole: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    permission: {
      findMany: vi.fn(),
    },
    rolePermission: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    // The real PrismaService's `$transaction` is used two ways in this
    // codebase: the interactive-callback form (`createUser`, via
    // `tx.user.create`/`tx.userBranchRole.create`) and the batch-array form
    // (`setRolePermissions`, via `[deleteMany(...), createMany(...)]`). This
    // mock supports both shapes.
    $transaction: vi.fn((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: unknown) => unknown)(prismaSelfRef);
    }),
  };
}

// `$transaction`'s mock needs to hand back the same object it's a method
// of — assigned once `buildPrismaMock` has produced it, in `beforeEach`.
let prismaSelfRef: ReturnType<typeof buildPrismaMock>;

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

function buildTenantContextMock(
  branchId: string | null = "branch-1",
  userId: string | null = "actor-1",
  departmentId: string | null = "dept-1",
) {
  return {
    userId,
    // Story 118 — `listMyBranchMemberships` reads these two directly (the
    // current request's own JWT claims), not just via `requireBranchScope()`.
    branchId,
    departmentId,
    requireBranchScope: vi.fn(() => {
      if (!branchId) {
        throw new Error("TenantContext: no active branch on this request");
      }
      return { branchId };
    }),
  };
}

// Each mock only implements the handful of members `IdentityService` actually
// calls — `as unknown as X` says "trust me, this satisfies the interface for
// what's exercised here" without reaching for `any`.
function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  jwtMock: ReturnType<typeof buildJwtServiceMock>,
  configMock: ReturnType<typeof buildConfigServiceMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
): IdentityService {
  return new IdentityService(
    prismaMock as unknown as PrismaService,
    jwtMock as unknown as JwtService,
    configMock as unknown as ConfigService<EnvConfig, true>,
    tenantMock as unknown as TenantContext,
  );
}

describe("IdentityService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let jwtService: ReturnType<typeof buildJwtServiceMock>;
  let configService: ReturnType<typeof buildConfigServiceMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: IdentityService;

  const activeBranchRole = {
    branchId: "branch-1",
    departmentId: "dept-1",
    role: { name: "SuperAdmin" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    prismaSelfRef = prisma;
    jwtService = buildJwtServiceMock();
    configService = buildConfigServiceMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, jwtService, configService, tenantContext);
  });

  describe("login", () => {
    it("issues an access/refresh pair on valid credentials", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        passwordHash: "hashed:correct-password",
        failedLoginAttempts: 0,
        lockedUntil: null,
        branchRoles: [activeBranchRole],
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

      const result = await service.login("admin@example.com", "correct-password");

      expect(result.accessToken).toBe("signed.access.token");
      expect(typeof result.refreshToken).toBe("string");
      expect(result.refreshToken.length).toBeGreaterThan(0);
      expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
    });

    it("rejects an unknown email", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login("nobody@example.com", "whatever")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects an inactive user", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: false,
        passwordHash: "hashed:whatever",
        failedLoginAttempts: 0,
        lockedUntil: null,
        branchRoles: [],
      });

      await expect(service.login("admin@example.com", "whatever")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects the wrong password", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        passwordHash: "hashed:correct-password",
        failedLoginAttempts: 0,
        lockedUntil: null,
        branchRoles: [],
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.login("admin@example.com", "wrong-password")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    // Story 84 — Explicit Audit Logging.
    it("records auth.login_failed with actorId null and the attempted email when no such user exists", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login("nobody@example.com", "whatever")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: null,
          action: "auth.login_failed",
          entityType: "user",
          entityId: "nobody@example.com",
        }),
      });
    });

    it("records auth.login_failed with the real user id when the password is wrong", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        passwordHash: "hashed:correct-password",
        failedLoginAttempts: 0,
        lockedUntil: null,
        branchRoles: [],
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.login("admin@example.com", "wrong-password")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: null,
          action: "auth.login_failed",
          entityType: "user",
          entityId: "user-1",
        }),
      });
    });

    it("records auth.login with the real actorId, branchId, and ipAddress on success", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        passwordHash: "hashed:correct-password",
        failedLoginAttempts: 0,
        lockedUntil: null,
        branchRoles: [activeBranchRole],
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

      await service.login("admin@example.com", "correct-password", "203.0.113.1");

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "user-1",
          action: "auth.login",
          entityType: "user",
          entityId: "user-1",
          branchId: "branch-1",
          ipAddress: "203.0.113.1",
        }),
      });
    });

    // Story 124 — Session/Device Management.
    it("starts a brand-new session (a freshly generated sessionId + ipAddress/userAgent) on login", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        passwordHash: "hashed:correct-password",
        failedLoginAttempts: 0,
        lockedUntil: null,
        branchRoles: [activeBranchRole],
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

      await service.login("admin@example.com", "correct-password", "203.0.113.1", "Mozilla/5.0");

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: "203.0.113.1",
          userAgent: "Mozilla/5.0",
          sessionId: expect.any(String),
          sessionCreatedAt: expect.any(Date),
        }),
      });
    });

    it("never throws when the audit write itself fails", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        passwordHash: "hashed:correct-password",
        failedLoginAttempts: 0,
        lockedUntil: null,
        branchRoles: [activeBranchRole],
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });
      prisma.auditLog.create.mockRejectedValue(new Error("db unavailable"));

      await expect(
        service.login("admin@example.com", "correct-password"),
      ).resolves.toEqual(expect.objectContaining({ accessToken: "signed.access.token" }));
    });

    // Story 122 — Account Lockout.
    describe("account lockout", () => {
      it("increments failedLoginAttempts by one on a wrong password, without locking below the threshold", async () => {
        prisma.user.findUnique.mockResolvedValue({
          id: "user-1",
          isActive: true,
          passwordHash: "hashed:correct-password",
          failedLoginAttempts: 3,
          lockedUntil: null,
          branchRoles: [],
        });
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(
          service.login("admin@example.com", "wrong-password"),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: "user-1" },
          data: { failedLoginAttempts: 4 },
        });
      });

      it("locks the account once failedLoginAttempts reaches the threshold (5), setting lockedUntil ~15 minutes out", async () => {
        prisma.user.findUnique.mockResolvedValue({
          id: "user-1",
          isActive: true,
          passwordHash: "hashed:correct-password",
          failedLoginAttempts: 4,
          lockedUntil: null,
          branchRoles: [],
        });
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
        const before = Date.now();

        await expect(
          service.login("admin@example.com", "wrong-password"),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: "user-1" },
          data: { failedLoginAttempts: 5, lockedUntil: expect.any(Date) },
        });
        const lockedUntil = prisma.user.update.mock.calls[0]![0].data.lockedUntil as Date;
        const deltaMs = lockedUntil.getTime() - before;
        expect(deltaMs).toBeGreaterThan(14 * 60 * 1000);
        expect(deltaMs).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
      });

      it("records a distinct auth.account_locked audit entry only on the locking attempt", async () => {
        prisma.user.findUnique.mockResolvedValue({
          id: "user-1",
          isActive: true,
          passwordHash: "hashed:correct-password",
          failedLoginAttempts: 4,
          lockedUntil: null,
          branchRoles: [],
        });
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(
          service.login("admin@example.com", "wrong-password"),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: "auth.account_locked",
            entityType: "user",
            entityId: "user-1",
          }),
        });
      });

      it("rejects a login attempt against a currently-locked account with the identical generic message, without touching bcrypt or the failed-attempt counter", async () => {
        prisma.user.findUnique.mockResolvedValue({
          id: "user-1",
          isActive: true,
          passwordHash: "hashed:correct-password",
          failedLoginAttempts: 5,
          lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
          branchRoles: [],
        });

        // Even the CORRECT password must be rejected while locked.
        await expect(
          service.login("admin@example.com", "correct-password"),
        ).rejects.toThrow("Invalid email or password");

        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it("records auth.login_blocked (not auth.login_failed) for a locked-account attempt", async () => {
        prisma.user.findUnique.mockResolvedValue({
          id: "user-1",
          isActive: true,
          passwordHash: "hashed:correct-password",
          failedLoginAttempts: 5,
          lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
          branchRoles: [],
        });

        await expect(service.login("admin@example.com", "correct-password")).rejects.toBeInstanceOf(
          UnauthorizedException,
        );

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            actorId: null,
            action: "auth.login_blocked",
            entityType: "user",
            entityId: "user-1",
          }),
        });
        expect(prisma.auditLog.create).not.toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ action: "auth.login_failed" }) }),
        );
      });

      it("allows login once an expired lock has passed, evaluating the attempt normally", async () => {
        prisma.user.findUnique.mockResolvedValue({
          id: "user-1",
          isActive: true,
          passwordHash: "hashed:correct-password",
          failedLoginAttempts: 5,
          lockedUntil: new Date(Date.now() - 60_000), // expired one minute ago
          branchRoles: [activeBranchRole],
        });
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        prisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

        const result = await service.login("admin@example.com", "correct-password");

        expect(result.accessToken).toBe("signed.access.token");
      });

      it("resets failedLoginAttempts/lockedUntil to their unlocked defaults on a successful login", async () => {
        prisma.user.findUnique.mockResolvedValue({
          id: "user-1",
          isActive: true,
          passwordHash: "hashed:correct-password",
          failedLoginAttempts: 3,
          lockedUntil: null,
          branchRoles: [activeBranchRole],
        });
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        prisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

        await service.login("admin@example.com", "correct-password");

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: "user-1" },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
      });

      it("does not call user.update on a successful login when the counter is already 0 and unlocked", async () => {
        prisma.user.findUnique.mockResolvedValue({
          id: "user-1",
          isActive: true,
          passwordHash: "hashed:correct-password",
          failedLoginAttempts: 0,
          lockedUntil: null,
          branchRoles: [activeBranchRole],
        });
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        prisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

        await service.login("admin@example.com", "correct-password");

        expect(prisma.user.update).not.toHaveBeenCalled();
      });
    });
  });

  describe("refresh", () => {
    const validRecord = {
      id: "rt-1",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    it("rotates a valid refresh token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        branchRoles: [activeBranchRole],
      });
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      const result = await service.refresh("presented-raw-token");

      expect(result.accessToken).toBe("signed.access.token");
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: expect.objectContaining({ replacedBy: "rt-2" }),
      });
    });

    // Story 124 — Session/Device Management.
    it("carries the existing session's sessionId/sessionCreatedAt forward unchanged, while updating ipAddress/userAgent to the current request", async () => {
      const sessionCreatedAt = new Date("2026-01-01T00:00:00.000Z");
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validRecord,
        sessionId: "session-abc",
        sessionCreatedAt,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        branchRoles: [activeBranchRole],
      });
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      await service.refresh("presented-raw-token", "203.0.113.9", "Mozilla/5.0 (new device)");

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: "session-abc",
          sessionCreatedAt,
          ipAddress: "203.0.113.9",
          userAgent: "Mozilla/5.0 (new device)",
        }),
      });
    });

    it("starts a brand-new session when the presented token predates Story 124 (no stored sessionId)", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord); // no sessionId field
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        branchRoles: [activeBranchRole],
      });
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      await service.refresh("presented-raw-token");

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: expect.any(String),
          sessionCreatedAt: expect.any(Date),
        }),
      });
    });

    it("rejects an unknown token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh("no-such-token")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects an expired token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validRecord,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.refresh("expired-token")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects an already-revoked (reused) token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validRecord,
        revokedAt: new Date(),
      });

      await expect(service.refresh("revoked-token")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    // Story 118 — conversation memory for the active branch across a
    // silent refresh: a user's explicit switch must not revert to
    // `branchRoles[0]` on the very next `/auth/refresh` call.
    it("passes the user's own activeBranchId/activeDepartmentId through to token issuance", async () => {
      const otherBranchRole = {
        branchId: "branch-2",
        departmentId: null,
        role: { name: "Agent" },
      };
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        activeBranchId: "branch-2",
        activeDepartmentId: null,
        branchRoles: [activeBranchRole, otherBranchRole],
      });
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      await service.refresh("presented-raw-token");

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: "branch-2", departmentId: null, roles: ["Agent"] }),
      );
    });

    it("falls back to branchRoles[0] when the user has never switched (activeBranchId is null)", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        activeBranchId: null,
        activeDepartmentId: null,
        branchRoles: [activeBranchRole],
      });
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      await service.refresh("presented-raw-token");

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: "branch-1", departmentId: "dept-1" }),
      );
    });

    it("self-heals to branchRoles[0] when the stored active membership no longer exists", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        activeBranchId: "branch-removed",
        activeDepartmentId: null,
        branchRoles: [activeBranchRole],
      });
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      await service.refresh("presented-raw-token");

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: "branch-1", departmentId: "dept-1" }),
      );
    });
  });

  describe("getAuthenticatedUser", () => {
    it("resolves branchId/departmentId/roles from the user's activeBranchId/activeDepartmentId, not always branchRoles[0]", async () => {
      const otherBranchRole = {
        branchId: "branch-2",
        departmentId: null,
        role: { name: "Agent" },
      };
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "admin@example.com",
        fullName: "Admin User",
        activeBranchId: "branch-2",
        activeDepartmentId: null,
        branchRoles: [activeBranchRole, otherBranchRole],
      });

      const result = await service.getAuthenticatedUser("user-1");

      expect(result).toEqual({
        id: "user-1",
        email: "admin@example.com",
        fullName: "Admin User",
        branchId: "branch-2",
        departmentId: null,
        roles: ["Agent"],
      });
    });

    it("falls back to branchRoles[0] when never switched", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "admin@example.com",
        fullName: "Admin User",
        activeBranchId: null,
        activeDepartmentId: null,
        branchRoles: [activeBranchRole],
      });

      const result = await service.getAuthenticatedUser("user-1");

      expect(result.branchId).toBe("branch-1");
      expect(result.departmentId).toBe("dept-1");
    });

    // Story 119 — locale preference.
    it("passes preferredLocale through unchanged", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "admin@example.com",
        fullName: "Admin User",
        activeBranchId: null,
        activeDepartmentId: null,
        preferredLocale: "ar",
        branchRoles: [activeBranchRole],
      });

      const result = await service.getAuthenticatedUser("user-1");

      expect(result.preferredLocale).toBe("ar");
    });

    it("returns null preferredLocale for a user who has never set one", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "admin@example.com",
        fullName: "Admin User",
        activeBranchId: null,
        activeDepartmentId: null,
        preferredLocale: null,
        branchRoles: [activeBranchRole],
      });

      const result = await service.getAuthenticatedUser("user-1");

      expect(result.preferredLocale).toBeNull();
    });

    it("throws UnauthorizedException when the user no longer exists", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getAuthenticatedUser("gone-user")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe("updatePreferredLocale", () => {
    it("persists the given locale for the given user", async () => {
      prisma.user.update.mockResolvedValue({ id: "user-1" });

      const result = await service.updatePreferredLocale("user-1", "ar");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { preferredLocale: "ar" },
      });
      expect(result).toEqual({ id: "user-1" });
    });
  });

  describe("listMyBranchMemberships", () => {
    it("lists every membership the caller holds, with branch/department/role names resolved", async () => {
      prisma.userBranchRole.findMany.mockResolvedValue([
        {
          branchId: "branch-1",
          branch: { name: "Main Branch" },
          departmentId: "dept-1",
          department: { name: "Support" },
          roleId: "role-1",
          role: { name: "SuperAdmin" },
        },
        {
          branchId: "branch-2",
          branch: { name: "Second Branch" },
          departmentId: null,
          department: null,
          roleId: "role-2",
          role: { name: "Agent" },
        },
      ]);

      const result = await service.listMyBranchMemberships();

      expect(prisma.userBranchRole.findMany).toHaveBeenCalledWith({
        where: { userId: "actor-1" },
        include: { branch: true, department: true, role: true },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual([
        {
          branchId: "branch-1",
          branchName: "Main Branch",
          departmentId: "dept-1",
          departmentName: "Support",
          roleId: "role-1",
          roleName: "SuperAdmin",
          isActive: true,
        },
        {
          branchId: "branch-2",
          branchName: "Second Branch",
          departmentId: null,
          departmentName: null,
          roleId: "role-2",
          roleName: "Agent",
          isActive: false,
        },
      ]);
    });

    it("throws UnauthorizedException when no authenticated user exists on TenantContext", async () => {
      tenantContext = buildTenantContextMock("branch-1", null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.listMyBranchMemberships()).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // Story 124 — Session/Device Management.
  describe("listMySessions", () => {
    // Mirrors `hashRefreshToken`'s own HMAC-SHA256 implementation exactly,
    // using the same `JWT_REFRESH_SECRET` `buildConfigServiceMock` supplies,
    // so this test can present a raw token that genuinely hashes to a
    // specific session's stored `tokenHash`.
    function hashLikeService(raw: string): string {
      return createHmac("sha256", "unit-test-refresh-secret-at-least-32-chars-long")
        .update(raw)
        .digest("hex");
    }

    it("lists one row per live session, newest first, with the presented token's session flagged current", async () => {
      const currentRawToken = "presented-raw-token";
      const sessionA = {
        sessionId: "session-a",
        tokenHash: hashLikeService(currentRawToken),
        ipAddress: "203.0.113.1",
        userAgent: "Mozilla/5.0 (device A)",
        sessionCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      };
      const sessionB = {
        sessionId: "session-b",
        tokenHash: "hash-of-other-token",
        ipAddress: "203.0.113.2",
        userAgent: "Mozilla/5.0 (device B)",
        sessionCreatedAt: new Date("2026-01-03T00:00:00.000Z"),
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      };
      prisma.refreshToken.findMany.mockResolvedValue([sessionB, sessionA]);

      const result = await service.listMySessions(currentRawToken);

      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: "actor-1",
          sessionId: { not: null },
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual([
        {
          sessionId: "session-b",
          ipAddress: "203.0.113.2",
          userAgent: "Mozilla/5.0 (device B)",
          sessionCreatedAt: sessionB.sessionCreatedAt,
          lastActiveAt: sessionB.createdAt,
          isCurrent: false,
        },
        {
          sessionId: "session-a",
          ipAddress: "203.0.113.1",
          userAgent: "Mozilla/5.0 (device A)",
          sessionCreatedAt: sessionA.sessionCreatedAt,
          lastActiveAt: sessionA.createdAt,
          isCurrent: true,
        },
      ]);
    });

    it("flags isCurrent false for every session when no refresh token was presented", async () => {
      prisma.refreshToken.findMany.mockResolvedValue([
        {
          sessionId: "session-a",
          tokenHash: "hash-of-a",
          ipAddress: null,
          userAgent: null,
          sessionCreatedAt: new Date(),
          createdAt: new Date(),
        },
      ]);

      const result = await service.listMySessions(null);

      expect(result[0]!.isCurrent).toBe(false);
    });

    it("throws UnauthorizedException when no authenticated user exists on TenantContext", async () => {
      tenantContext = buildTenantContextMock("branch-1", null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.listMySessions(null)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("revokeSession", () => {
    it("revokes the caller's own live session", async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: "rt-1",
        userId: "actor-1",
        sessionId: "session-a",
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.revokeSession("session-a");

      expect(prisma.refreshToken.findFirst).toHaveBeenCalledWith({
        where: { userId: "actor-1", sessionId: "session-a" },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "actor-1", sessionId: "session-a", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("silently no-ops when the session is already revoked", async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: "rt-1",
        userId: "actor-1",
        sessionId: "session-a",
        revokedAt: new Date(),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revokeSession("session-a")).resolves.toBeUndefined();
    });

    it("throws NotFoundException when the caller never had any row with this sessionId (never operates on another user's session)", async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.revokeSession("someone-elses-session")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws UnauthorizedException when no authenticated user exists on TenantContext", async () => {
      tenantContext = buildTenantContextMock("branch-1", null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.revokeSession("session-a")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe("switchActiveBranch", () => {
    const validRecord = {
      id: "rt-1",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const otherBranchRole = {
      branchId: "branch-2",
      departmentId: null,
      role: { name: "Agent" },
    };

    it("switches to a held membership: persists it, rotates the token, and reissues claims", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        activeBranchId: null,
        activeDepartmentId: null,
        branchRoles: [activeBranchRole, otherBranchRole],
      });
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      const result = await service.switchActiveBranch("presented-raw-token", "branch-2", null);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { activeBranchId: "branch-2", activeDepartmentId: null },
      });
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: expect.objectContaining({ replacedBy: "rt-2" }),
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: "branch-2", departmentId: null, roles: ["Agent"] }),
      );
      expect(result.accessToken).toBe("signed.access.token");
    });

    it("throws NotFoundException for a branch/department the user does not hold", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        activeBranchId: null,
        activeDepartmentId: null,
        branchRoles: [activeBranchRole],
      });

      await expect(
        service.switchActiveBranch("presented-raw-token", "branch-never-granted", null),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    // Story 124 — Session/Device Management. A branch switch rotates the
    // refresh token exactly like `refresh()` does, and must carry the same
    // session's identity forward unchanged.
    it("carries the existing session's sessionId/sessionCreatedAt forward unchanged", async () => {
      const sessionCreatedAt = new Date("2026-01-01T00:00:00.000Z");
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validRecord,
        sessionId: "session-abc",
        sessionCreatedAt,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        activeBranchId: null,
        activeDepartmentId: null,
        branchRoles: [activeBranchRole, otherBranchRole],
      });
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      await service.switchActiveBranch(
        "presented-raw-token",
        "branch-2",
        null,
        "203.0.113.9",
        "Mozilla/5.0 (new device)",
      );

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: "session-abc",
          sessionCreatedAt,
          ipAddress: "203.0.113.9",
          userAgent: "Mozilla/5.0 (new device)",
        }),
      });
    });

    it("rejects an unknown/expired/revoked token exactly like refresh()", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.switchActiveBranch("no-such-token", "branch-2", null),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("records an auth.branch_switched audit entry with a before/after diff", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validRecord);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        isActive: true,
        activeBranchId: "branch-1",
        activeDepartmentId: "dept-1",
        branchRoles: [activeBranchRole, otherBranchRole],
      });
      prisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      await service.switchActiveBranch("presented-raw-token", "branch-2", null);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "user-1",
          action: "auth.branch_switched",
          entityType: "user",
          entityId: "user-1",
          branchId: "branch-2",
          diff: {
            before: { branchId: "branch-1", departmentId: "dept-1" },
            after: { branchId: "branch-2", departmentId: null },
          },
        }),
      });
    });
  });

  describe("revoke", () => {
    it("updates matching, still-active refresh tokens", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.revoke("some-raw-token");

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("does not throw when the token no longer exists", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revoke("gone-token")).resolves.toBeUndefined();
    });

    // Story 84 — Explicit Audit Logging.
    it("records auth.logout with the real actorId when a still-active token is revoked", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        revokedAt: null,
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.revoke("some-raw-token", "203.0.113.1");

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "user-1",
          action: "auth.logout",
          entityType: "user",
          entityId: "user-1",
          ipAddress: "203.0.113.1",
        }),
      });
    });

    it("does not record an audit entry when the token no longer exists", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await service.revoke("gone-token");

      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("does not record a second audit entry for an already-revoked token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        revokedAt: new Date(),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await service.revoke("already-revoked-token");

      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe("createUser", () => {
    const dto = {
      email: "new.agent@example.com",
      password: "at-least-8-chars",
      fullName: "New Agent",
      branchId: "branch-1",
      departmentId: "dept-1",
      roleId: "role-agent",
    };

    it("creates the user and its branch-role assignment", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const created = await service.createUser(dto);

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
      expect(created).toEqual({ id: expect.any(String), email: dto.email });
    });

    it("rejects a duplicate email without opening a transaction", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

      await expect(service.createUser(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("grantBranchAssignment", () => {
    const dto = { branchId: "branch-2", departmentId: "dept-2", roleId: "role-agent" };

    function mockHappyPath() {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ organizationId: "org-1" }) // caller's own branch
        .mockResolvedValueOnce({ id: "branch-2", organizationId: "org-1" }); // target branch
      prisma.user.findUnique.mockResolvedValue({ id: "target-user" });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-2", isActive: true });
      prisma.role.findUnique.mockResolvedValue({ id: "role-agent", isActive: true });
      prisma.userBranchRole.create.mockResolvedValue({ id: "ubr-new" });
    }

    it("grants the membership when everything validates, and records an audit entry", async () => {
      mockHappyPath();

      const result = await service.grantBranchAssignment("target-user", dto);

      expect(prisma.userBranchRole.create).toHaveBeenCalledWith({
        data: { userId: "target-user", branchId: "branch-2", departmentId: "dept-2", roleId: "role-agent" },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "user.branch_assignment_granted",
          entityType: "user",
          entityId: "target-user",
          // The ADMIN's OWN acting branch ("branch-1"), not the
          // (cross-branch) target ("branch-2") — see the service's own
          // comment for why.
          branchId: "branch-1",
          diff: { branchId: "branch-2", departmentId: "dept-2", roleId: "role-agent" },
        }),
      });
      expect(result).toEqual({ id: "ubr-new" });
    });

    it("omits departmentId (a branch-wide role) when the DTO doesn't provide one", async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "branch-2", organizationId: "org-1" });
      prisma.user.findUnique.mockResolvedValue({ id: "target-user" });
      prisma.role.findUnique.mockResolvedValue({ id: "role-agent", isActive: true });
      prisma.userBranchRole.create.mockResolvedValue({ id: "ubr-new" });

      await service.grantBranchAssignment("target-user", { branchId: "branch-2", roleId: "role-agent" });

      expect(prisma.userBranchRole.create).toHaveBeenCalledWith({
        data: { userId: "target-user", branchId: "branch-2", departmentId: null, roleId: "role-agent" },
      });
      expect(prisma.department.findFirst).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the target user does not exist", async () => {
      prisma.branch.findFirst.mockResolvedValueOnce({ organizationId: "org-1" });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.grantBranchAssignment("missing-user", dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.userBranchRole.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the target branch belongs to a different organization", async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ organizationId: "org-1" })
        .mockResolvedValueOnce(null); // target branch lookup, scoped by org-1, finds nothing
      prisma.user.findUnique.mockResolvedValue({ id: "target-user" });

      await expect(service.grantBranchAssignment("target-user", dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.branch.findFirst).toHaveBeenLastCalledWith({
        where: { id: "branch-2", organizationId: "org-1" },
      });
      expect(prisma.userBranchRole.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an unknown department", async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "branch-2", organizationId: "org-1" });
      prisma.user.findUnique.mockResolvedValue({ id: "target-user" });
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.grantBranchAssignment("target-user", dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws BadRequestException for an inactive department", async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "branch-2", organizationId: "org-1" });
      prisma.user.findUnique.mockResolvedValue({ id: "target-user" });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-2", isActive: false });

      await expect(service.grantBranchAssignment("target-user", dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("throws NotFoundException for an unknown role", async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "branch-2", organizationId: "org-1" });
      prisma.user.findUnique.mockResolvedValue({ id: "target-user" });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-2", isActive: true });
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.grantBranchAssignment("target-user", dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws BadRequestException for an inactive role", async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "branch-2", organizationId: "org-1" });
      prisma.user.findUnique.mockResolvedValue({ id: "target-user" });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-2", isActive: true });
      prisma.role.findUnique.mockResolvedValue({ id: "role-agent", isActive: false });

      await expect(service.grantBranchAssignment("target-user", dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("translates a P2002 duplicate-exact-assignment error into ConflictException", async () => {
      mockHappyPath();
      prisma.userBranchRole.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(service.grantBranchAssignment("target-user", dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    // Story 118 — Postgres unique constraints treat every NULL as
    // distinct from every other NULL, so the `@@unique` constraint alone
    // would never reject a second identical branch-wide (no-department)
    // grant. This explicit pre-check is what actually catches it.
    it("throws ConflictException for an exact-duplicate branch-wide (no-department) assignment, via the pre-check, not just P2002", async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "branch-2", organizationId: "org-1" });
      prisma.user.findUnique.mockResolvedValue({ id: "target-user" });
      prisma.role.findUnique.mockResolvedValue({ id: "role-agent", isActive: true });
      prisma.userBranchRole.findFirst.mockResolvedValue({ id: "existing-ubr" });

      await expect(
        service.grantBranchAssignment("target-user", { branchId: "branch-2", roleId: "role-agent" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.userBranchRole.create).not.toHaveBeenCalled();
    });
  });

  describe("listUsers", () => {
    it("scopes the query to the caller's active branch", async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: "user-1",
          email: "a@example.com",
          fullName: "A",
          isActive: true,
          lockedUntil: null,
          branchRoles: [{ branchId: "branch-1", role: { name: "Agent" } }],
        },
      ]);

      const result = await service.listUsers();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchRoles: { some: { branchId: "branch-1" } } },
        }),
      );
      expect(result).toEqual([
        {
          id: "user-1",
          email: "a@example.com",
          fullName: "A",
          isActive: true,
          roles: ["Agent"],
          isLocked: false,
          lockedUntil: null,
        },
      ]);
    });

    // Story 122 — Account Lockout.
    it("computes isLocked true for a user with a still-future lockedUntil, false once it has passed", async () => {
      const future = new Date(Date.now() + 10 * 60 * 1000);
      const past = new Date(Date.now() - 60 * 1000);
      prisma.user.findMany.mockResolvedValue([
        {
          id: "user-locked",
          email: "locked@example.com",
          fullName: "Locked User",
          isActive: true,
          lockedUntil: future,
          branchRoles: [{ branchId: "branch-1", role: { name: "Agent" } }],
        },
        {
          id: "user-expired",
          email: "expired@example.com",
          fullName: "Expired Lock User",
          isActive: true,
          lockedUntil: past,
          branchRoles: [{ branchId: "branch-1", role: { name: "Agent" } }],
        },
      ]);

      const result = await service.listUsers();

      expect(result).toEqual([
        expect.objectContaining({ id: "user-locked", isLocked: true, lockedUntil: future }),
        expect.objectContaining({ id: "user-expired", isLocked: false, lockedUntil: past }),
      ]);
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.listUsers()).rejects.toThrow(/no active branch/);
    });

    it("derives roleId/departmentId from the first (oldest-createdAt) branchRoles entry, not just whichever is present", async () => {
      // Deliberately constructed with 2+ entries, the "active" one first —
      // the same "first/oldest membership wins" rule `login`/`refresh`/
      // `getAuthenticatedUser` already use. If `listUsers` ever picked a
      // different entry (e.g. the last one, or merged fields across all of
      // them), this test would catch it.
      prisma.user.findMany.mockResolvedValue([
        {
          id: "user-1",
          email: "multi@example.com",
          fullName: "Multi Role",
          isActive: true,
          branchRoles: [
            {
              id: "ubr-old",
              branchId: "branch-1",
              departmentId: "dept-old",
              roleId: "role-old",
              createdAt: new Date("2024-01-01"),
              role: { name: "Agent" },
            },
            {
              id: "ubr-new",
              branchId: "branch-1",
              departmentId: "dept-new",
              roleId: "role-new",
              createdAt: new Date("2024-02-01"),
              role: { name: "Custom Role" },
            },
          ],
        },
      ]);

      const result = await service.listUsers();

      expect(result).toEqual([
        expect.objectContaining({
          id: "user-1",
          roleId: "role-old",
          departmentId: "dept-old",
        }),
      ]);
    });
  });

  describe("updateUser", () => {
    it("throws NotFoundException for an unknown id", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUser("missing-id", { fullName: "X" })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("only includes fields present in the DTO", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });

      await service.updateUser("user-1", { isActive: false });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { isActive: false },
      });
    });

    it("does NOT include email in the update data when it is omitted from the DTO", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });

      await service.updateUser("user-1", { fullName: "Renamed User" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { fullName: "Renamed User" },
      });
    });

    it("updates the email when only email is given in the DTO", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });

      await service.updateUser("user-1", { email: "new@example.com" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { email: "new@example.com" },
      });
    });

    it("updates email and fullName together when both are given", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });

      await service.updateUser("user-1", {
        email: "both@example.com",
        fullName: "Both Fields",
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { fullName: "Both Fields", email: "both@example.com" },
      });
    });

    it("translates a P2002 unique-constraint violation into ConflictException when updating email", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.user.update.mockRejectedValue(buildUniqueConstraintError());

      await expect(
        service.updateUser("user-1", { email: "taken@example.com" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("resetPassword", () => {
    it("hashes the new password and updates the user's passwordHash", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.user.update.mockResolvedValue({ id: "user-1" });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.resetPassword("user-1", { newPassword: "brand-new-password" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { passwordHash: "hashed:brand-new-password" },
      });
      expect(result).toEqual({ id: "user-1" });
    });

    it("revokes all of the user's currently-unrevoked refresh tokens as part of the flow", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.user.update.mockResolvedValue({ id: "user-1" });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.resetPassword("user-1", { newPassword: "brand-new-password" });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("throws NotFoundException for an unknown user id", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword("missing-id", { newPassword: "brand-new-password" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    // Story 84 — Explicit Audit Logging.
    it("records user.password_reset with the caller's actorId", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.user.update.mockResolvedValue({ id: "user-1" });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await service.resetPassword("user-1", { newPassword: "brand-new-password" });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "actor-1",
          action: "user.password_reset",
          entityType: "user",
          entityId: "user-1",
        }),
      });
    });
  });

  // Story 122 — Account Lockout.
  describe("unlockUser", () => {
    it("clears failedLoginAttempts/lockedUntil and returns { id }", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.user.update.mockResolvedValue({ id: "user-1" });

      const result = await service.unlockUser("user-1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      expect(result).toEqual({ id: "user-1" });
    });

    it("throws NotFoundException for an unknown user id, never calling update", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.unlockUser("missing-id")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("records user.unlocked with the caller's actorId", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.user.update.mockResolvedValue({ id: "user-1" });

      await service.unlockUser("user-1");

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "actor-1",
          action: "user.unlocked",
          entityType: "user",
          entityId: "user-1",
        }),
      });
    });
  });

  describe("updateUserAssignment", () => {
    const membership = {
      id: "ubr-1",
      userId: "user-1",
      branchId: "branch-1",
      departmentId: "dept-old",
      roleId: "role-old",
      role: { name: "Agent" },
    };
    const superAdminMembership = {
      id: "ubr-1",
      userId: "user-1",
      branchId: "branch-1",
      departmentId: "dept-old",
      roleId: "role-super-admin",
      role: { name: "SuperAdmin" },
    };

    it("updates only the role when only roleId is given", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.role.findUnique.mockResolvedValue({
        id: "role-new",
        name: "Custom Role",
        isActive: true,
      });
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      const result = await service.updateUserAssignment("user-1", { roleId: "role-new" });

      expect(prisma.userBranchRole.update).toHaveBeenCalledWith({
        where: { id: membership.id },
        data: { roleId: "role-new" },
      });
      expect(result).toEqual({ id: "user-1" });
    });

    it("updates only the department when only departmentId is given", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.department.findFirst.mockResolvedValue({
        id: "dept-new",
        branchId: "branch-1",
        isActive: true,
      });
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await service.updateUserAssignment("user-1", { departmentId: "dept-new" });

      expect(prisma.userBranchRole.update).toHaveBeenCalledWith({
        where: { id: membership.id },
        data: { departmentId: "dept-new" },
      });
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
    });

    it("updates both role and department when both are given", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.role.findUnique.mockResolvedValue({
        id: "role-new",
        name: "Custom Role",
        isActive: true,
      });
      prisma.department.findFirst.mockResolvedValue({
        id: "dept-new",
        branchId: "branch-1",
        isActive: true,
      });
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await service.updateUserAssignment("user-1", {
        roleId: "role-new",
        departmentId: "dept-new",
      });

      expect(prisma.userBranchRole.update).toHaveBeenCalledWith({
        where: { id: membership.id },
        data: { roleId: "role-new", departmentId: "dept-new" },
      });
    });

    it("clears the department when departmentId: null is given", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await service.updateUserAssignment("user-1", { departmentId: null });

      expect(prisma.department.findFirst).not.toHaveBeenCalled();
      expect(prisma.userBranchRole.update).toHaveBeenCalledWith({
        where: { id: membership.id },
        data: { departmentId: null },
      });
    });

    it("does nothing to either field when neither is given in the DTO", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await service.updateUserAssignment("user-1", {});

      expect(prisma.userBranchRole.update).toHaveBeenCalledWith({
        where: { id: membership.id },
        data: {},
      });
    });

    it("throws NotFoundException when the target user has no membership in the caller's branch", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(null);

      await expect(
        service.updateUserAssignment("user-1", { roleId: "role-new" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.userBranchRole.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when roleId doesn't exist", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserAssignment("user-1", { roleId: "missing-role" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.userBranchRole.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when the target role is inactive", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.role.findUnique.mockResolvedValue({
        id: "role-inactive",
        name: "Inactive Role",
        isActive: false,
      });

      await expect(
        service.updateUserAssignment("user-1", { roleId: "role-inactive" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.userBranchRole.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when departmentId doesn't exist or isn't in the caller's branch", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.updateUserAssignment("user-1", { departmentId: "not-in-branch" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.department.findFirst).toHaveBeenCalledWith({
        where: { id: "not-in-branch", branchId: "branch-1" },
      });
      expect(prisma.userBranchRole.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when the target department is inactive", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.department.findFirst.mockResolvedValue({
        id: "dept-inactive",
        branchId: "branch-1",
        isActive: false,
      });

      await expect(
        service.updateUserAssignment("user-1", { departmentId: "dept-inactive" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.userBranchRole.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException (last-SuperAdmin guard) when reassigning the sole active SuperAdmin away", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(superAdminMembership);
      prisma.role.findUnique.mockImplementation(
        async ({ where }: { where: { id?: string; name?: string } }) => {
          if (where.id === "role-agent") {
            return { id: "role-agent", name: "Agent", isActive: true };
          }
          if (where.name === "SuperAdmin") {
            return { id: "role-super-admin", name: "SuperAdmin", isActive: true };
          }
          return null;
        },
      );
      prisma.userBranchRole.count.mockResolvedValue(0);

      const promise = service.updateUserAssignment("user-1", { roleId: "role-agent" });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(/Cannot reassign the last SuperAdmin user/);
      expect(prisma.userBranchRole.update).not.toHaveBeenCalled();
    });

    it("does NOT throw the last-SuperAdmin guard when another active SuperAdmin exists", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(superAdminMembership);
      prisma.role.findUnique.mockImplementation(
        async ({ where }: { where: { id?: string; name?: string } }) => {
          if (where.id === "role-agent") {
            return { id: "role-agent", name: "Agent", isActive: true };
          }
          if (where.name === "SuperAdmin") {
            return { id: "role-super-admin", name: "SuperAdmin", isActive: true };
          }
          return null;
        },
      );
      prisma.userBranchRole.count.mockResolvedValue(1);
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await expect(
        service.updateUserAssignment("user-1", { roleId: "role-agent" }),
      ).resolves.toEqual({ id: "user-1" });
      expect(prisma.userBranchRole.update).toHaveBeenCalledWith({
        where: { id: superAdminMembership.id },
        data: { roleId: "role-agent" },
      });
    });

    it("does NOT run the last-SuperAdmin check at all when dto.roleId is undefined", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(superAdminMembership);
      prisma.department.findFirst.mockResolvedValue({
        id: "dept-new",
        branchId: "branch-1",
        isActive: true,
      });
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await service.updateUserAssignment("user-1", { departmentId: "dept-new" });

      expect(prisma.role.findUnique).not.toHaveBeenCalled();
      expect(prisma.userBranchRole.count).not.toHaveBeenCalled();
    });

    it("does NOT run the last-SuperAdmin check when the current role is NOT SuperAdmin", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.role.findUnique.mockResolvedValue({
        id: "role-new",
        name: "Custom Role",
        isActive: true,
      });
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await service.updateUserAssignment("user-1", { roleId: "role-new" });

      expect(prisma.role.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.role.findUnique).toHaveBeenCalledWith({ where: { id: "role-new" } });
      expect(prisma.userBranchRole.count).not.toHaveBeenCalled();
    });

    it("translates a P2002 unique-constraint violation into ConflictException", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.userBranchRole.update.mockRejectedValue(buildUniqueConstraintError());

      await expect(service.updateUserAssignment("user-1", {})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.updateUserAssignment("user-1", {})).rejects.toThrow(
        /no active branch/,
      );
    });

    it("records user.reassigned with a correct before/after diff for a role change", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.role.findUnique.mockResolvedValue({
        id: "role-new",
        name: "Custom Role",
        isActive: true,
      });
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await service.updateUserAssignment("user-1", { roleId: "role-new" });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "actor-1",
          action: "user.reassigned",
          entityType: "user",
          entityId: "user-1",
          branchId: "branch-1",
          diff: {
            before: { roleId: "role-old", departmentId: "dept-old" },
            after: { roleId: "role-new", departmentId: "dept-old" },
          },
        }),
      });
    });

    it("records user.reassigned with a correct before/after diff for a department change", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.department.findFirst.mockResolvedValue({
        id: "dept-new",
        branchId: "branch-1",
        isActive: true,
      });
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await service.updateUserAssignment("user-1", { departmentId: "dept-new" });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "user.reassigned",
          diff: {
            before: { roleId: "role-old", departmentId: "dept-old" },
            after: { roleId: "role-old", departmentId: "dept-new" },
          },
        }),
      });
    });

    it("records user.reassigned with a correct before/after diff when both role and department change", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.role.findUnique.mockResolvedValue({
        id: "role-new",
        name: "Custom Role",
        isActive: true,
      });
      prisma.department.findFirst.mockResolvedValue({
        id: "dept-new",
        branchId: "branch-1",
        isActive: true,
      });
      prisma.userBranchRole.update.mockResolvedValue({ id: "ubr-1" });

      await service.updateUserAssignment("user-1", {
        roleId: "role-new",
        departmentId: "dept-new",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "user.reassigned",
          diff: {
            before: { roleId: "role-old", departmentId: "dept-old" },
            after: { roleId: "role-new", departmentId: "dept-new" },
          },
        }),
      });
    });

    it("does not record an audit entry when the target role doesn't exist", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(membership);
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserAssignment("user-1", { roleId: "missing-role" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("does not record an audit entry when blocked by the last-SuperAdmin guard", async () => {
      prisma.userBranchRole.findFirst.mockResolvedValue(superAdminMembership);
      prisma.role.findUnique.mockImplementation(
        async ({ where }: { where: { id?: string; name?: string } }) => {
          if (where.id === "role-agent") {
            return { id: "role-agent", name: "Agent", isActive: true };
          }
          if (where.name === "SuperAdmin") {
            return { id: "role-super-admin", name: "SuperAdmin", isActive: true };
          }
          return null;
        },
      );
      prisma.userBranchRole.count.mockResolvedValue(0);

      await expect(
        service.updateUserAssignment("user-1", { roleId: "role-agent" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe("listBranches", () => {
    it("scopes to the caller's own branch and returns exactly that branch", async () => {
      prisma.branch.findFirst.mockResolvedValue({
        id: "branch-1",
        name: "Main Branch",
        isActive: true,
      });

      const result = await service.listBranches();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: "branch-1", isActive: true },
        select: { id: true, name: true, isActive: true },
      });
      expect(result).toEqual([{ id: "branch-1", name: "Main Branch", isActive: true }]);
    });

    it("returns an empty array if the branch row is somehow gone", async () => {
      prisma.branch.findFirst.mockResolvedValue(null);

      const result = await service.listBranches();

      expect(result).toEqual([]);
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.listBranches()).rejects.toThrow(/no active branch/);
    });

    it("by default excludes inactive branches from the where clause", async () => {
      prisma.branch.findFirst.mockResolvedValue(null);

      await service.listBranches();

      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "branch-1", isActive: true } }),
      );
    });

    it("includeInactive: true drops the isActive filter so inactive branches are included", async () => {
      prisma.branch.findFirst.mockResolvedValue({
        id: "branch-1",
        name: "Main Branch",
        isActive: false,
      });

      const result = await service.listBranches(true);

      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: "branch-1" },
        select: { id: true, name: true, isActive: true },
      });
      expect(result).toEqual([{ id: "branch-1", name: "Main Branch", isActive: false }]);
    });
  });

  describe("listDepartments", () => {
    it("scopes the query to the caller's active branch", async () => {
      prisma.department.findMany.mockResolvedValue([
        { id: "dept-1", branchId: "branch-1", name: "Support", isActive: true },
      ]);

      const result = await service.listDepartments();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1", isActive: true } }),
      );
      expect(result).toEqual([
        { id: "dept-1", branchId: "branch-1", name: "Support", isActive: true },
      ]);
    });

    it("returns an empty array when the branch has no departments", async () => {
      prisma.department.findMany.mockResolvedValue([]);

      const result = await service.listDepartments();

      expect(result).toEqual([]);
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.listDepartments()).rejects.toThrow(/no active branch/);
    });

    it("by default excludes inactive departments from the where clause", async () => {
      prisma.department.findMany.mockResolvedValue([]);

      await service.listDepartments();

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1", isActive: true } }),
      );
    });

    it("includeInactive: true drops the isActive filter so inactive departments are included", async () => {
      prisma.department.findMany.mockResolvedValue([
        { id: "dept-1", branchId: "branch-1", name: "Support", isActive: false },
      ]);

      const result = await service.listDepartments(true);

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
      );
      expect(result).toEqual([
        { id: "dept-1", branchId: "branch-1", name: "Support", isActive: false },
      ]);
    });
  });

  describe("updateBranch", () => {
    it("updates only the fields present in the DTO", async () => {
      prisma.branch.update.mockResolvedValue({ id: "branch-1" });

      await service.updateBranch("branch-1", { name: "Renamed Branch" });

      expect(prisma.branch.update).toHaveBeenCalledWith({
        where: { id: "branch-1" },
        data: { name: "Renamed Branch" },
      });
    });

    it("throws NotFoundException when id !== tenantContext's branchId", async () => {
      await expect(
        service.updateBranch("some-other-branch", { name: "Renamed Branch" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.branch.update).not.toHaveBeenCalled();
    });

    it("translates a P2002 unique-constraint violation into ConflictException", async () => {
      prisma.branch.update.mockRejectedValue(buildUniqueConstraintError());

      await expect(
        service.updateBranch("branch-1", { name: "Duplicate Name" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("toggles isActive alone without touching name/timezone", async () => {
      prisma.branch.update.mockResolvedValue({ id: "branch-1" });

      await service.updateBranch("branch-1", { isActive: false });

      expect(prisma.branch.update).toHaveBeenCalledWith({
        where: { id: "branch-1" },
        data: { isActive: false },
      });
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.updateBranch("branch-1", { name: "X" })).rejects.toThrow(
        /no active branch/,
      );
    });
  });

  // Story 107 — Branch creation.
  describe("createBranch", () => {
    it("resolves organizationId from the caller's own branch, never from the DTO", async () => {
      prisma.branch.findFirst.mockResolvedValue({ organizationId: "org-1" });
      prisma.branch.create.mockResolvedValue({ id: "new-branch-id" });

      const result = await service.createBranch({
        name: "Second Branch",
        timezone: "Africa/Cairo",
      });

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: "branch-1" },
        select: { organizationId: true },
      });
      expect(prisma.branch.create).toHaveBeenCalledWith({
        data: { organizationId: "org-1", name: "Second Branch", timezone: "Africa/Cairo" },
      });
      expect(result).toEqual({ id: "new-branch-id" });
    });

    it("includes isActive in the create call only when the DTO provides it", async () => {
      prisma.branch.findFirst.mockResolvedValue({ organizationId: "org-1" });
      prisma.branch.create.mockResolvedValue({ id: "new-branch-id" });

      await service.createBranch({
        name: "Second Branch",
        timezone: "Africa/Cairo",
        isActive: false,
      });

      expect(prisma.branch.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          name: "Second Branch",
          timezone: "Africa/Cairo",
          isActive: false,
        },
      });
    });

    it("throws NotFoundException if the caller's own branch is somehow gone", async () => {
      prisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.createBranch({ name: "Second Branch", timezone: "Africa/Cairo" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.branch.create).not.toHaveBeenCalled();
    });

    it("translates a P2002 unique-constraint violation into ConflictException", async () => {
      prisma.branch.findFirst.mockResolvedValue({ organizationId: "org-1" });
      prisma.branch.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(
        service.createBranch({ name: "Duplicate Name", timezone: "Africa/Cairo" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(
        service.createBranch({ name: "Second Branch", timezone: "Africa/Cairo" }),
      ).rejects.toThrow(/no active branch/);
    });
  });

  describe("createDepartment", () => {
    it("assigns branchId from TenantContext, not from the DTO", async () => {
      prisma.department.create.mockResolvedValue({
        id: "dept-1",
        branchId: "branch-1",
        name: "Billing",
        isActive: true,
      });

      const result = await service.createDepartment({ name: "Billing" });

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: { branchId: "branch-1", name: "Billing" },
      });
      expect(result).toEqual({ id: "dept-1" });
    });

    it("translates a P2002 unique-constraint violation into ConflictException", async () => {
      prisma.department.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(service.createDepartment({ name: "Billing" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.createDepartment({ name: "Billing" })).rejects.toThrow(
        /no active branch/,
      );
    });
  });

  describe("updateDepartment", () => {
    it("updates only the fields present in the DTO", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1", branchId: "branch-1" });
      prisma.department.update.mockResolvedValue({ id: "dept-1" });

      await service.updateDepartment("dept-1", { name: "Renamed Department" });

      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: "dept-1" },
        data: { name: "Renamed Department" },
      });
    });

    it("throws NotFoundException when the department isn't found in the caller's branch scope", async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDepartment("missing-dept", { name: "X" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.department.findFirst).toHaveBeenCalledWith({
        where: { id: "missing-dept", branchId: "branch-1" },
      });
      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it("translates a P2002 unique-constraint violation into ConflictException", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1", branchId: "branch-1" });
      prisma.department.update.mockRejectedValue(buildUniqueConstraintError());

      await expect(
        service.updateDepartment("dept-1", { name: "Duplicate Name" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("toggles isActive alone", async () => {
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1", branchId: "branch-1" });
      prisma.department.update.mockResolvedValue({ id: "dept-1" });

      await service.updateDepartment("dept-1", { isActive: false });

      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: "dept-1" },
        data: { isActive: false },
      });
    });
  });

  describe("createRole", () => {
    it("creates a role with just the given name, returning { id }", async () => {
      prisma.role.create.mockResolvedValue({ id: "role-1" });

      const result = await service.createRole({ name: "Custom Role" });

      expect(prisma.role.create).toHaveBeenCalledWith({ data: { name: "Custom Role" } });
      expect(result).toEqual({ id: "role-1" });
    });

    it("translates a P2002 unique-constraint violation into ConflictException", async () => {
      prisma.role.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(service.createRole({ name: "Duplicate Role" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    // Story 68 — Ticket Department-Scoped Visibility.
    it("omits ticketVisibilityScope when not given, defaulting to the Prisma column's own BRANCH default", async () => {
      prisma.role.create.mockResolvedValue({ id: "role-1" });

      await service.createRole({ name: "Custom Role" });

      expect(prisma.role.create).toHaveBeenCalledWith({ data: { name: "Custom Role" } });
    });

    it("passes ticketVisibilityScope through when given", async () => {
      prisma.role.create.mockResolvedValue({ id: "role-1" });

      await service.createRole({ name: "Dept Role", ticketVisibilityScope: "DEPARTMENT" });

      expect(prisma.role.create).toHaveBeenCalledWith({
        data: { name: "Dept Role", ticketVisibilityScope: "DEPARTMENT" },
      });
    });
  });

  describe("updateRole", () => {
    it("updates only the fields present in the DTO for a non-protected (custom) role", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
      });
      prisma.role.update.mockResolvedValue({ id: "role-1" });

      const result = await service.updateRole("role-1", { name: "Renamed Custom Role" });

      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: "role-1" },
        data: { name: "Renamed Custom Role" },
      });
      expect(result).toEqual({ id: "role-1" });
    });

    it("throws NotFoundException for an unknown role id", async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRole("missing-role", { name: "Whatever" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when attempting to rename SuperAdmin", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-super-admin",
        name: "SuperAdmin",
        isActive: true,
      });

      await expect(
        service.updateRole("role-super-admin", { name: "Renamed Super Admin" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when attempting to deactivate Agent", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-agent",
        name: "Agent",
        isActive: true,
      });

      await expect(
        service.updateRole("role-agent", { isActive: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it("does not throw for a no-op update (empty DTO) sent for a protected role", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-super-admin",
        name: "SuperAdmin",
        isActive: true,
      });
      prisma.role.update.mockResolvedValue({ id: "role-super-admin" });

      // Neither `name` nor `isActive` is present, so `updateRole`'s
      // protection guard (which only fires when one of those two fields is
      // present) does not trip — the real implementation falls through to
      // an actual (no-op-data) `prisma.role.update` call rather than a 400.
      await expect(service.updateRole("role-super-admin", {})).resolves.toEqual({
        id: "role-super-admin",
      });
      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: "role-super-admin" },
        data: {},
      });
    });

    it("translates a P2002 unique-constraint violation into ConflictException", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
      });
      prisma.role.update.mockRejectedValue(buildUniqueConstraintError());

      await expect(
        service.updateRole("role-1", { name: "Duplicate Name" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // Story 68 — Ticket Department-Scoped Visibility. Deliberately allowed
    // on a protected role (mirrors `setRolePermissions`'s own precedent):
    // opting `Agent` into department scoping is the entire point.
    it("allows setting ticketVisibilityScope on a protected role (Agent) with no name/isActive change", async () => {
      prisma.role.findUnique.mockResolvedValue({ id: "role-agent", name: "Agent", isActive: true });
      prisma.role.update.mockResolvedValue({ id: "role-agent" });

      await service.updateRole("role-agent", { ticketVisibilityScope: "DEPARTMENT" });

      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: "role-agent" },
        data: { ticketVisibilityScope: "DEPARTMENT" },
      });
    });

    it("records role.updated with a correct before/after diff for a rename", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
        ticketVisibilityScope: "BRANCH",
      });
      prisma.role.update.mockResolvedValue({ id: "role-1" });

      await service.updateRole("role-1", { name: "Renamed Custom Role" });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "actor-1",
          action: "role.updated",
          entityType: "role",
          entityId: "role-1",
          diff: {
            before: { name: "Custom Role", isActive: true, ticketVisibilityScope: "BRANCH" },
            after: { name: "Renamed Custom Role", isActive: true, ticketVisibilityScope: "BRANCH" },
          },
        }),
      });
    });

    it("records role.updated with a correct before/after diff for an activate/deactivate change", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
        ticketVisibilityScope: "BRANCH",
      });
      prisma.role.update.mockResolvedValue({ id: "role-1" });

      await service.updateRole("role-1", { isActive: false });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "role.updated",
          diff: {
            before: { name: "Custom Role", isActive: true, ticketVisibilityScope: "BRANCH" },
            after: { name: "Custom Role", isActive: false, ticketVisibilityScope: "BRANCH" },
          },
        }),
      });
    });

    it("records role.updated with a correct before/after diff for a ticketVisibilityScope change", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-agent",
        name: "Agent",
        isActive: true,
        ticketVisibilityScope: "BRANCH",
      });
      prisma.role.update.mockResolvedValue({ id: "role-agent" });

      await service.updateRole("role-agent", { ticketVisibilityScope: "DEPARTMENT" });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "role.updated",
          diff: {
            before: { name: "Agent", isActive: true, ticketVisibilityScope: "BRANCH" },
            after: { name: "Agent", isActive: true, ticketVisibilityScope: "DEPARTMENT" },
          },
        }),
      });
    });

    it("does not record an audit entry when blocked by the protected-role guard", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-super-admin",
        name: "SuperAdmin",
        isActive: true,
      });

      await expect(
        service.updateRole("role-super-admin", { name: "Renamed Super Admin" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("does not record an audit entry for an unknown role id", async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRole("missing-role", { name: "Whatever" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe("setRolePermissions", () => {
    it("replaces a role's permissions with the exact given set", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
      });
      prisma.permission.findMany.mockResolvedValue([
        { id: "perm-1", key: "ticket:read" },
        { id: "perm-2", key: "ticket:create" },
      ]);

      const result = await service.setRolePermissions("role-1", {
        permissionKeys: ["ticket:read", "ticket:create"],
      });

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: "role-1" },
      });
      expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { roleId: "role-1", permissionId: "perm-1" },
          { roleId: "role-1", permissionId: "perm-2" },
        ],
      });
      expect(result).toEqual({ id: "role-1" });
    });

    it("revokes all permissions when permissionKeys is an empty array", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
      });
      prisma.permission.findMany.mockResolvedValue([]);

      await service.setRolePermissions("role-1", { permissionKeys: [] });

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: "role-1" },
      });
      expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an unknown role id", async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.setRolePermissions("missing-role", { permissionKeys: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    });

    it("throws BadRequestException listing the exact unknown key(s)", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
      });
      prisma.permission.findMany.mockResolvedValue([{ id: "perm-1", key: "ticket:read" }]);

      const promise = service.setRolePermissions("role-1", {
        permissionKeys: ["ticket:read", "bogus:key"],
      });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(/bogus:key/);
      expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    });

    it("succeeds against SuperAdmin, unlike updateRole's protection check", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-super-admin",
        name: "SuperAdmin",
        isActive: true,
      });
      prisma.permission.findMany.mockResolvedValue([{ id: "perm-1", key: "ticket:read" }]);

      await expect(
        service.setRolePermissions("role-super-admin", { permissionKeys: ["ticket:read"] }),
      ).resolves.toEqual({ id: "role-super-admin" });
      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: "role-super-admin" },
      });
    });

    it("succeeds against Agent, unlike updateRole's protection check", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-agent",
        name: "Agent",
        isActive: true,
      });
      prisma.permission.findMany.mockResolvedValue([{ id: "perm-1", key: "ticket:read" }]);

      await expect(
        service.setRolePermissions("role-agent", { permissionKeys: ["ticket:read"] }),
      ).resolves.toEqual({ id: "role-agent" });
      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: "role-agent" },
      });
    });

    it("records role.permissions_updated with correct before/after sorted key arrays", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
      });
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { key: "ticket:create" } },
        { permission: { key: "ticket:read" } },
      ]);
      prisma.permission.findMany.mockResolvedValue([
        { id: "perm-3", key: "user:read" },
        { id: "perm-4", key: "ticket:read" },
      ]);

      await service.setRolePermissions("role-1", {
        permissionKeys: ["user:read", "ticket:read"],
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: "actor-1",
          action: "role.permissions_updated",
          entityType: "role",
          entityId: "role-1",
          diff: {
            before: ["ticket:create", "ticket:read"],
            after: ["ticket:read", "user:read"],
          },
        }),
      });
    });

    it("records role.permissions_updated with an empty before array when the role had no existing permissions", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
      });
      prisma.rolePermission.findMany.mockResolvedValue([]);
      prisma.permission.findMany.mockResolvedValue([{ id: "perm-1", key: "ticket:read" }]);

      await service.setRolePermissions("role-1", { permissionKeys: ["ticket:read"] });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "role.permissions_updated",
          diff: { before: [], after: ["ticket:read"] },
        }),
      });
    });

    it("records role.permissions_updated with an empty after array when permissionKeys is an empty array", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
      });
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { key: "ticket:read" } },
      ]);
      prisma.permission.findMany.mockResolvedValue([]);

      await service.setRolePermissions("role-1", { permissionKeys: [] });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "role.permissions_updated",
          diff: { before: ["ticket:read"], after: [] },
        }),
      });
    });

    it("does not record an audit entry for an unknown role id", async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.setRolePermissions("missing-role", { permissionKeys: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("does not record an audit entry when an unknown permission key is given", async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: "role-1",
        name: "Custom Role",
        isActive: true,
      });
      prisma.permission.findMany.mockResolvedValue([{ id: "perm-1", key: "ticket:read" }]);

      await expect(
        service.setRolePermissions("role-1", { permissionKeys: ["ticket:read", "bogus:key"] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe("listRoles", () => {
    it("maps roles to their granted permission keys", async () => {
      prisma.role.findMany.mockResolvedValue([
        {
          id: "role-1",
          name: "SuperAdmin",
          permissions: [
            { permission: { key: "user:create" } },
            { permission: { key: "user:read" } },
          ],
        },
      ]);

      const result = await service.listRoles();

      expect(result).toEqual([
        { id: "role-1", name: "SuperAdmin", permissions: ["user:create", "user:read"] },
      ]);
    });

    // Story 68 — Ticket Department-Scoped Visibility.
    it("includes each role's ticketVisibilityScope", async () => {
      prisma.role.findMany.mockResolvedValue([
        {
          id: "role-1",
          name: "Dept Role",
          isActive: true,
          ticketVisibilityScope: "DEPARTMENT",
          permissions: [],
        },
      ]);

      const result = await service.listRoles();

      expect(result[0]).toMatchObject({ ticketVisibilityScope: "DEPARTMENT" });
    });

    it("by default excludes inactive roles from the where clause", async () => {
      prisma.role.findMany.mockResolvedValue([]);

      await service.listRoles();

      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it("includeInactive: true drops the isActive filter so inactive roles are included", async () => {
      prisma.role.findMany.mockResolvedValue([]);

      await service.listRoles(true);

      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe("listPermissions", () => {
    it("maps the permission catalog", async () => {
      prisma.permission.findMany.mockResolvedValue([{ id: "perm-1", key: "user:read" }]);

      const result = await service.listPermissions();

      expect(result).toEqual([{ id: "perm-1", key: "user:read" }]);
    });
  });
});

describe("hashPassword", () => {
  it("delegates to bcrypt.hash", async () => {
    const result = await hashPassword("plain-text");
    expect(result).toBe("hashed:plain-text");
  });
});
