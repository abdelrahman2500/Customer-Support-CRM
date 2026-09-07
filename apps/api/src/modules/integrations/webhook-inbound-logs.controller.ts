import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { ListWebhookInboundLogsQueryDto } from "./dto/list-webhook-inbound-logs-query.dto";
import type { WebhookInboundLogSummary } from "./webhook-inbound.service";
import { WebhookInboundService } from "./webhook-inbound.service";
import type { Paginated } from "../../common/pagination/paginated";

/** RM-21 — the admin-visibility half: read-only, gated by the same
 * `integration:manage` permission `WebhookSubscriptionsController` uses,
 * kept as its own controller (rather than folded into
 * `WebhookInboundController`) since that one is `@Public()` and this one
 * requires auth — the same "single-purpose controller" shape
 * `AuditLogsController` already establishes for a read-only view separate
 * from whatever writes the underlying log. */
@ApiTags("integrations")
@ApiBearerAuth()
@Controller("integrations/webhook-inbound-logs")
export class WebhookInboundLogsController {
  constructor(private readonly webhookInboundService: WebhookInboundService) {}

  @Get()
  @RequirePermissions("integration:manage")
  list(
    @Query() query: ListWebhookInboundLogsQueryDto,
  ): Promise<Paginated<WebhookInboundLogSummary>> {
    return this.webhookInboundService.listLogs(query);
  }
}
