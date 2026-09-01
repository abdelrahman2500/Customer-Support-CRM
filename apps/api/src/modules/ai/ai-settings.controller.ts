import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { UpdateAiSettingsDto } from "./dto/update-ai-settings.dto";
import type { AiSettingsSummary } from "./ai-settings.service";
import { AiSettingsService } from "./ai-settings.service";

/** Story 81 — one AI settings row per caller's branch
 * (`TenantContext.requireBranchScope()`) — like `BrandingController`,
 * routes here take no `:id`: the branch alone identifies at most one
 * row. */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("ai/settings")
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  @Get()
  @RequirePermissions("ai:read")
  getSettings(): Promise<AiSettingsSummary> {
    return this.aiSettingsService.getSettings();
  }

  @Patch()
  @RequirePermissions("ai:update")
  updateSettings(@Body() dto: UpdateAiSettingsDto): Promise<AiSettingsSummary> {
    return this.aiSettingsService.updateSettings(dto);
  }
}
