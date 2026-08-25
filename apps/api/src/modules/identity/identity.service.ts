import { randomBytes, createHmac } from "node:crypto";
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AuthenticatedUser, AuthTokenPair, JwtAccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { EnvConfig } from "../../common/config/env.validation";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";

const BCRYPT_ROUNDS = 12;

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
}

export interface RoleSummary {
  id: string;
  name: string;
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

  async listRoles(): Promise<RoleSummary[]> {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissions: role.permissions.map((rp) => rp.permission.key),
    }));
  }

  async listPermissions(): Promise<PermissionSummary[]> {
    const permissions = await this.prisma.permission.findMany({ orderBy: { key: "asc" } });
    return permissions.map((permission) => ({ id: permission.id, key: permission.key }));
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

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
