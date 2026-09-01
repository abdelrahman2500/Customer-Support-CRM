import { Controller, Get, Patch, Req } from "@nestjs/common";
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
 *
 * Story 92 — `GET /unread-count`/`PATCH /read-state`, `@PortalRoute()`
 * only (no permission — the portal has no permission catalog at all,
 * matching every existing portal notifications route). Both resolve the
 * caller through the same `getAuthenticatedContact(contact.sub)` call as
 * `list()` — `contact.sub` is the `Contact.id`, never a client-supplied
 * id, so one contact can never read or mutate another's read cursor, even
 * another contact under the very same customer.
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

  @PortalRoute()
  @Get("unread-count")
  async getUnreadCount(@Req() request: Request): Promise<{ unreadCount: number }> {
    const contact = request.user as JwtAccessTokenClaims;
    const authenticated = await this.portalService.getAuthenticatedContact(contact.sub);
    return this.notificationsService.getUnreadCountForCustomer(
      authenticated.id,
      authenticated.customerId,
    );
  }

  @PortalRoute()
  @Patch("read-state")
  async markRead(@Req() request: Request): Promise<{ readAt: Date }> {
    const contact = request.user as JwtAccessTokenClaims;
    const authenticated = await this.portalService.getAuthenticatedContact(contact.sub);
    return this.notificationsService.markReadForContact(authenticated.id);
  }
}
