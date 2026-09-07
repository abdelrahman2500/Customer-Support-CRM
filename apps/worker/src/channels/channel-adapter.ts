import type { ChannelMessage, ChannelType } from "@prisma/client";

/**
 * RM-14 — Channel Adapter Interface + Registry. Formalizes the
 * `ChannelAdapter`-shaped interface `docs/architecture/09-integrations.md`
 * already describes in prose ("Each system implements a small interface
 * such as... `EmailAdapter { send(), parseInbound() }`. Only adapters
 * import vendor SDKs or HTTP clients; business modules depend on
 * interfaces."). Lives in `apps/worker` — not `apps/api` — because
 * `send()` is the one operation this repository's architecture already
 * places in the worker (`docs/architecture/02-system-architecture-
 * overview.md`: "`apps/api` never blocks a request on slow external
 * work... always enqueued to BullMQ and performed by `apps/worker`"):
 * `ChannelMessageDeliveryProcessor` (RM-13's queue processor) is this
 * interface's one real caller.
 *
 * `send` takes the already-persisted, still-`PENDING` row (the message
 * itself, not just its id) so a real adapter has everything it needs to
 * build a provider request — a recipient address, the body, the ticket
 * it belongs to — without a second query of its own.
 *
 * `parseInbound` has no caller yet — Phase 5/RM-16's own inbound-parsing
 * story is what will actually invoke it, once a real provider webhook
 * exists to hand it a payload. `ParsedInboundMessage`'s shape below is
 * therefore deliberately provisional: enough for the interface to
 * compile and for today's adapters to trivially implement, not a
 * commitment RM-16 must keep unchanged.
 */
export interface ChannelAdapterSendResult {
  /** The provider's own id for the sent message, if it returned one.
   * `undefined` — not `null` — because a `ChannelAdapter` that has no
   * such concept (the three first-party adapters below) simply omits it,
   * the same way an optional field is omitted rather than nulled. */
  externalMessageId?: string;
}

/** Provisional — see this file's own doc comment. */
export interface ParsedInboundMessage {
  channelType: ChannelType;
  externalThreadId: string | null;
  /** The provider's own identifier for who sent it (an email address, a
   * phone number) — resolving this to a real `Contact` is a future
   * story's job, not this interface's. */
  senderIdentifier: string;
  body: string;
}

export interface ChannelAdapter {
  /** Deliver `message` (already `PENDING`) to its channel's real
   * transport. Resolves once the provider has *accepted* the message —
   * confirmed delivery, if the channel ever reports one, is a separate,
   * later status transition (`ChannelMessagesService.markDelivered`, not
   * this call). Rejects on a genuine send failure; `ChannelMessageDeliveryProcessor`
   * is what turns that into a `SENT`/`FAILED` status change either way. */
  send(message: ChannelMessage): Promise<ChannelAdapterSendResult>;

  /** Returns the parsed message, or `null` for a payload this adapter
   * doesn't recognize — never throws on an unrecognized shape, so a
   * future multi-adapter inbound-webhook receiver can safely try each
   * registered adapter in turn (RM-14's own plan, "allowing safe
   * multi-adapter registries later"). */
  parseInbound(payload: unknown): ParsedInboundMessage | null;
}
