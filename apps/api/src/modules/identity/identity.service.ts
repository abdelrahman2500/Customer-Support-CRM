import { randomBytes, createHmac } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AuthenticatedUser, AuthTokenPair, JwtAccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../../prisma/prisma.service";
import type { EnvConfig } from "../../common/config/env.validation";

const BCRYPT_ROUNDS = 12;

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
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
        .filter((br) => br.branchId === active?.branchId && br.departmentId === active?.departmentId)
        .map((br) => br.role.name),
    };
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
        .filter((br) => br.branchId === active?.branchId && br.departmentId === active?.departmentId)
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
