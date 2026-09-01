import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { ChannelMessagesService } from "./channel-messages.service";
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
 */
@Module({
  controllers: [QuickRepliesController],
  providers: [ChannelMessagesService, QuickRepliesService, TenantContext],
  exports: [ChannelMessagesService],
})
export class ChannelsModule {}
