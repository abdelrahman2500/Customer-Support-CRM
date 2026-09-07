import { Module } from "@nestjs/common";
import { ChannelAdapterRegistry } from "./channel-adapter-registry";
import { FirstPartyChannelAdapter } from "./first-party-channel-adapter";

/**
 * RM-14 — Channel Adapter Interface + Registry. Mirrors `AiProviderModule`'s
 * own minimal shape: exports the one thing a consumer (RM-13's
 * `ChannelMessageDeliveryProcessor`) needs, registers this module in
 * `WorkerModule` so Nest actually constructs it at boot.
 */
@Module({
  providers: [FirstPartyChannelAdapter, ChannelAdapterRegistry],
  exports: [ChannelAdapterRegistry],
})
export class ChannelsModule {}
