import { Controller, Get } from "@nestjs/common";
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
}
