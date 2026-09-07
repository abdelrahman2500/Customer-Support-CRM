import { Module } from "@nestjs/common";
import { QueuesModule } from "../../queues/queues.module";
import { TenantContext } from "../../common/tenant/tenant-context";
import { WebhookSubscriptionsController } from "./webhook-subscriptions.controller";
import { WebhookSubscriptionsService } from "./webhook-subscriptions.service";
import { WebhookDispatchListener } from "./webhook-dispatch.listener";
import { WebhookInboundController } from "./webhook-inbound.controller";
import { WebhookInboundLogsController } from "./webhook-inbound-logs.controller";
import { WebhookInboundService } from "./webhook-inbound.service";
import { WebhookVerifierRegistry } from "./webhook-verifier";

/**
 * RM-20 — the `integrations`-schema-owning module: `WebhookSubscription`
 * CRUD (`WebhookSubscriptionsController`/`WebhookSubscriptionsService`) plus
 * the cross-domain `WebhookDispatchListener`, which needs
 * `WebhookDispatchProducer` from `QueuesModule` (mirrors
 * `NotificationsModule`'s own `imports: [QueuesModule]`, added for
 * `PortalNotificationEmailProducer` in RM-19) but no import of
 * Ticketing/SLA/Channels themselves — `@OnEvent` subscribes to the global
 * event bus without needing the emitting module's provider graph.
 *
 * RM-21 — the inbound half joins the same module (same schema, same
 * `integration:manage` permission convention): `WebhookInboundController`
 * (`@Public()`, receives) + `WebhookInboundLogsController` (authenticated,
 * reads) share one `WebhookInboundService`. `WebhookVerifierRegistry` is
 * provided with its own default (empty) constructor argument — no real
 * verifier exists yet — via NestJS's ordinary class-provider instantiation;
 * a future provider-specific story replaces this with a factory provider
 * the way `ChannelsModule` conditionally constructs `EMAIL_ADAPTER`.
 */
@Module({
  imports: [QueuesModule],
  controllers: [WebhookSubscriptionsController, WebhookInboundController, WebhookInboundLogsController],
  providers: [
    WebhookSubscriptionsService,
    WebhookDispatchListener,
    WebhookInboundService,
    WebhookVerifierRegistry,
    TenantContext,
  ],
})
export class IntegrationsModule {}
