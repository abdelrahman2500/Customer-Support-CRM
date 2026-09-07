import { randomUUID } from "node:crypto";

/**
 * RM-13 — the minimal, no-op stand-in for a real Phase-5 channel adapter
 * (Email/WhatsApp/SMS), proving the `channel-message-delivery` queue's
 * loop end-to-end before any real provider exists. Always "succeeds"
 * immediately — it does no actual network I/O — and hands back a fake
 * provider message id in the same shape a real adapter's own accept
 * response would. Extracted to its own module (rather than inlined in
 * the processor) so the processor's own retry/hand-back logic can be
 * tested by mocking this one function's rejection, without needing a
 * real failure to actually occur.
 */
export interface NoOpChannelAdapterInput {
  channelMessageId: string;
  body: string;
}

export interface NoOpChannelAdapterResult {
  externalMessageId: string;
}

export async function sendViaNoOpAdapter(
  _input: NoOpChannelAdapterInput,
): Promise<NoOpChannelAdapterResult> {
  return { externalMessageId: `noop-${randomUUID()}` };
}
