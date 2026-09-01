import { Controller, Get, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import type { NotificationSummary } from "../notifications/notifications.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PortalService } from "./portal.service";

/**
 * Story 88 — Customer Portal: Notification History. `@PortalRoute()`
 * (rejects an `agent`-audience token with 401, exactly like every other
 * portal controller). No intermediate `PortalNotificationsService` — the
 * only composition needed is one `getAuthenticatedContact` call, mirroring
 * `PortalKnowledgeBaseController`/`PortalChatController`'s own
 * "inject the already-exported service directly" precedent.
 */
@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal/notifications")
export class PortalNotificationsController {
  constructor(
    private readonly portalService: PortalService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @PortalRoute()
  @Get()
  async list(@Req() request: Request): Promise<NotificationSummary[]> {
    const contact = request.user as JwtAccessTokenClaims;
    const { customerId } = await this.portalService.getAuthenticatedContact(contact.sub);
    return this.notificationsService.listNotificationsForCustomer(customerId);
  }
}
