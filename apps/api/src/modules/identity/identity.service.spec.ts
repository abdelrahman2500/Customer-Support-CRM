import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
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
    },
    department: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    userBranchRole: {
      create: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
    },
    permission: {
      findMany: vi.fn(),
    },
    // The real PrismaService's $transaction runs the callback with a
    // transactional client — for these unit tests, the mock's model
    // methods above double as that client, matching how `createUser`
    // uses `tx.user.create` / `tx.userBranchRole.create`.
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prismaSelfRef)),
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
        branchRoles: [],
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.login("admin@example.com", "wrong-password")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
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

  describe("listUsers", () => {
    it("scopes the query to the caller's active branch", async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: "user-1",
          email: "a@example.com",
          fullName: "A",
          isActive: true,
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
        { id: "user-1", email: "a@example.com", fullName: "A", isActive: true, roles: ["Agent"] },
      ]);
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, jwtService, configService, tenantContext);

      await expect(service.listUsers()).rejects.toThrow(/no active branch/);
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
