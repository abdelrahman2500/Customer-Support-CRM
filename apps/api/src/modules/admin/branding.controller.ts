import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { UpdateBrandingDto } from "./dto/update-branding.dto";
import type { BrandingSummary } from "./branding.service";
import { BrandingService } from "./branding.service";

/** Story 62 — one branding config per caller's branch
 * (`TenantContext.requireBranchScope()`) — like `BusinessHoursCalendarsController`,
 * routes here take no `:id`: the branch alone identifies at most one row. */
@ApiTags("admin")
@ApiBearerAuth()
@Controller("branding")
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  @RequirePermissions("branding:read")
  getBranding(): Promise<BrandingSummary> {
    return this.brandingService.getBranding();
  }

  @Patch()
  @RequirePermissions("branding:update")
  updateBranding(@Body() dto: UpdateBrandingDto): Promise<BrandingSummary> {
    return this.brandingService.updateBranding(dto);
  }
}
