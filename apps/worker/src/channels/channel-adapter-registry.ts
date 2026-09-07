import { Injectable } from "@nestjs/common";
import type { ChannelType } from "@prisma/client";
import type { ChannelAdapter } from "./channel-adapter";
import { FirstPartyChannelAdapter } from "./first-party-channel-adapter";

/**
 * RM-14 — resolves a `ChannelType` to its registered `ChannelAdapter`, or
 * `undefined` if none is registered — the correct, current state for
 * `EMAIL`/`WHATSAPP`/`SMS` until a Phase 5 story registers a real one.
 * `LIVE_CHAT`/`WEB_FORM`/`AI_CHAT` share one `FirstPartyChannelAdapter`
 * instance (see that class's own doc comment for why it's effectively
 * unreachable in production today).
 */
@Injectable()
export class ChannelAdapterRegistry {
  private readonly adapters: ReadonlyMap<ChannelType, ChannelAdapter>;

  constructor(firstPartyAdapter: FirstPartyChannelAdapter) {
    this.adapters = new Map<ChannelType, ChannelAdapter>([
      ["LIVE_CHAT", firstPartyAdapter],
      ["WEB_FORM", firstPartyAdapter],
      ["AI_CHAT", firstPartyAdapter],
    ]);
  }

  resolve(channelType: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channelType);
  }
}
