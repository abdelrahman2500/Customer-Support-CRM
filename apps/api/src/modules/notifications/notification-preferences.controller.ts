import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { UpdateNotificationPreferenceDto } from "./dto/update-notification-preference.dto";
import type { NotificationPreferenceSummary } from "./notification-preferences.service";
import { NotificationPreferencesService } from "./notification-preferences.service";

/**
 * Story 58 — self-scoped by `request.user.sub`, deliberately no
 * `@RequirePermissions` — mirrors `IdentityController.me`'s exact
 * "authenticated, no permission, resolves the caller's own id from the JWT"
 * shape. A preference is the requesting user's own; it is never a
 * branch-admin resource.
 */
@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notification-preferences")
export class NotificationPreferencesController {
  constructor(private readonly notificationPreferencesService: NotificationPreferencesService) {}

  @Get()
  list(@Req() request: Request): Promise<NotificationPreferenceSummary[]> {
    const user = request.user as JwtAccessTokenClaims;
    return this.notificationPreferencesService.listPreferences(user.sub);
  }

  @Patch()
  update(
    @Req() request: Request,
    @Body() dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceSummary> {
    const user = request.user as JwtAccessTokenClaims;
    return this.notificationPreferencesService.setPreference(user.sub, dto);
  }
}
