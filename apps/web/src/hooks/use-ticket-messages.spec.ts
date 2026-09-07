import { describe, expect, it } from "vitest";
import { mergeChannelMessage } from "./use-ticket-messages";
import type { ChannelMessageSummary } from "@/lib/ticket-messages-api";

function buildMessage(overrides: Partial<ChannelMessageSummary>): ChannelMessageSummary {
  return {
    id: "message-1",
    ticketId: "ticket-1",
    channelType: "LIVE_CHAT",
    direction: "INBOUND",
    senderContactId: "contact-1",
    senderUserId: null,
    body: "hello",
    createdAt: "2024-01-01T00:00:00.000Z",
    deliveryStatus: "DELIVERED",
    externalMessageId: null,
    failureReason: null,
    retryCount: 0,
    ...overrides,
  };
}

/**
 * Story 78 — `mergeChannelMessage` is the one piece of new chat logic worth
 * unit-testing directly (mirrors `sla.spec.ts`'s own precedent of testing a
 * pure helper in isolation): `use-tickets.ts`'s own `useQuery`/`useMutation`
 * hooks have never had dedicated specs in this codebase — components mock
 * them instead (`ticket-detail-view.spec.tsx`) — so `useTicketMessagesQuery`/
 * `useCreateTicketMessageMutation` are exercised the same way, via
 * `ticket-chat-card.spec.tsx`, not here.
 */
describe("mergeChannelMessage", () => {
  it("appends a new message to an empty list", () => {
    const message = buildMessage({});
    expect(mergeChannelMessage(undefined, message)).toEqual([message]);
  });

  it("appends a new message after existing ones", () => {
    const first = buildMessage({ id: "message-1", createdAt: "2024-01-01T00:00:00.000Z" });
    const second = buildMessage({ id: "message-2", createdAt: "2024-01-01T00:01:00.000Z" });
    expect(mergeChannelMessage([first], second)).toEqual([first, second]);
  });

  it("keeps a single copy when the sender's own broadcast echoes back identical content", () => {
    const message = buildMessage({ id: "message-1" });
    const echo = buildMessage({ id: "message-1" });
    expect(mergeChannelMessage([message], echo)).toEqual([message]);
  });

  // RM-13 — a status-update re-emission for an already-present id must
  // replace it, not be ignored as if it were the old no-op-on-duplicate
  // behavior — see this function's own doc comment for why.
  it("replaces an existing message's content when the same id arrives again with a different deliveryStatus", () => {
    const pending = buildMessage({ id: "message-1", deliveryStatus: "PENDING" });
    const sent = buildMessage({
      id: "message-1",
      deliveryStatus: "SENT",
      externalMessageId: "provider-msg-1",
    });

    const result = mergeChannelMessage([pending], sent);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(sent);
  });

  it("keeps the list chronological even if delivery order is out of order", () => {
    const later = buildMessage({ id: "message-2", createdAt: "2024-01-01T00:02:00.000Z" });
    const earlier = buildMessage({ id: "message-1", createdAt: "2024-01-01T00:01:00.000Z" });
    expect(mergeChannelMessage([later], earlier)).toEqual([earlier, later]);
  });
});
