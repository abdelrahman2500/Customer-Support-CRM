import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookDispatchListener } from "./webhook-dispatch.listener";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../channels/channel-messages.events";
import type { PrismaService } from "../../prisma/prisma.service";
import type { WebhookDispatchProducer } from "../../queues/webhook-dispatch.producer";

function buildPrismaMock() {
  return {
    ticket: {
      findUnique: vi.fn(),
    },
    webhookSubscription: {
      findMany: vi.fn(),
    },
  };
}

function buildProducerMock() {
  return {
    enqueue: vi.fn().mockResolvedValue({ id: "job-1" }),
  };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  producerMock: ReturnType<typeof buildProducerMock>,
): WebhookDispatchListener {
  return new WebhookDispatchListener(
    prismaMock as unknown as PrismaService,
    producerMock as unknown as WebhookDispatchProducer,
  );
}

const ticketEvent = {
  ticket: {
    id: "ticket-1",
    subject: "Cannot log in",
    categoryId: null,
    categoryName: null,
    priority: "URGENT" as const,
    status: "OPEN" as const,
    customerId: "customer-1",
    customerName: null,
    contactId: null,
    departmentId: null,
    assignedToUserId: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  },
  actorUserId: "agent-1",
  // RM-29 — only `TicketCreatedEvent` actually requires this; harmless
  // extra property on the `TicketUpdatedEvent`/`TicketEscalatedEvent`
  // handlers this same fixture is also passed to in the `it.each` below.
  priorityExplicit: true,
};

const ONE_MATCHING_SUBSCRIPTION = [{ id: "subscription-1" }];

describe("WebhookDispatchListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let producer: ReturnType<typeof buildProducerMock>;
  let listener: WebhookDispatchListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    producer = buildProducerMock();
    listener = createListener(prisma, producer);
  });

  describe("onTicketCreated / onTicketUpdated / onTicketEscalated", () => {
    const TICKET_EVENT_HANDLERS = [
      ["onTicketCreated", (l: WebhookDispatchListener) => l.onTicketCreated.bind(l)],
      ["onTicketUpdated", (l: WebhookDispatchListener) => l.onTicketUpdated.bind(l)],
      ["onTicketEscalated", (l: WebhookDispatchListener) => l.onTicketEscalated.bind(l)],
    ] as const;

    it.each(TICKET_EVENT_HANDLERS)(
      "%s resolves the ticket's branchId and enqueues a job per matching active subscription",
      async (_name, bindHandler) => {
        prisma.ticket.findUnique.mockResolvedValue({ branchId: "branch-1" });
        prisma.webhookSubscription.findMany.mockResolvedValue(ONE_MATCHING_SUBSCRIPTION);

        await bindHandler(listener)(ticketEvent);

        expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
          where: { id: "ticket-1" },
          select: { branchId: true },
        });
        expect(prisma.webhookSubscription.findMany).toHaveBeenCalledWith({
          where: {
            branchId: "branch-1",
            isActive: true,
            subscribedEventTypes: { has: expect.any(String) },
          },
        });
        expect(producer.enqueue).toHaveBeenCalledWith({
          subscriptionId: "subscription-1",
          eventType: expect.any(String),
          ticketId: "ticket-1",
        });
      },
    );

    it("does not throw and enqueues nothing when the ticket cannot be found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(listener.onTicketUpdated(ticketEvent)).resolves.toBeUndefined();

      expect(prisma.webhookSubscription.findMany).not.toHaveBeenCalled();
      expect(producer.enqueue).not.toHaveBeenCalled();
    });

    it("never throws when the ticket lookup itself fails", async () => {
      prisma.ticket.findUnique.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketUpdated(ticketEvent)).resolves.toBeUndefined();
    });

    it("never throws when the enqueue itself fails", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ branchId: "branch-1" });
      prisma.webhookSubscription.findMany.mockResolvedValue(ONE_MATCHING_SUBSCRIPTION);
      producer.enqueue.mockRejectedValue(new Error("redis unavailable"));

      await expect(listener.onTicketUpdated(ticketEvent)).resolves.toBeUndefined();
    });

    it("enqueues nothing when no subscription is currently active for that event type", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ branchId: "branch-1" });
      prisma.webhookSubscription.findMany.mockResolvedValue([]);

      await listener.onTicketUpdated(ticketEvent);

      expect(producer.enqueue).not.toHaveBeenCalled();
    });

    it("enqueues one job per matching subscription", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ branchId: "branch-1" });
      prisma.webhookSubscription.findMany.mockResolvedValue([
        { id: "subscription-1" },
        { id: "subscription-2" },
      ]);

      await listener.onTicketUpdated(ticketEvent);

      expect(producer.enqueue).toHaveBeenCalledTimes(2);
    });
  });

  describe("onSlaAtRisk / onSlaBreached", () => {
    const slaEvent = {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "response" as const,
      targetAt: new Date("2024-01-02T00:00:00.000Z"),
    };

    const SLA_EVENT_HANDLERS = [
      ["onSlaAtRisk", (l: WebhookDispatchListener) => l.onSlaAtRisk.bind(l)],
      ["onSlaBreached", (l: WebhookDispatchListener) => l.onSlaBreached.bind(l)],
    ] as const;

    it.each(SLA_EVENT_HANDLERS)(
      "%s dispatches directly from the event's own branchId, no ticket lookup",
      async (_name, bindHandler) => {
        prisma.webhookSubscription.findMany.mockResolvedValue(ONE_MATCHING_SUBSCRIPTION);

        await bindHandler(listener)(slaEvent);

        expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
        expect(prisma.webhookSubscription.findMany).toHaveBeenCalledWith({
          where: {
            branchId: "branch-1",
            isActive: true,
            subscribedEventTypes: { has: expect.any(String) },
          },
        });
        expect(producer.enqueue).toHaveBeenCalledWith({
          subscriptionId: "subscription-1",
          eventType: expect.any(String),
          ticketId: "ticket-1",
        });
      },
    );

    it("never throws when the subscription lookup fails", async () => {
      prisma.webhookSubscription.findMany.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onSlaBreached(slaEvent)).resolves.toBeUndefined();
    });
  });

  describe("onChannelMessageCreated", () => {
    const channelEvent = {
      ticketId: "ticket-1",
      message: {
        id: "message-1",
        ticketId: "ticket-1",
        channelType: "LIVE_CHAT" as const,
        direction: "OUTBOUND" as const,
        senderContactId: null,
        senderUserId: "agent-1",
        body: "We're looking into this.",
        createdAt: new Date("2024-01-02T00:00:00.000Z"),
        deliveryStatus: "DELIVERED" as const,
        externalMessageId: null,
        failureReason: null,
        retryCount: 0,
      },
    };

    it("resolves the ticket's branchId and enqueues for channel.message.created", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ branchId: "branch-1" });
      prisma.webhookSubscription.findMany.mockResolvedValue(ONE_MATCHING_SUBSCRIPTION);

      await listener.onChannelMessageCreated(channelEvent);

      expect(prisma.webhookSubscription.findMany).toHaveBeenCalledWith({
        where: {
          branchId: "branch-1",
          isActive: true,
          subscribedEventTypes: { has: CHANNEL_MESSAGE_CREATED_EVENT },
        },
      });
      expect(producer.enqueue).toHaveBeenCalledWith({
        subscriptionId: "subscription-1",
        eventType: CHANNEL_MESSAGE_CREATED_EVENT,
        ticketId: "ticket-1",
      });
    });
  });
});
