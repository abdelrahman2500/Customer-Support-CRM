import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import { UpdatePortalNotificationPreferenceDto } from "../notifications/dto/update-portal-notification-preference.dto";
import type { PortalNotificationPreferenceSummary } from "../notifications/portal-notification-preferences.service";
import { PortalNotificationPreferencesService } from "../notifications/portal-notification-preferences.service";
import { PortalService } from "./portal.service";

/**
 * Story 90 — Customer Portal: Notification Preferences. `@PortalRoute()`
 * (rejects an `agent`-audience token with 401, exactly like every other
 * portal controller). Mirrors `PortalNotificationsController`'s own "no
 * intermediate service, resolve the caller through `PortalService.
 * getAuthenticatedContact` first, then inject the already-exported
 * service directly" shape — `getAuthenticatedContact` also confirms portal
 * access hasn't been revoked since the token was issued, not merely that
 * the JWT parses.
 */
@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal/notification-preferences")
export class PortalNotificationPreferencesController {
  constructor(
    private readonly portalService: PortalService,
    private readonly portalNotificationPreferencesService: PortalNotificationPreferencesService,
  ) {}

  @PortalRoute()
  @Get()
  async list(@Req() request: Request): Promise<PortalNotificationPreferenceSummary[]> {
    const contact = request.user as JwtAccessTokenClaims;
    const authenticated = await this.portalService.getAuthenticatedContact(contact.sub);
    return this.portalNotificationPreferencesService.listPreferences(authenticated.id);
  }

  @PortalRoute()
  @Patch()
  async update(
    @Req() request: Request,
    @Body() dto: UpdatePortalNotificationPreferenceDto,
  ): Promise<PortalNotificationPreferenceSummary> {
    const contact = request.user as JwtAccessTokenClaims;
    const authenticated = await this.portalService.getAuthenticatedContact(contact.sub);
    return this.portalNotificationPreferencesService.setPreference(authenticated.id, dto);
  }
}
