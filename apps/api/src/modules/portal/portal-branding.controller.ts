import { Controller, Get, Req, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import { BrandingService } from "../admin/branding.service";
import type { BrandingSummary } from "../admin/branding.service";

/**
 * Story 82 — Branding — Live Logo/Color Consumption. Read-only:
 * `GET /branding` (Story 62) is agent-only (`RequirePermissions
 * ("branding:read")`) and meaningless for a Contact, which has no role
 * system (`PortalTicketsController`'s own doc comment) — this is the
 * Portal's own, separate read surface. Scope is the caller's own branch,
 * read directly off the JWT's existing `branchId` claim — already the
 * Contact's Customer's branch (stamped at login by
 * `PortalService.issueAccessToken`, Story 52) — mirrors
 * `PortalKnowledgeBaseController`'s own precedent exactly (no
 * `TenantContext`, no extra Contact lookup).
 */
@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal/branding")
export class PortalBrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @PortalRoute()
  @Get()
  getBranding(@Req() request: Request): Promise<BrandingSummary> {
    return this.brandingService.getBrandingForBranch(this.requireBranchId(request));
  }

  /** A portal-issued token always carries `branchId` (the Contact's
   * Customer's branch, stamped at login — Story 52). This only guards
   * the invariant, mirroring `PortalKnowledgeBaseController`'s own
   * identical guard. */
  private requireBranchId(request: Request): string {
    const claims = request.user as JwtAccessTokenClaims;
    if (!claims.branchId) {
      throw new UnauthorizedException("Token has no associated branch");
    }
    return claims.branchId;
  }
}
