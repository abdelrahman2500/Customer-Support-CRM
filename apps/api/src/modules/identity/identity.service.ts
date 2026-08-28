import { randomBytes, createHmac } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser, AuthTokenPair, JwtAccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { EnvConfig } from "../../common/config/env.validation";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import type { UpdateBranchDto } from "./dto/update-branch.dto";
import type { CreateDepartmentDto } from "./dto/create-department.dto";
import type { UpdateDepartmentDto } from "./dto/update-department.dto";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";
import type { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";

const BCRYPT_ROUNDS = 12;
const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * Story 46 — the two seeded roles `seed.ts` keys its reconciliation logic
 * on by literal name. Renaming either would cause the next `prisma:seed`
 * run to create a duplicate role under the original name; deactivating
 * `SuperAdmin` risks an unrecoverable lockout. Permission *assignment* on
 * both remains fully allowed — only rename/(de)activate is blocked.
 */
const PROTECTED_ROLE_NAMES = new Set(["SuperAdmin", "Agent"]);

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
}

/**
 * Story 35 — the caller's own branch only (via `TenantContext.requireBranchScope()`,
 * the same enforcement every other scoped query in this codebase uses),
 * not every branch in the organization: nothing in this codebase's auth
 * model lets a token's active branch see another branch's data ("Cross-branch
 * access is an explicit, audited permission, never a default" —
 * docs/architecture/04-data-and-multitenancy.md), and no story has decided
 * a cross-branch listing/branch-switching UI yet. Returns exactly one
 * element today; the shape is a list because a future branch-switching
 * story could legitimately expand this without a breaking response-shape
 * change.
 */
export interface BranchSummary {
  id: string;
  name: string;
  isActive: boolean;
}

/** Story 35 — every department within the caller's own branch (same
 * branch-scoping rule as `BranchSummary`). */
export interface DepartmentSummary {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}

export interface RoleSummary {
  id: string;
  name: string;
  isActive: boolean;
  permissions: string[];
}

export interface PermissionSummary {
  id: string;
  key: string;
}

/**
 * Owns branches/departments/users/roles/permissions AND the auth session
 * logic (login/refresh/logout/me) — see `identity.module.ts`. This class is
 * request-scoped (transitively, via `TenantContext`) so `listUsers()` can
 * resolve the caller's active branch without a branch id ever being
 * accepted from the client — see docs/architecture/04-data-and-multitenancy.md
 * ("Enforcement: TenantContext").
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * Verifies credentials and issues a fresh access/refresh pair.
   * Throws `UnauthorizedException` on any failure — deliberately without
   * distinguishing "no such user" from "wrong password" in the response,
   * to avoid leaking which emails are registered.
   */
  async login(email: string, password: string): Promise<AuthTokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { branchRoles: { include: { role: true }, orderBy: { createdAt: "asc" } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const accessToken = await this.issueAccessToken(user.id, user.branchRoles);
    const { raw: refreshToken } = await this.createRefreshTokenRecord(user.id);
    return { accessToken, refreshToken };
  }

  /**
   * Rotates a refresh token: the presented token is validated against its
   * stored hash, revoked, and a brand-new access/refresh pair is issued.
   * A token that is unknown, expired, or already revoked is rejected —
   * including a token that was already rotated once (reuse of a revoked
   * token is a signal of a possibly stolen token, so it fails closed rather
   * than silently reissuing).
   */
  async refresh(presentedToken: string): Promise<AuthTokenPair> {
    const tokenHash = this.hashRefreshToken(presentedToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      include: { branchRoles: { include: { role: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const { raw: newRawToken, id: newTokenId } = await this.createRefreshTokenRecord(user.id);
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedBy: newTokenId },
    });

    const accessToken = await this.issueAccessToken(user.id, user.branchRoles);
    return { accessToken, refreshToken: newRawToken };
  }

  /** Revokes a refresh token (logout). Silently no-ops if it's already gone. */
  async revoke(presentedToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { branchRoles: { include: { role: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    const active = user.branchRoles[0];
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      branchId: active?.branchId ?? null,
      departmentId: active?.departmentId ?? null,
      roles: user.branchRoles
        .filter(
          (br) => br.branchId === active?.branchId && br.departmentId === active?.departmentId,
        )
        .map((br) => br.role.name),
    };
  }

  /**
   * Creates a user scoped to a branch (and optionally a department) with a
   * given role. The target branch is whatever the caller specifies in the
   * DTO — an admin managing several branches is expected to pick one —
   * this is deliberately not auto-scoped to the caller's own
   * `TenantContext` branch (unlike `listUsers`, below).
   */
  async createUser(dto: CreateUserDto): Promise<{ id: string; email: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const passwordHash = await hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: dto.email, passwordHash, fullName: dto.fullName },
      });
      await tx.userBranchRole.create({
        data: {
          userId: created.id,
          branchId: dto.branchId,
          departmentId: dto.departmentId ?? null,
          roleId: dto.roleId,
        },
      });
      return created;
    });

    return { id: user.id, email: user.email };
  }

  /**
   * Lists users in the caller's active branch — the first real consumer of
   * `TenantContext.requireBranchScope()` (present since Story 02, unused
   * until now). A user with roles in the branch under more than one
   * department/role combination is still listed once.
   */
  async listUsers(): Promise<UserSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const users = await this.prisma.user.findMany({
      where: { branchRoles: { some: { branchId } } },
      include: { branchRoles: { where: { branchId }, include: { role: true } } },
      orderBy: { createdAt: "asc" },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      roles: [...new Set(user.branchRoles.map((br) => br.role.name))],
    }));
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<{ id: string }> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return { id };
  }

  /**
   * Story 35 — first real consumer of `Branch` beyond the auth/tenant
   * plumbing itself. Scoped to the caller's own branch (see `BranchSummary`'s
   * doc comment) — mirrors `listUsers`'s `requireBranchScope()` pattern
   * exactly.
   */
  async listBranches(includeInactive = false): Promise<BranchSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, ...(includeInactive ? {} : { isActive: true }) },
      select: { id: true, name: true, isActive: true },
    });
    return branch ? [branch] : [];
  }

  /** Story 35 — every department within the caller's own branch. */
  async listDepartments(includeInactive = false): Promise<DepartmentSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const departments = await this.prisma.department.findMany({
      where: { branchId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    });
    return departments.map((department) => ({
      id: department.id,
      branchId: department.branchId,
      name: department.name,
      isActive: department.isActive,
    }));
  }

  /**
   * Renames/(de)activates the caller's own branch — never another branch,
   * and never creates one (there is deliberately no `createBranch`; branch
   * creation stays out of scope for this story). The scope check is a plain
   * identity comparison against `TenantContext`, not a DB lookup: the
   * caller's own branch id is already known and trusted.
   */
  async updateBranch(id: string, dto: UpdateBranchDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    if (id !== branchId) {
      throw new NotFoundException("Branch not found");
    }

    try {
      await this.prisma.branch.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      return { id };
    } catch (error) {
      throw translateDuplicateBranchName(error);
    }
  }

  /**
   * Creates a department in the caller's own branch — `branchId` always
   * comes from `TenantContext`, never from the DTO, mirroring
   * `CustomersService.createCustomer`.
   */
  async createDepartment(dto: CreateDepartmentDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    try {
      const department = await this.prisma.department.create({
        data: { branchId, name: dto.name },
      });
      return { id: department.id };
    } catch (error) {
      throw translateDuplicateDepartmentName(error);
    }
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto): Promise<{ id: string }> {
    await this.requireDepartmentInScope(id);

    try {
      await this.prisma.department.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      return { id };
    } catch (error) {
      throw translateDuplicateDepartmentName(error);
    }
  }

  async listRoles(includeInactive = false): Promise<RoleSummary[]> {
    const roles = await this.prisma.role.findMany({
      where: { ...(includeInactive ? {} : { isActive: true }) },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      isActive: role.isActive,
      permissions: role.permissions.map((rp) => rp.permission.key),
    }));
  }

  async listPermissions(): Promise<PermissionSummary[]> {
    const permissions = await this.prisma.permission.findMany({ orderBy: { key: "asc" } });
    return permissions.map((permission) => ({ id: permission.id, key: permission.key }));
  }

  /**
   * Creates a custom Role with no permissions — assignment is a deliberate
   * separate call (`setRolePermissions`); see Story 46 plan §6.
   */
  async createRole(dto: CreateRoleDto): Promise<{ id: string }> {
    try {
      const role = await this.prisma.role.create({ data: { name: dto.name } });
      return { id: role.id };
    } catch (error) {
      throw translateDuplicateRoleName(error);
    }
  }

  /**
   * Renames/(de)activates a Role. `SuperAdmin`/`Agent` are protected —
   * `seed.ts` reconciles by literal name, and deactivating `SuperAdmin`
   * risks an unrecoverable lockout — so a rename/(de)activate attempt on
   * either is rejected with `400`, never a raw 500 or a silent no-op.
   */
  async updateRole(id: string, dto: UpdateRoleDto): Promise<{ id: string }> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException("Role not found");
    }

    if (
      PROTECTED_ROLE_NAMES.has(role.name) &&
      (dto.name !== undefined || dto.isActive !== undefined)
    ) {
      throw new BadRequestException("Built-in roles cannot be renamed or deactivated");
    }

    try {
      await this.prisma.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      return { id };
    } catch (error) {
      throw translateDuplicateRoleName(error);
    }
  }

  /**
   * Full-replace permission assignment for a Role — mirrors `seed.ts`'s own
   * delete-then-recreate reconciliation transaction exactly. Deliberately
   * allowed on every role including the two protected ones (`SuperAdmin`/
   * `Agent`): granting `Agent` its first real permissions is the entire
   * point of this story, so no protection check runs here.
   */
  async setRolePermissions(id: string, dto: SetRolePermissionsDto): Promise<{ id: string }> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException("Role not found");
    }

    const uniqueKeys = [...new Set(dto.permissionKeys)];
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: uniqueKeys } },
    });

    if (permissions.length !== uniqueKeys.length) {
      const foundKeys = new Set(permissions.map((p) => p.key));
      const missing = uniqueKeys.filter((key) => !foundKeys.has(key));
      throw new BadRequestException(`Unknown permission key(s): ${missing.join(", ")}`);
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      ...(permissions.length > 0
        ? [
            this.prisma.rolePermission.createMany({
              data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
            }),
          ]
        : []),
    ]);

    return { id };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async requireDepartmentInScope(id: string): Promise<void> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const department = await this.prisma.department.findFirst({ where: { id, branchId } });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
  }

  private async issueAccessToken(
    userId: string,
    branchRoles: Array<{ branchId: string; departmentId: string | null; role: { name: string } }>,
  ): Promise<string> {
    // NOTE: a user can hold roles in multiple branches/departments; this
    // foundation story has no branch-switching UI yet, so the first
    // assignment (by creation order) becomes the token's active context.
    // Replacing this with an explicit "switch branch" flow is future work,
    // not a gap introduced here — see docs/architecture/04-data-and-multitenancy.md.
    const active = branchRoles[0];
    const claims: JwtAccessTokenClaims = {
      sub: userId,
      audience: "agent",
      branchId: active?.branchId ?? null,
      departmentId: active?.departmentId ?? null,
      roles: branchRoles
        .filter(
          (br) => br.branchId === active?.branchId && br.departmentId === active?.departmentId,
        )
        .map((br) => br.role.name),
    };
    return this.jwtService.signAsync(claims);
  }

  private async createRefreshTokenRecord(userId: string): Promise<{ raw: string; id: string }> {
    const raw = randomBytes(48).toString("base64url");
    const tokenHash = this.hashRefreshToken(raw);
    const ttlDays = this.configService.get("JWT_REFRESH_TTL_DAYS", { infer: true });
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });
    return { raw, id: record.id };
  }

  private hashRefreshToken(raw: string): string {
    const secret = this.configService.get("JWT_REFRESH_SECRET", { infer: true });
    return createHmac("sha256", secret).update(raw).digest("hex");
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * A duplicate branch name within the same organization is caught here by
 * Prisma's `P2002` unique-constraint-violation code (backstopping the
 * `@@unique([organizationId, name])` constraint) and turned into a
 * `ConflictException` — never a raw 500.
 */
function translateDuplicateBranchName(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return new ConflictException("A branch with this name already exists");
  }
  return error as Error;
}

/**
 * A duplicate department name within the same branch is caught here by
 * Prisma's `P2002` unique-constraint-violation code (backstopping the
 * `@@unique([branchId, name])` constraint) and turned into a
 * `ConflictException` — never a raw 500.
 */
function translateDuplicateDepartmentName(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return new ConflictException("A department with this name already exists");
  }
  return error as Error;
}

/**
 * A duplicate role name is caught here by Prisma's `P2002`
 * unique-constraint-violation code (backstopping `Role.name`'s pre-existing
 * `@unique` constraint) and turned into a `ConflictException` — never a raw
 * 500.
 */
function translateDuplicateRoleName(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return new ConflictException("A role with this name already exists");
  }
  return error as Error;
}
