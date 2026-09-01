import { Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type { NotificationSummary } from "./notifications.service";
import { NotificationsService } from "./notifications.service";

/**
 * Story 36 — read-only. No pagination/filtering: mirrors every other list
 * endpoint in this codebase (`GET /tickets`'s equality filters aside,
 * `GET /sla-policies`/`GET /identity/users`/etc. all take zero query
 * parameters), and this module's own `NotificationLog` volume is bounded by
 * real SLA/escalation activity, not user input.
 *
 * Story 92 — `GET /unread-count`/`PATCH /read-state` reuse this
 * controller's existing `notification:read` permission rather than a new,
 * functionally-redundant one: an unread count is a sub-capability of the
 * exact resource that permission already gates, and a caller who cannot
 * list notifications must not be able to observe or affect their count
 * either. Both resolve the caller's identity through `TenantContext`
 * inside `NotificationsService` — never from a request body/param.
 */
@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions("notification:read")
  list(): Promise<NotificationSummary[]> {
    return this.notificationsService.listNotifications();
  }

  @Get("unread-count")
  @RequirePermissions("notification:read")
  getUnreadCount(): Promise<{ unreadCount: number }> {
    return this.notificationsService.getUnreadCount();
  }

  @Patch("read-state")
  @RequirePermissions("notification:read")
  markRead(): Promise<{ readAt: Date }> {
    return this.notificationsService.markRead();
  }
}
