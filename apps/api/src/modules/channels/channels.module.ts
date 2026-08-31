import { Module } from "@nestjs/common";
import { ChannelMessagesService } from "./channel-messages.service";

/**
 * Owns the `channels` schema — see docs/architecture/03-domain-
 * boundaries.md ("Communication / Channels"). Story 77 — `ChannelMessage`
 * persistence only; ticket-scoped orchestration (authorization + this
 * service) lives in `TicketsModule`'s `TicketChannelService`, mirroring
 * exactly how `AiModule`/`AiGatewayService` vs. `TicketAiService` split
 * responsibility (Story 72/73).
 */
@Module({
  providers: [ChannelMessagesService],
  exports: [ChannelMessagesService],
})
export class ChannelsModule {}
