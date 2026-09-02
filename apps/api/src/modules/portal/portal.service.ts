import { randomBytes, createHmac } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AuthenticatedContact, AuthTokenPair, JwtAccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../../prisma/prisma.service";
import type { EnvConfig } from "../../common/config/env.validation";

/**
 * Story 52 — owns the Customer Portal's authentication surface. Mirrors
 * `IdentityService`'s `login`/`refresh`/`revoke`/`getAuthenticatedUser`
 * field-for-field, against `prisma.contact`/`prisma.contactRefreshToken`
 * instead of `prisma.user`/`prisma.refreshToken` — a `Contact` has no
 * role/branch-role concept, so the issued token's `roles` is always `[]`
 * and `departmentId` is always `null`; `branchId` is the Contact's owning
 * Customer's branch (for consistency with `JwtAccessTokenClaims`'s shape,
 * unused by any portal-specific authorization decision in this story).
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  /**
   * Verifies credentials and issues a fresh access/refresh pair. Throws
   * `UnauthorizedException` on any failure — unknown email, no portal
   * password set yet, or a wrong password — deliberately without
   * distinguishing which, to avoid leaking which emails have portal access.
   *
   * `Contact.email` is unique only per-Customer (see that model's own doc
   * comment), but the `passwordHash: { not: null }` filter is safe here
   * because `CustomersService.setContactPortalPassword` enforces, at
   * write time, that at most one portal-enabled contact ever shares a given
   * email (plan Design item 2) — this query never has more than one match
   * to choose between.
   *
   * Story 100 — also rejects a contact whose owning `Customer` has been
   * deactivated (`isActive: false`), mirroring `IdentityService.login`'s
   * exact `!user.isActive` precedent: same rejection point (credential
   * verification), same generic message — a specific "your organization's
   * account is deactivated" message would leak that the email is otherwise
   * valid, exactly what this method's shared error message already avoids
   * for an unknown email or a wrong password.
   */
  async login(email: string, password: string): Promise<AuthTokenPair> {
    const contact = await this.prisma.contact.findFirst({
      where: { email, passwordHash: { not: null } },
      include: { customer: true },
    });

    if (!contact || !contact.passwordHash || !contact.customer.isActive) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, contact.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const accessToken = await this.issueAccessToken(contact.id, contact.customer.branchId);
    const { raw: refreshToken } = await this.createRefreshTokenRecord(contact.id);
    return { accessToken, refreshToken };
  }

  /**
   * Rotates a refresh token — mirrors `IdentityService.refresh` exactly,
   * against `ContactRefreshToken`.
   *
   * Story 100 — also rejects when `contact.customer.isActive` is false,
   * mirroring `IdentityService.refresh`'s exact `!user.isActive` re-check
   * on every rotation: a customer deactivated mid-session must not be able
   * to keep refreshing indefinitely on a token issued before deactivation.
   */
  async refresh(presentedToken: string): Promise<AuthTokenPair> {
    const tokenHash = this.hashRefreshToken(presentedToken);
    const record = await this.prisma.contactRefreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const contact = await this.prisma.contact.findUnique({
      where: { id: record.contactId },
      include: { customer: true },
    });
    if (!contact || !contact.passwordHash || !contact.customer.isActive) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const { raw: newRawToken, id: newTokenId } = await this.createRefreshTokenRecord(contact.id);
    await this.prisma.contactRefreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedBy: newTokenId },
    });

    const accessToken = await this.issueAccessToken(contact.id, contact.customer.branchId);
    return { accessToken, refreshToken: newRawToken };
  }

  /** Revokes a refresh token (logout). Silently no-ops if it's already gone. */
  async revoke(presentedToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(presentedToken);
    await this.prisma.contactRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getAuthenticatedContact(contactId: string): Promise<AuthenticatedContact> {
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || !contact.passwordHash) {
      throw new UnauthorizedException("Contact no longer has portal access");
    }
    return {
      id: contact.id,
      email: contact.email ?? "",
      fullName: contact.fullName,
      customerId: contact.customerId,
      preferredLocale: contact.preferredLocale,
    };
  }

  /** Story 119 — mirrors `IdentityService.updatePreferredLocale`
   * field-for-field; see that method's own doc comment. */
  async updatePreferredLocale(contactId: string, locale: string): Promise<{ id: string }> {
    await this.prisma.contact.update({
      where: { id: contactId },
      data: { preferredLocale: locale },
    });
    return { id: contactId };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async issueAccessToken(contactId: string, branchId: string): Promise<string> {
    const claims: JwtAccessTokenClaims = {
      sub: contactId,
      audience: "customer",
      branchId,
      departmentId: null,
      roles: [],
    };
    return this.jwtService.signAsync(claims);
  }

  private async createRefreshTokenRecord(contactId: string): Promise<{ raw: string; id: string }> {
    const raw = randomBytes(48).toString("base64url");
    const tokenHash = this.hashRefreshToken(raw);
    const ttlDays = this.configService.get("JWT_REFRESH_TTL_DAYS", { infer: true });
    const record = await this.prisma.contactRefreshToken.create({
      data: {
        contactId,
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
