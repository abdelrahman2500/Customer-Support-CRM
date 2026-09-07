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
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { ApiKeyHasher } from "./api-key-hash";

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
 *
 * RM-22 — `ApiKeysController`/`ApiKeysService` (admin CRUD for
 * machine-to-machine credentials) join the same module for the same
 * "Connection configs... Integrations" domain-boundary reason
 * (`docs/architecture/03-domain-boundaries.md`). `ApiKeyHasher` is
 * exported — `common/auth/api-key.guard.ts` (registered globally as an
 * `APP_GUARD` in `app.module.ts`, outside this module entirely) needs the
 * exact same hashing logic `ApiKeysService` uses to issue a key, so the two
 * can never compute a different hash for the same raw key; this is the one
 * provider in this module a consumer outside it actually needs.
 */
@Module({
  imports: [QueuesModule],
  controllers: [
    WebhookSubscriptionsController,
    WebhookInboundController,
    WebhookInboundLogsController,
    ApiKeysController,
  ],
  providers: [
    WebhookSubscriptionsService,
    WebhookDispatchListener,
    WebhookInboundService,
    WebhookVerifierRegistry,
    ApiKeysService,
    ApiKeyHasher,
    TenantContext,
  ],
  exports: [ApiKeyHasher],
})
export class IntegrationsModule {}
