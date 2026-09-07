import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { QueuesModule } from "../../queues/queues.module";
import { ChannelMessagesService } from "./channel-messages.service";
import { EmailStatusController } from "./email-status.controller";
import { QuickRepliesController } from "./quick-replies.controller";
import { QuickRepliesService } from "./quick-replies.service";

/**
 * Owns the `channels` schema — see docs/architecture/03-domain-
 * boundaries.md ("Communication / Channels"). Story 77 — `ChannelMessage`
 * persistence only; ticket-scoped orchestration (authorization + this
 * service) lives in `TicketsModule`'s `TicketChannelService`, mirroring
 * exactly how `AiModule`/`AiGatewayService` vs. `TicketAiService` split
 * responsibility (Story 72/73).
 *
 * Story 91 — `QuickReplies*` added: this module's first controller
 * (`ChannelMessage` has never needed one of its own — it's always reached
 * through `TicketsModule`'s ticket-scoped routes). `TenantContext` is
 * provided here the same way every other feature module provides it
 * (`SlaPoliciesModule`/`NotificationsModule`'s own doc-comment precedent).
 * `QuickRepliesService` is not exported — no other module consumes it,
 * mirroring `NotificationTemplatesService`'s own "not exported" precedent.
 *
 * RM-13 — imports `QueuesModule` (already exports `ChannelMessageDeliveryProducer`)
 * so `ChannelMessagesService` can inject it directly, mirroring exactly how
 * `AiModule`/`TicketsModule` import `QueuesModule` for `AiProcessingProducer`.
 *
 * RM-15 — `EmailStatusController` added the same way `QuickRepliesController`
 * was: its own controller file, registered here since it's channel-level
 * (not ticket-scoped) — see that controller's own doc comment for why it
 * carries no service/provider of its own (just `ConfigService`, already
 * globally available).
 */
@Module({
  imports: [QueuesModule],
  controllers: [QuickRepliesController, EmailStatusController],
  providers: [ChannelMessagesService, QuickRepliesService, TenantContext],
  exports: [ChannelMessagesService],
})
export class ChannelsModule {}
