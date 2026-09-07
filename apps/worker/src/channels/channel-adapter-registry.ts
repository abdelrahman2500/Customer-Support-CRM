import { Inject, Injectable, Optional } from "@nestjs/common";
import type { ChannelType } from "@prisma/client";
import type { ChannelAdapter } from "./channel-adapter";
import { EMAIL_ADAPTER } from "./channels.constants";
import { FirstPartyChannelAdapter } from "./first-party-channel-adapter";

/**
 * RM-14 — resolves a `ChannelType` to its registered `ChannelAdapter`, or
 * `undefined` if none is registered — the correct, current state for
 * `WHATSAPP`/`SMS` until a Phase 5 story registers one.
 * `LIVE_CHAT`/`WEB_FORM`/`AI_CHAT` share one `FirstPartyChannelAdapter`
 * instance (see that class's own doc comment for why it's effectively
 * unreachable in production today).
 *
 * RM-15 — `EMAIL` is registered too, but only when `ChannelsModule`'s own
 * factory actually constructed a real `EmailAdapter` (SMTP configured);
 * `emailAdapter` is `@Optional()` so `resolve("EMAIL")` correctly returns
 * `undefined` — identical to `WHATSAPP`/`SMS` today — when it isn't.
 */
@Injectable()
export class ChannelAdapterRegistry {
  private readonly adapters: Map<ChannelType, ChannelAdapter>;

  constructor(
    firstPartyAdapter: FirstPartyChannelAdapter,
    @Optional() @Inject(EMAIL_ADAPTER) emailAdapter?: ChannelAdapter,
  ) {
    this.adapters = new Map<ChannelType, ChannelAdapter>([
      ["LIVE_CHAT", firstPartyAdapter],
      ["WEB_FORM", firstPartyAdapter],
      ["AI_CHAT", firstPartyAdapter],
    ]);
    if (emailAdapter) {
      this.adapters.set("EMAIL", emailAdapter);
    }
  }

  resolve(channelType: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channelType);
  }
}
