import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelMessagesService } from "./channel-messages.service";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "./channel-messages.events";
import type { PrismaService } from "../../prisma/prisma.service";
import type { EventEmitter2 } from "@nestjs/event-emitter";

function buildPrismaMock() {
  return {
    channelMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

function buildEventEmitterMock() {
  return { emit: vi.fn() };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  emitterMock: ReturnType<typeof buildEventEmitterMock>,
): ChannelMessagesService {
  return new ChannelMessagesService(
    prismaMock as unknown as PrismaService,
    emitterMock as unknown as EventEmitter2,
  );
}

const CREATED_ROW = {
  id: "message-1",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT" as const,
  direction: "INBOUND" as const,
  senderContactId: "contact-1",
  senderUserId: null,
  body: "Hi, I need help",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

describe("ChannelMessagesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let eventEmitter: ReturnType<typeof buildEventEmitterMock>;
  let service: ChannelMessagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    eventEmitter = buildEventEmitterMock();
    service = createService(prisma, eventEmitter);
  });

  describe("createInboundFromContact", () => {
    it("creates an INBOUND row with the given senderContactId and emits CHANNEL_MESSAGE_CREATED_EVENT", async () => {
      prisma.channelMessage.create.mockResolvedValue(CREATED_ROW);

      const result = await service.createInboundFromContact(
        "ticket-1",
        "LIVE_CHAT",
        "contact-1",
        "Hi, I need help",
      );

      expect(prisma.channelMessage.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          channelType: "LIVE_CHAT",
          direction: "INBOUND",
          senderContactId: "contact-1",
          body: "Hi, I need help",
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(CHANNEL_MESSAGE_CREATED_EVENT, {
        ticketId: "ticket-1",
        message: {
          id: "message-1",
          ticketId: "ticket-1",
          channelType: "LIVE_CHAT",
          direction: "INBOUND",
          senderContactId: "contact-1",
          senderUserId: null,
          body: "Hi, I need help",
          createdAt: CREATED_ROW.createdAt,
        },
      });
      expect(result.id).toBe("message-1");
    });
  });

  describe("createOutboundFromUser", () => {
    it("creates an OUTBOUND row with the given senderUserId and emits CHANNEL_MESSAGE_CREATED_EVENT", async () => {
      const row = { ...CREATED_ROW, direction: "OUTBOUND" as const, senderContactId: null, senderUserId: "user-1" };
      prisma.channelMessage.create.mockResolvedValue(row);

      const result = await service.createOutboundFromUser("ticket-1", "LIVE_CHAT", "user-1", "How can I help?");

      expect(prisma.channelMessage.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          channelType: "LIVE_CHAT",
          direction: "OUTBOUND",
          senderUserId: "user-1",
          body: "How can I help?",
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(result.senderUserId).toBe("user-1");
      expect(result.senderContactId).toBeNull();
    });
  });

  // Story 85 — AI Chat: Escalate to a Human Ticket.
  describe("createSystemMessage", () => {
    it("creates a row with no senderContactId/senderUserId and emits CHANNEL_MESSAGE_CREATED_EVENT", async () => {
      const row = {
        ...CREATED_ROW,
        channelType: "AI_CHAT" as const,
        direction: "OUTBOUND" as const,
        senderContactId: null,
        senderUserId: null,
        body: "Have you tried resetting your password?",
      };
      prisma.channelMessage.create.mockResolvedValue(row);

      const result = await service.createSystemMessage(
        "ticket-1",
        "AI_CHAT",
        "OUTBOUND",
        "Have you tried resetting your password?",
      );

      expect(prisma.channelMessage.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          channelType: "AI_CHAT",
          direction: "OUTBOUND",
          body: "Have you tried resetting your password?",
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(result.senderUserId).toBeNull();
      expect(result.senderContactId).toBeNull();
    });
  });

  describe("listForTicket", () => {
    it("returns messages ordered chronologically ascending", async () => {
      prisma.channelMessage.findMany.mockResolvedValue([CREATED_ROW]);

      const result = await service.listForTicket("ticket-1");

      expect(prisma.channelMessage.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual([
        {
          id: "message-1",
          ticketId: "ticket-1",
          channelType: "LIVE_CHAT",
          direction: "INBOUND",
          senderContactId: "contact-1",
          senderUserId: null,
          body: "Hi, I need help",
          createdAt: CREATED_ROW.createdAt,
        },
      ]);
    });

    it("returns an empty array for a ticket with no messages yet", async () => {
      prisma.channelMessage.findMany.mockResolvedValue([]);

      const result = await service.listForTicket("ticket-1");

      expect(result).toEqual([]);
    });
  });
});
