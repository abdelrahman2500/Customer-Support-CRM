import { randomBytes, createHmac } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { TicketVisibilityScope } from "@prisma/client";
import type { AuthenticatedUser, AuthTokenPair, JwtAccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { EnvConfig } from "../../common/config/env.validation";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { UpdateBranchDto } from "./dto/update-branch.dto";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { CreateDepartmentDto } from "./dto/create-department.dto";
import type { UpdateDepartmentDto } from "./dto/update-department.dto";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";
import type { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";
import type { UpdateUserAssignmentDto } from "./dto/update-user-assignment.dto";
import type { GrantBranchAssignmentDto } from "./dto/grant-branch-assignment.dto";

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
  roleId: string;
  departmentId: string | null;
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

/** Story 118 — one row per `UserBranchRole` the caller holds, returned by
 * `GET auth/me/branches`. `isActive` matches the *current request's own*
 * JWT claims, not necessarily `branchRoles[0]` — a caller who has
 * switched sees the switched-to membership flagged, not their original
 * one. */
export interface BranchMembershipSummary {
  branchId: string;
  branchName: string;
  departmentId: string | null;
  departmentName: string | null;
  roleId: string;
  roleName: string;
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
  ticketVisibilityScope: TicketVisibilityScope;
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
  private readonly logger = new Logger(IdentityService.name);

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
   *
   * Story 84 — explicitly records `auth.login_failed`/`auth.login`: the
   * global `AuditInterceptor` can never do this itself, since `/auth/
   * login` is `@Public()` (`request.user` is never populated) and its
   * `tap()` only fires on the success path anyway. `entityId` carries
   * whatever identifies the attempt (the real user id once one is
   * found, the raw attempted email otherwise) — never exposed via the
   * HTTP response, only through the already `audit:read`-gated
   * `GET /audit-logs`.
   */
  async login(
    email: string,
    password: string,
    ipAddress: string | null = null,
  ): Promise<AuthTokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { branchRoles: { include: { role: true }, orderBy: { createdAt: "asc" } } },
    });

    if (!user || !user.isActive) {
      await this.recordAuditLog({
        actorId: null,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user?.id ?? email,
        ipAddress,
      });
      throw new UnauthorizedException("Invalid email or password");
    }
    // const passworde = await hashPassword("password");
    // console.log(passworde);

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordAuditLog({
        actorId: null,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.id,
        ipAddress,
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    const accessToken = await this.issueAccessToken(user.id, user.branchRoles, {
      branchId: user.activeBranchId,
      departmentId: user.activeDepartmentId,
    });
    const { raw: refreshToken } = await this.createRefreshTokenRecord(user.id);
    await this.recordAuditLog({
      actorId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      branchId: user.branchRoles[0]?.branchId ?? null,
      ipAddress,
    });
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
    const { record, user } = await this.validateAndLoadRefreshSubject(presentedToken);

    const { raw: newRawToken, id: newTokenId } = await this.createRefreshTokenRecord(user.id);
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedBy: newTokenId },
    });

    // Story 118 — passes the user's own last explicit switch
    // (`activeBranchId`/`activeDepartmentId`, `null` for every user who
    // has never switched) rather than nothing, so a switched branch
    // survives this silent refresh (Story 41) instead of reverting to
    // `branchRoles[0]` on the very next one.
    const accessToken = await this.issueAccessToken(user.id, user.branchRoles, {
      branchId: user.activeBranchId,
      departmentId: user.activeDepartmentId,
    });
    return { accessToken, refreshToken: newRawToken };
  }

  /**
   * Story 118 — switches the caller's active branch/department to one of
   * their OTHER existing `UserBranchRole` memberships (granted via
   * `grantBranchAssignment`, below). Authenticates identically to
   * `refresh()` — the presented refresh token alone, no Bearer access
   * token required — and performs the exact same validate-then-rotate
   * flow, since this endpoint sits behind the same `/api/v1/auth`
   * -scoped refresh-token cookie (`IdentityController.setRefreshCookie`).
   * Persists the switch (`activeBranchId`/`activeDepartmentId` on
   * `User`) so it survives every subsequent silent refresh too, not just
   * this immediate access token — see `refresh()`'s own updated comment.
   */
  async switchActiveBranch(
    presentedToken: string,
    branchId: string,
    departmentId: string | null,
  ): Promise<AuthTokenPair> {
    const { record, user } = await this.validateAndLoadRefreshSubject(presentedToken);

    const membership = user.branchRoles.find(
      (branchRole) => branchRole.branchId === branchId && branchRole.departmentId === departmentId,
    );
    if (!membership) {
      throw new NotFoundException("You do not have a role in that branch/department");
    }

    const before = { branchId: user.activeBranchId, departmentId: user.activeDepartmentId };
    await this.prisma.user.update({
      where: { id: user.id },
      data: { activeBranchId: branchId, activeDepartmentId: departmentId },
    });

    const { raw: newRawToken, id: newTokenId } = await this.createRefreshTokenRecord(user.id);
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedBy: newTokenId },
    });

    const accessToken = await this.issueAccessToken(user.id, user.branchRoles, {
      branchId,
      departmentId,
    });

    // Story 84 — mirrors `auth.login`/`auth.logout`'s own explicit-audit
    // convention (a session-lifecycle action `AuditInterceptor` cannot
    // capture route-generically).
    await this.recordAuditLog({
      actorId: user.id,
      action: "auth.branch_switched",
      entityType: "user",
      entityId: user.id,
      branchId,
      diff: { before, after: { branchId, departmentId } },
    });

    return { accessToken, refreshToken: newRawToken };
  }

  /** Shared by `refresh()`/`switchActiveBranch()`: validates the presented
   * refresh token (unknown/expired/revoked all fail identically) and
   * loads its owning, still-active user with every branch membership. */
  private async validateAndLoadRefreshSubject(presentedToken: string): Promise<{
    record: { id: string; userId: string };
    user: {
      id: string;
      isActive: boolean;
      activeBranchId: string | null;
      activeDepartmentId: string | null;
      branchRoles: Array<{ branchId: string; departmentId: string | null; role: { name: string } }>;
    };
  }> {
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

    return { record, user };
  }

  /**
   * Revokes a refresh token (logout). Silently no-ops if it's already
   * gone — Story 84's `auth.logout` audit entry is written only when a
   * still-active token was actually revoked, mirroring that same
   * no-op-means-no-op convention (a repeated/replayed logout call is
   * not itself an event worth auditing).
   */
  async revoke(presentedToken: string, ipAddress: string | null = null): Promise<void> {
    const tokenHash = this.hashRefreshToken(presentedToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (record && !record.revokedAt) {
      await this.recordAuditLog({
        actorId: record.userId,
        action: "auth.logout",
        entityType: "user",
        entityId: record.userId,
        ipAddress,
      });
    }
  }

  /**
   * Story 48 — revokes every currently-unrevoked refresh token for a user,
   * used by `resetPassword` (unlike `revoke` above, which only ever revokes
   * the single token being logged out with). Simply matches zero rows,
   * with no error, for a user with no currently-active refresh tokens.
   */
  private async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
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

    // Story 118 — resolved the same way `issueAccessToken` resolves its
    // own token claims (`user.activeBranchId`/`activeDepartmentId`,
    // falling back to `branchRoles[0]`) — without this, `GET auth/me`
    // would keep reporting a switched-away-from branch as "active" even
    // though the caller's actual JWT claims (and every subsequent
    // request) already reflect the switch.
    const active = this.resolveActiveMembership(user.branchRoles, {
      branchId: user.activeBranchId,
      departmentId: user.activeDepartmentId,
    });
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
      preferredLocale: user.preferredLocale,
    };
  }

  /**
   * Story 119 — `PATCH auth/locale`. A plain preference update, not the
   * same trust tier as `user.reassigned`/`auth.branch_switched` — no
   * audit-log entry, mirroring `NotificationPreference`'s own toggle
   * (a personal presentation setting, not an access-affecting change).
   * No token reissue: locale is not a `JwtAccessTokenClaims` field.
   */
  async updatePreferredLocale(userId: string, locale: string): Promise<{ id: string }> {
    await this.prisma.user.update({ where: { id: userId }, data: { preferredLocale: locale } });
    return { id: userId };
  }

  /**
   * Story 118 — every `UserBranchRole` the caller
   * (`TenantContext.userId`) holds, with branch/department/role names
   * resolved, flagging which one is the currently-active membership
   * (matching `TenantContext.branchId`/`.departmentId` — the current
   * request's own JWT claims, already resolved at token-issuance time).
   * No extra permission gate: this is the caller's own data, mirroring
   * `getAuthenticatedUser`/`GET auth/me`'s identical precedent.
   */
  async listMyBranchMemberships(): Promise<BranchMembershipSummary[]> {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new UnauthorizedException("No authenticated user on this request");
    }

    const memberships = await this.prisma.userBranchRole.findMany({
      where: { userId },
      include: { branch: true, department: true, role: true },
      orderBy: { createdAt: "asc" },
    });

    const activeBranchId = this.tenantContext.branchId;
    const activeDepartmentId = this.tenantContext.departmentId;
    return memberships.map((membership) => ({
      branchId: membership.branchId,
      branchName: membership.branch.name,
      departmentId: membership.departmentId,
      departmentName: membership.department?.name ?? null,
      roleId: membership.roleId,
      roleName: membership.role.name,
      isActive:
        membership.branchId === activeBranchId && membership.departmentId === activeDepartmentId,
    }));
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
   * Story 118 — grants an EXISTING user an additional
   * branch/department/role membership (a second, third, ... row) in a
   * DIFFERENT branch — the one write path `createUser`'s single-initial
   * -membership and `updateUserAssignment`'s same-branch-only edit
   * deliberately never provide. Gated by its own `user:branch-assign`
   * permission (SuperAdmin-only, mirrors `branch:create`'s exact "new
   * key, not added to Agent's grant list" precedent) — cross-branch
   * access must stay "an explicit, audited permission, never a default"
   * (docs/architecture/04-data-and-multitenancy.md).
   *
   * `dto.branchId` is validated against the *granting admin's own
   * organization* — mirrors `createBranch`'s exact organization-scoping
   * pattern — never trusted as a bare client-supplied id. This
   * codebase has exactly one real `Organization` row today, but the
   * check is still the correct trust boundary for when that changes.
   */
  async grantBranchAssignment(
    userId: string,
    dto: GrantBranchAssignmentDto,
  ): Promise<{ id: string }> {
    const { branchId: callerBranchId } = this.tenantContext.requireBranchScope();
    const callerBranch = await this.prisma.branch.findFirst({
      where: { id: callerBranchId },
      select: { organizationId: true },
    });
    if (!callerBranch) {
      throw new NotFoundException("Branch not found");
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

    const targetBranch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId: callerBranch.organizationId },
    });
    if (!targetBranch) {
      throw new NotFoundException("Branch not found");
    }

    if (dto.departmentId !== undefined) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, branchId: dto.branchId },
      });
      if (!department) {
        throw new NotFoundException("Department not found");
      }
      if (!department.isActive) {
        throw new BadRequestException("Cannot assign an inactive department");
      }
    }

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new NotFoundException("Role not found");
    }
    if (!role.isActive) {
      throw new BadRequestException("Cannot assign an inactive role");
    }

    // Explicit pre-check, not just the `@@unique` constraint's own P2002
    // below: Postgres unique constraints treat every NULL as distinct
    // from every other NULL, so `@@unique([userId, branchId,
    // departmentId, roleId])` alone does NOT reject a second row with an
    // identical `(userId, branchId, roleId)` when `departmentId` is
    // `null` (the common case here — most cross-branch grants are
    // branch-wide, no department) — confirmed while first authoring
    // this method's own e2e coverage. Mirrors `createUser`'s own
    // "pre-check via a real query, P2002 catch as race-window
    // defense-in-depth" precedent (its duplicate-email check).
    const existingMembership = await this.prisma.userBranchRole.findFirst({
      where: {
        userId,
        branchId: dto.branchId,
        departmentId: dto.departmentId ?? null,
        roleId: dto.roleId,
      },
    });
    if (existingMembership) {
      throw new ConflictException("This user already has this exact assignment");
    }

    try {
      const membership = await this.prisma.userBranchRole.create({
        data: {
          userId,
          branchId: dto.branchId,
          departmentId: dto.departmentId ?? null,
          roleId: dto.roleId,
        },
      });
      // `branchId` here is the ADMIN's OWN acting branch, not the
      // (cross-branch) target — `AuditLogsService.listAuditLogs` scopes
      // by the caller's own active branch (`OR: [{branchId}, {branchId:
      // null}]`), so tagging this with the target branch would make the
      // granting admin's own action invisible to their own audit trail.
      // The target branch/department/role are still fully captured in
      // `diff`.
      await this.recordAuditLog({
        actorId: this.tenantContext.userId,
        action: "user.branch_assignment_granted",
        entityType: "user",
        entityId: userId,
        branchId: callerBranchId,
        diff: { branchId: dto.branchId, departmentId: dto.departmentId ?? null, roleId: dto.roleId },
      });
      return { id: membership.id };
    } catch (error) {
      throw translateDuplicateUserAssignment(error);
    }
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
      include: {
        branchRoles: {
          where: { branchId },
          include: { role: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Story 47 — `roleId`/`departmentId` are derived from `branchRoles[0]`,
    // the same "first/oldest membership wins" rule `login`/`refresh`/
    // `getAuthenticatedUser` already use to pick a user's active context.
    // The `where` clause above guarantees every returned user has at least
    // one `branchRoles` row in this branch, so `active` is never actually
    // undefined here — the `flatMap`/guard is defensive only, matching this
    // file's `noUncheckedIndexedAccess`-safe style elsewhere.
    return users.flatMap((user) => {
      const active = user.branchRoles[0];
      if (!active) {
        return [];
      }
      return [
        {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
          roles: [...new Set(user.branchRoles.map((br) => br.role.name))],
          roleId: active.roleId,
          departmentId: active.departmentId,
        },
      ];
    });
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<{ id: string }> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    try {
      await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
        },
      });
    } catch (error) {
      throw translateDuplicateEmail(error);
    }

    return { id };
  }

  /**
   * Story 48 — sets a new password for an existing user directly (no
   * "forgot password" email flow). Because `refresh()` never reads
   * `passwordHash` and no field links a `RefreshToken` to a password
   * version, a stolen-but-still-valid refresh token would otherwise survive
   * a password reset undetected — so every currently-unrevoked refresh
   * token for this user is revoked as part of the reset (see
   * `revokeAllRefreshTokens` below). An already-issued access token (JWT)
   * cannot be revoked before its own natural expiry — a pre-existing,
   * disclosed limitation, not addressed here.
   */
  async resetPassword(id: string, dto: ResetPasswordDto): Promise<{ id: string }> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.revokeAllRefreshTokens(id);
    await this.recordAuditLog({
      actorId: this.tenantContext.userId,
      action: "user.password_reset",
      entityType: "user",
      entityId: id,
    });

    return { id };
  }

  /**
   * Story 47 — reassigns an existing user's Role and/or Department, both
   * scoped to the caller's own branch. `user:update` (above) stays
   * profile-only (`fullName`/`isActive`); this is a deliberately separate,
   * more privilege-affecting permission (`user:reassign`) — see Story 46's
   * `role:assign-permissions` vs. `role:update` split for the precedent.
   *
   * Edits the target user's existing first/active `UserBranchRole` row
   * in place (`branchRoles[0]`, the same "first/oldest membership wins"
   * row `login`/`refresh`/`getAuthenticatedUser` already treat as active) —
   * never adds a second row, never deletes-then-recreates. No `branchId`
   * is accepted anywhere in this method: reassigning a user to a different
   * branch is explicitly out of scope (see Story 47 plan, Design item 2).
   */
  async updateUserAssignment(id: string, dto: UpdateUserAssignmentDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const membership = await this.prisma.userBranchRole.findFirst({
      where: { userId: id, branchId },
      include: { role: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      throw new NotFoundException("User not found in this branch");
    }

    if (dto.roleId !== undefined) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) {
        throw new NotFoundException("Role not found");
      }
      if (!role.isActive) {
        throw new BadRequestException("Cannot assign an inactive role");
      }
    }

    if (dto.departmentId !== undefined && dto.departmentId !== null) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, branchId },
      });
      if (!department) {
        throw new NotFoundException("Department not found");
      }
      if (!department.isActive) {
        throw new BadRequestException("Cannot assign an inactive department");
      }
    }

    // Last-SuperAdmin lockout guard — only relevant when the membership's
    // *current* role is SuperAdmin and this call would actually move it to
    // a different role. Mirrors Story 46's "protect against unrecoverable
    // lockout" philosophy, applied here to the last living holder of the
    // role rather than the role record itself.
    if (
      dto.roleId !== undefined &&
      membership.role.name === "SuperAdmin" &&
      dto.roleId !== membership.roleId
    ) {
      const superAdminRole = await this.prisma.role.findUnique({
        where: { name: "SuperAdmin" },
      });
      const otherSuperAdmins = await this.prisma.userBranchRole.count({
        where: {
          roleId: superAdminRole?.id,
          userId: { not: id },
          user: { isActive: true },
        },
      });
      if (otherSuperAdmins === 0) {
        throw new BadRequestException("Cannot reassign the last SuperAdmin user");
      }
    }

    const before = { roleId: membership.roleId, departmentId: membership.departmentId };

    try {
      await this.prisma.userBranchRole.update({
        where: { id: membership.id },
        data: {
          ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
          ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        },
      });
      // Story 84 — a real before/after diff; `AuditInterceptor`'s own
      // coarse route-level log cannot express one.
      await this.recordAuditLog({
        actorId: this.tenantContext.userId,
        action: "user.reassigned",
        entityType: "user",
        entityId: id,
        branchId,
        diff: {
          before,
          after: {
            roleId: dto.roleId ?? before.roleId,
            departmentId: dto.departmentId !== undefined ? dto.departmentId : before.departmentId,
          },
        },
      });
      return { id };
    } catch (error) {
      throw translateDuplicateUserAssignment(error);
    }
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
   * Renames/(de)activates the caller's own branch — never another branch
   * (see `createBranch`, below, for creating a new one). The scope check is
   * a plain identity comparison against `TenantContext`, not a DB lookup:
   * the caller's own branch id is already known and trusted.
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
   * Story 107 — creates a new `Branch`. `organizationId` is resolved from
   * the *caller's own* branch record, never accepted from the client —
   * the same trust boundary `createDepartment`/`createUser` already apply
   * to `branchId`. This codebase has exactly one real `Organization` row
   * by design (see docs/architecture/04-data-and-multitenancy.md), so this
   * always attaches the new branch to that same organization; it also
   * means `createBranch` doesn't itself require the caller's active branch
   * to be the *target* — `requireBranchScope()` here is only how the
   * organization is looked up, not a same-branch check like `updateBranch`'s.
   * Gated by its own `branch:create` permission (SuperAdmin-only — see
   * `prisma/seed.ts`), unlike `branch:read`/`branch:update` which Agent's
   * default grant already includes.
   */
  async createBranch(dto: CreateBranchDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const callerBranch = await this.prisma.branch.findFirst({
      where: { id: branchId },
      select: { organizationId: true },
    });
    if (!callerBranch) {
      throw new NotFoundException("Branch not found");
    }

    try {
      const branch = await this.prisma.branch.create({
        data: {
          organizationId: callerBranch.organizationId,
          name: dto.name,
          timezone: dto.timezone,
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      return { id: branch.id };
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
      ticketVisibilityScope: role.ticketVisibilityScope,
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
      const role = await this.prisma.role.create({
        data: {
          name: dto.name,
          // Story 68 — omitted defaults to the Prisma column's own default
          // (`BRANCH`), reproducing every pre-Story-68 caller's behavior.
          ...(dto.ticketVisibilityScope !== undefined
            ? { ticketVisibilityScope: dto.ticketVisibilityScope }
            : {}),
        },
      });
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

    const before = {
      name: role.name,
      isActive: role.isActive,
      ticketVisibilityScope: role.ticketVisibilityScope,
    };

    try {
      await this.prisma.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          // Story 68 — deliberately allowed on every role including the two
          // protected ones (mirrors `setRolePermissions`'s own precedent):
          // opting an existing role like `Agent` into department-scoped
          // visibility is the entire point of this Story.
          ...(dto.ticketVisibilityScope !== undefined
            ? { ticketVisibilityScope: dto.ticketVisibilityScope }
            : {}),
        },
      });
      // Story 84 — a real before/after diff.
      await this.recordAuditLog({
        actorId: this.tenantContext.userId,
        action: "role.updated",
        entityType: "role",
        entityId: id,
        diff: {
          before,
          after: {
            name: dto.name ?? before.name,
            isActive: dto.isActive ?? before.isActive,
            ticketVisibilityScope: dto.ticketVisibilityScope ?? before.ticketVisibilityScope,
          },
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

    // Story 84 — read before the reconciliation so the audit entry below
    // can carry a real before/after diff.
    const existingPermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: id },
      include: { permission: true },
    });
    const beforeKeys = existingPermissions.map((rp) => rp.permission.key).sort();

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

    await this.recordAuditLog({
      actorId: this.tenantContext.userId,
      action: "role.permissions_updated",
      entityType: "role",
      entityId: id,
      diff: { before: beforeKeys, after: [...uniqueKeys].sort() },
    });

    return { id };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  /**
   * Story 84 — the explicit-write half of
   * docs/architecture/05-auth-and-security.md's "services explicitly
   * record permission changes, exports, bulk operations, login/logout,
   * and failed authentication", mirroring `AuditInterceptor`'s own
   * doc comment (which names exactly this pattern) and its
   * catch-and-log-never-throw convention: an audit-log write failure
   * must never break the request it's observing.
   */
  private async recordAuditLog(entry: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    branchId?: string | null;
    diff?: Prisma.InputJsonValue;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          branchId: entry.branchId ?? null,
          ...(entry.diff !== undefined ? { diff: entry.diff } : {}),
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (error) {
      this.logger.error("Failed to write explicit audit log", error as Error);
    }
  }

  private async requireDepartmentInScope(id: string): Promise<void> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const department = await this.prisma.department.findFirst({ where: { id, branchId } });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
  }

  /**
   * Story 118 — shared by `issueAccessToken`/`getAuthenticatedUser`, so
   * a token's claims and `GET auth/me`'s own read of "the active
   * membership" can never disagree. `active.branchId === null` (never
   * switched) or no matching `branchRoles` entry (self-healing — the
   * previously-active membership was since removed) both fall back to
   * the first assignment by creation order, exactly this codebase's
   * pre-Story-118 behavior.
   */
  private resolveActiveMembership<
    T extends { branchId: string; departmentId: string | null },
  >(branchRoles: T[], active: { branchId: string | null; departmentId: string | null }): T | undefined {
    return (
      (active.branchId !== null
        ? branchRoles.find(
            (br) => br.branchId === active.branchId && br.departmentId === active.departmentId,
          )
        : undefined) ?? branchRoles[0]
    );
  }

  /**
   * Story 118 — `active` names the caller's explicit last switch
   * (`User.activeBranchId`/`activeDepartmentId`, or the just-validated
   * target of `switchActiveBranch` itself); its default,
   * `{ branchId: null, departmentId: null }`, reproduces this method's
   * exact pre-Story-118 behavior — resolution itself is
   * `resolveActiveMembership`, above.
   */
  private async issueAccessToken(
    userId: string,
    branchRoles: Array<{ branchId: string; departmentId: string | null; role: { name: string } }>,
    active: { branchId: string | null; departmentId: string | null } = {
      branchId: null,
      departmentId: null,
    },
  ): Promise<string> {
    const resolvedActive = this.resolveActiveMembership(branchRoles, active);
    const claims: JwtAccessTokenClaims = {
      sub: userId,
      audience: "agent",
      branchId: resolvedActive?.branchId ?? null,
      departmentId: resolvedActive?.departmentId ?? null,
      roles: branchRoles
        .filter(
          (br) =>
            br.branchId === resolvedActive?.branchId &&
            br.departmentId === resolvedActive?.departmentId,
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

/**
 * A duplicate email on a user **update** (as opposed to `createUser`'s
 * pre-check, the sole exception to this file's P2002-catch convention) is
 * caught here by Prisma's `P2002` unique-constraint-violation code
 * (backstopping `User.email`'s pre-existing `@unique` constraint) and
 * turned into a `ConflictException` — never a raw 500. Race-free: no
 * separate check-then-write gap.
 */
function translateDuplicateEmail(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return new ConflictException("A user with this email already exists");
  }
  return error as Error;
}

/**
 * A genuine duplicate exact assignment is caught here by Prisma's `P2002`
 * unique-constraint-violation code (backstopping `UserBranchRole`'s
 * `@@unique([userId, branchId, departmentId, roleId])` constraint) and
 * turned into a `ConflictException` — never a raw 500. Unlikely in
 * practice since `updateUserAssignment` only ever edits a user's single
 * existing row in place; kept defensively.
 */
function translateDuplicateUserAssignment(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return new ConflictException("This user already has this exact assignment");
  }
  return error as Error;
}
