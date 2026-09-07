import { Module } from "@nestjs/common";
import { QueuesModule } from "../../queues/queues.module";
import { TenantContext } from "../../common/tenant/tenant-context";
import { WebhookSubscriptionsController } from "./webhook-subscriptions.controller";
import { WebhookSubscriptionsService } from "./webhook-subscriptions.service";
import { WebhookDispatchListener } from "./webhook-dispatch.listener";

/**
 * RM-20 — the `integrations`-schema-owning module: `WebhookSubscription`
 * CRUD (`WebhookSubscriptionsController`/`WebhookSubscriptionsService`) plus
 * the cross-domain `WebhookDispatchListener`, which needs
 * `WebhookDispatchProducer` from `QueuesModule` (mirrors
 * `NotificationsModule`'s own `imports: [QueuesModule]`, added for
 * `PortalNotificationEmailProducer` in RM-19) but no import of
 * Ticketing/SLA/Channels themselves — `@OnEvent` subscribes to the global
 * event bus without needing the emitting module's provider graph.
 */
@Module({
  imports: [QueuesModule],
  controllers: [WebhookSubscriptionsController],
  providers: [WebhookSubscriptionsService, WebhookDispatchListener, TenantContext],
})
export class IntegrationsModule {}
