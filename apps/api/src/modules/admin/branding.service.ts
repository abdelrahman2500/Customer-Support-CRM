import { Injectable } from "@nestjs/common";
import type { NavigationLayout } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { UpdateBrandingDto } from "./dto/update-branding.dto";

export interface BrandingSummary {
  appName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  navigationLayout: NavigationLayout | null;
}

const DEFAULT_BRANDING: BrandingSummary = {
  appName: null,
  logoUrl: null,
  primaryColor: null,
  secondaryColor: null,
  navigationLayout: null,
};

/**
 * Story 62 — grows `AdminModule` the same way `AuditLogsService` already
 * did. `GET` never 404s — an unconfigured branch has no `BrandingConfig`
 * row at all, and this returns `DEFAULT_BRANDING` (all nulls) rather than
 * an error, mirroring `NotificationPreferencesService`'s own "absence
 * means default" convention (Story 58) rather than `BusinessHoursCalendarsService`'s
 * stricter create/update-with-404 split — branding has no nested
 * sub-resources needing careful first-touch initialization. `PATCH` is
 * upsert for the same reason.
 *
 * Story 82 — `getBrandingForBranch` factored out so
 * `PortalBrandingController` can read a branch's branding directly by
 * id: a Contact has no `TenantContext` (portal requests derive scope
 * from their own JWT's `branchId` claim instead — see
 * `PortalKnowledgeBaseController`'s own precedent), so `getBranding()`'s
 * `TenantContext.requireBranchScope()` call is agent-only and stays
 * that way.
 *
 * Story 129 — `appName` and `navigationLayout` join the summary. Both are
 * `null` when unconfigured and stay `null` all the way to the frontend,
 * exactly like the other three fields: there is deliberately no
 * fallback-to-`NAVBAR` here, because the single place that resolves
 * "unconfigured" to a rendered presentation is the frontend's own
 * `resolveNavigationLayout` (`apps/web/src/components/workspace/nav-items.tsx`).
 * Two resolution points would be two chances to disagree.
 */
@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getBranding(): Promise<BrandingSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    return this.getBrandingForBranch(branchId);
  }

  async getBrandingForBranch(branchId: string): Promise<BrandingSummary> {
    const config = await this.prisma.brandingConfig.findUnique({ where: { branchId } });
    return config ? toSummary(config) : DEFAULT_BRANDING;
  }

  async updateBranding(dto: UpdateBrandingDto): Promise<BrandingSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const config = await this.prisma.brandingConfig.upsert({
      where: { branchId },
      create: {
        branchId,
        appName: dto.appName ?? null,
        logoUrl: dto.logoUrl ?? null,
        primaryColor: dto.primaryColor ?? null,
        secondaryColor: dto.secondaryColor ?? null,
        navigationLayout: dto.navigationLayout ?? null,
      },
      update: {
        ...(dto.appName !== undefined ? { appName: dto.appName } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
        ...(dto.secondaryColor !== undefined ? { secondaryColor: dto.secondaryColor } : {}),
        ...(dto.navigationLayout !== undefined ? { navigationLayout: dto.navigationLayout } : {}),
      },
    });
    return toSummary(config);
  }
}

function toSummary(config: {
  appName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  navigationLayout: NavigationLayout | null;
}): BrandingSummary {
  return {
    appName: config.appName,
    logoUrl: config.logoUrl,
    primaryColor: config.primaryColor,
    secondaryColor: config.secondaryColor,
    navigationLayout: config.navigationLayout,
  };
}
