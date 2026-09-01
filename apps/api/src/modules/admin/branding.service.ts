import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { UpdateBrandingDto } from "./dto/update-branding.dto";

export interface BrandingSummary {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

const DEFAULT_BRANDING: BrandingSummary = {
  logoUrl: null,
  primaryColor: null,
  secondaryColor: null,
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
        logoUrl: dto.logoUrl ?? null,
        primaryColor: dto.primaryColor ?? null,
        secondaryColor: dto.secondaryColor ?? null,
      },
      update: {
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
        ...(dto.secondaryColor !== undefined ? { secondaryColor: dto.secondaryColor } : {}),
      },
    });
    return toSummary(config);
  }
}

function toSummary(config: {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}): BrandingSummary {
  return {
    logoUrl: config.logoUrl,
    primaryColor: config.primaryColor,
    secondaryColor: config.secondaryColor,
  };
}
