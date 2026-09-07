import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelMessagesService } from "./channel-messages.service";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "./channel-messages.events";
import type { PrismaService } from "../../prisma/prisma.service";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { ChannelMessageDeliveryProducer } from "../../queues/channel-message-delivery.producer";

function buildPrismaMock() {
  return {
    channelMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
}

function buildEventEmitterMock() {
  return { emit: vi.fn() };
}

function buildDeliveryProducerMock() {
  return { enqueue: vi.fn() };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  emitterMock: ReturnType<typeof buildEventEmitterMock>,
  deliveryProducerMock: ReturnType<typeof buildDeliveryProducerMock> = buildDeliveryProducerMock(),
): ChannelMessagesService {
  return new ChannelMessagesService(
    prismaMock as unknown as PrismaService,
    emitterMock as unknown as EventEmitter2,
    deliveryProducerMock as unknown as ChannelMessageDeliveryProducer,
  );
}

// RM-13 — every row now carries the delivery-lifecycle fields; DELIVERED/
// null/0 is the schema's own default, matching what every pre-existing
// create actually gets.
const CREATED_ROW = {
  id: "message-1",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT" as const,
  direction: "INBOUND" as const,
  senderContactId: "contact-1",
  senderUserId: null,
  body: "Hi, I need help",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  deliveryStatus: "DELIVERED" as const,
  externalMessageId: null,
  failureReason: null,
  retryCount: 0,
};

describe("ChannelMessagesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let eventEmitter: ReturnType<typeof buildEventEmitterMock>;
  let deliveryProducer: ReturnType<typeof buildDeliveryProducerMock>;
  let service: ChannelMessagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    eventEmitter = buildEventEmitterMock();
    deliveryProducer = buildDeliveryProducerMock();
    service = createService(prisma, eventEmitter, deliveryProducer);
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
          deliveryStatus: "DELIVERED",
          externalMessageId: null,
          failureReason: null,
          retryCount: 0,
        },
      });
      expect(result.id).toBe("message-1");
      expect(result.deliveryStatus).toBe("DELIVERED");
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
      expect(result.deliveryStatus).toBe("DELIVERED");
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
          deliveryStatus: "DELIVERED",
          externalMessageId: null,
          failureReason: null,
          retryCount: 0,
        },
      ]);
    });

    it("returns an empty array for a ticket with no messages yet", async () => {
      prisma.channelMessage.findMany.mockResolvedValue([]);

      const result = await service.listForTicket("ticket-1");

      expect(result).toEqual([]);
    });
  });

  // RM-13 — Channel Message Delivery Status & Retry Model.
  describe("enqueueOutboundDelivery", () => {
    it("creates the row PENDING (not the schema's DELIVERED default), enqueues it for delivery, and emits CHANNEL_MESSAGE_CREATED_EVENT", async () => {
      const row = {
        ...CREATED_ROW,
        direction: "OUTBOUND" as const,
        senderContactId: null,
        senderUserId: "user-1",
        deliveryStatus: "PENDING" as const,
        body: "Your invoice is attached.",
      };
      prisma.channelMessage.create.mockResolvedValue(row);
      deliveryProducer.enqueue.mockResolvedValue({ id: "job-1" });

      const result = await service.enqueueOutboundDelivery(
        "ticket-1",
        "EMAIL",
        "user-1",
        "Your invoice is attached.",
      );

      expect(prisma.channelMessage.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          channelType: "EMAIL",
          direction: "OUTBOUND",
          senderUserId: "user-1",
          body: "Your invoice is attached.",
          deliveryStatus: "PENDING",
        },
      });
      expect(deliveryProducer.enqueue).toHaveBeenCalledWith({
        channelMessageId: "message-1",
        ticketId: "ticket-1",
        channelType: "EMAIL",
        body: "Your invoice is attached.",
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CHANNEL_MESSAGE_CREATED_EVENT,
        expect.objectContaining({ message: expect.objectContaining({ deliveryStatus: "PENDING" }) }),
      );
      expect(result.deliveryStatus).toBe("PENDING");
    });
  });

  describe("markSent", () => {
    it("sets deliveryStatus SENT and the given externalMessageId, and emits CHANNEL_MESSAGE_CREATED_EVENT", async () => {
      const row = {
        ...CREATED_ROW,
        direction: "OUTBOUND" as const,
        senderUserId: "user-1",
        senderContactId: null,
        deliveryStatus: "SENT" as const,
        externalMessageId: "provider-msg-1",
      };
      prisma.channelMessage.update.mockResolvedValue(row);

      const result = await service.markSent("message-1", "provider-msg-1");

      expect(prisma.channelMessage.update).toHaveBeenCalledWith({
        where: { id: "message-1" },
        data: { deliveryStatus: "SENT", externalMessageId: "provider-msg-1" },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CHANNEL_MESSAGE_CREATED_EVENT,
        expect.objectContaining({
          ticketId: "ticket-1",
          message: expect.objectContaining({ deliveryStatus: "SENT", externalMessageId: "provider-msg-1" }),
        }),
      );
      expect(result.deliveryStatus).toBe("SENT");
    });
  });

  describe("markDelivered", () => {
    it("sets deliveryStatus DELIVERED and emits CHANNEL_MESSAGE_CREATED_EVENT", async () => {
      const row = { ...CREATED_ROW, direction: "OUTBOUND" as const, deliveryStatus: "DELIVERED" as const };
      prisma.channelMessage.update.mockResolvedValue(row);

      const result = await service.markDelivered("message-1");

      expect(prisma.channelMessage.update).toHaveBeenCalledWith({
        where: { id: "message-1" },
        data: { deliveryStatus: "DELIVERED" },
      });
      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(result.deliveryStatus).toBe("DELIVERED");
    });
  });

  describe("markFailed", () => {
    it("sets deliveryStatus FAILED with the given failureReason/retryCount, and emits CHANNEL_MESSAGE_CREATED_EVENT", async () => {
      const row = {
        ...CREATED_ROW,
        direction: "OUTBOUND" as const,
        deliveryStatus: "FAILED" as const,
        failureReason: "Provider rejected: invalid recipient",
        retryCount: 3,
      };
      prisma.channelMessage.update.mockResolvedValue(row);

      const result = await service.markFailed("message-1", "Provider rejected: invalid recipient", 3);

      expect(prisma.channelMessage.update).toHaveBeenCalledWith({
        where: { id: "message-1" },
        data: { deliveryStatus: "FAILED", failureReason: "Provider rejected: invalid recipient", retryCount: 3 },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CHANNEL_MESSAGE_CREATED_EVENT,
        expect.objectContaining({
          message: expect.objectContaining({
            deliveryStatus: "FAILED",
            failureReason: "Provider rejected: invalid recipient",
            retryCount: 3,
          }),
        }),
      );
      expect(result.retryCount).toBe(3);
    });
  });
});
