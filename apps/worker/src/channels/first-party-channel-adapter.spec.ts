import { describe, expect, it } from "vitest";
import type { ChannelMessage } from "@prisma/client";
import { FirstPartyChannelAdapter } from "./first-party-channel-adapter";

const MESSAGE = {
  id: "message-1",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT",
  direction: "OUTBOUND",
  senderContactId: null,
  senderUserId: "user-1",
  body: "How can I help?",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  deliveryStatus: "PENDING",
  externalMessageId: null,
  failureReason: null,
  retryCount: 0,
} as unknown as ChannelMessage;

describe("FirstPartyChannelAdapter", () => {
  describe("send", () => {
    it("resolves immediately with no externalMessageId — a genuine no-op", async () => {
      const adapter = new FirstPartyChannelAdapter();

      const result = await adapter.send(MESSAGE);

      expect(result).toEqual({});
    });
  });

  describe("parseInbound", () => {
    it("always returns null — first-party channels never receive an external payload", () => {
      const adapter = new FirstPartyChannelAdapter();

      expect(adapter.parseInbound({ some: "payload" })).toBeNull();
      expect(adapter.parseInbound(undefined)).toBeNull();
    });
  });
});
