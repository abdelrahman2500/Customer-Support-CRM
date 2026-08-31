import { describe, expect, it } from "vitest";
import { mergeChannelMessage } from "./use-portal-tickets";
import type { ChannelMessageSummary } from "@/lib/tickets-api";

function buildMessage(overrides: Partial<ChannelMessageSummary>): ChannelMessageSummary {
  return {
    id: "message-1",
    ticketId: "ticket-1",
    channelType: "LIVE_CHAT",
    direction: "OUTBOUND",
    senderContactId: null,
    senderUserId: "agent-1",
    body: "hello",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Story 78 — mirrors `apps/web/src/hooks/use-ticket-messages.spec.ts`
 * exactly: `mergeChannelMessage` is the one piece of new chat logic worth
 * unit-testing directly (this file's own `useQuery`/`useMutation` hooks have
 * never had dedicated specs in this codebase, matching that file's existing
 * precedent — `TicketChatCard`'s own spec exercises them instead).
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

  it("does not duplicate a message whose id is already present", () => {
    const message = buildMessage({ id: "message-1" });
    const duplicate = buildMessage({ id: "message-1", body: "hello (echoed back)" });
    expect(mergeChannelMessage([message], duplicate)).toEqual([message]);
  });

  it("keeps the list chronological even if delivery order is out of order", () => {
    const later = buildMessage({ id: "message-2", createdAt: "2024-01-01T00:02:00.000Z" });
    const earlier = buildMessage({ id: "message-1", createdAt: "2024-01-01T00:01:00.000Z" });
    expect(mergeChannelMessage([later], earlier)).toEqual([earlier, later]);
  });
});
