import { Injectable } from "@nestjs/common";
import type { ChannelMessage } from "@prisma/client";
import type { ChannelAdapter, ChannelAdapterSendResult, ParsedInboundMessage } from "./channel-adapter";

/**
 * RM-14 — the formalized shape of `LIVE_CHAT`/`WEB_FORM`/`AI_CHAT`'s own,
 * already-correct behavior: "`send` is a same-process DB write + realtime
 * emit, not a network call" (this story's own plan). One shared class for
 * all three, registered three times under different keys, since the
 * behavior is identical regardless of which of the three it is.
 *
 * This is deliberately unreachable in production today: every first-party
 * message is still created already-`DELIVERED` by `ChannelMessagesService`'s
 * three original factory methods (`createInboundFromContact`/
 * `createOutboundFromUser`/`createSystemMessage`, `apps/api`, unchanged by
 * this story) — none of them ever calls `enqueueOutboundDelivery`, so a
 * first-party message never enters the `PENDING`-then-queued flow this
 * adapter's `send()` would answer. Registering it anyway is what makes
 * `docs/architecture/09-integrations.md`'s adapter pattern actually true
 * for every `ChannelType`, not just the three future ones, and is a
 * genuine no-op: `send()` resolves immediately with no side effect,
 * because a first-party message never legitimately reaches it.
 */
@Injectable()
export class FirstPartyChannelAdapter implements ChannelAdapter {
  async send(_message: ChannelMessage): Promise<ChannelAdapterSendResult> {
    return {};
  }

  parseInbound(_payload: unknown): ParsedInboundMessage | null {
    // First-party channels never receive an external payload to parse.
    return null;
  }
}
