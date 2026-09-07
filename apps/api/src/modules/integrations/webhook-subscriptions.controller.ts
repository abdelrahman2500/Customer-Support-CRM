import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateWebhookSubscriptionDto } from "./dto/create-webhook-subscription.dto";
import { UpdateWebhookSubscriptionDto } from "./dto/update-webhook-subscription.dto";
import { ListWebhookDeliveryAttemptsQueryDto } from "./dto/list-webhook-delivery-attempts-query.dto";
import type {
  WebhookDeliveryAttemptSummary,
  WebhookSubscriptionCreated,
  WebhookSubscriptionSummary,
} from "./webhook-subscriptions.service";
import { WebhookSubscriptionsService } from "./webhook-subscriptions.service";
import type { Paginated } from "../../common/pagination/paginated";

/** RM-20 — gated by a single `integration:manage` permission for every
 * route (see the seed catalog's own doc comment for why this resource has
 * no read/write split). */
@ApiTags("integrations")
@ApiBearerAuth()
@Controller("integrations/webhook-subscriptions")
export class WebhookSubscriptionsController {
  constructor(private readonly webhookSubscriptionsService: WebhookSubscriptionsService) {}

  @Post()
  @RequirePermissions("integration:manage")
  create(@Body() dto: CreateWebhookSubscriptionDto): Promise<WebhookSubscriptionCreated> {
    return this.webhookSubscriptionsService.createSubscription(dto);
  }

  @Get()
  @RequirePermissions("integration:manage")
  list(): Promise<WebhookSubscriptionSummary[]> {
    return this.webhookSubscriptionsService.listSubscriptions();
  }

  @Get(":id")
  @RequirePermissions("integration:manage")
  getOne(@Param("id") id: string): Promise<WebhookSubscriptionSummary> {
    return this.webhookSubscriptionsService.getSubscription(id);
  }

  @Patch(":id")
  @RequirePermissions("integration:manage")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateWebhookSubscriptionDto,
  ): Promise<WebhookSubscriptionSummary> {
    return this.webhookSubscriptionsService.updateSubscription(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("integration:manage")
  async remove(@Param("id") id: string): Promise<{ id: string }> {
    await this.webhookSubscriptionsService.deleteSubscription(id);
    return { id };
  }

  @Get(":id/delivery-attempts")
  @RequirePermissions("integration:manage")
  listDeliveryAttempts(
    @Param("id") id: string,
    @Query() query: ListWebhookDeliveryAttemptsQueryDto,
  ): Promise<Paginated<WebhookDeliveryAttemptSummary>> {
    return this.webhookSubscriptionsService.listDeliveryAttempts(id, query);
  }
}
