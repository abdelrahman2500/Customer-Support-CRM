import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketHistoryListener } from "./ticket-history.listener";
import {
  TICKET_CREATED_EVENT,
  TICKET_UPDATED_EVENT,
  TICKET_RECATEGORIZED_EVENT,
  TICKET_ESCALATED_EVENT,
} from "./tickets.events";
import type { TicketSummary } from "./tickets.service";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    ticketHistoryEntry: {
      create: vi.fn(),
    },
  };
}

function createListener(prismaMock: ReturnType<typeof buildPrismaMock>): TicketHistoryListener {
  return new TicketHistoryListener(prismaMock as unknown as PrismaService);
}

const ticket: TicketSummary = {
  id: "ticket-1",
  subject: "Cannot log in",
  category: null,
  priority: "MEDIUM",
  status: "OPEN",
  customerId: "customer-1",
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
};

describe("TicketHistoryListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: TicketHistoryListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    listener = createListener(prisma);
  });

  describe("onTicketCreated", () => {
    it("persists a history row with the event type, actor, and full snapshot", async () => {
      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          actorUserId: "user-1",
          eventType: TICKET_CREATED_EVENT,
          snapshot: ticket,
        },
      });
    });

    it("does not throw when persistence fails — it catches and logs instead", async () => {
      prisma.ticketHistoryEntry.create.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketCreated({ ticket, actorUserId: "user-1" })).resolves.toBeUndefined();
    });
  });

  describe("onTicketUpdated", () => {
    it("persists a history row with eventType ticket.updated", async () => {
      await listener.onTicketUpdated({ ticket, actorUserId: null });

      expect(prisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          actorUserId: null,
          eventType: TICKET_UPDATED_EVENT,
          snapshot: ticket,
        },
      });
    });

    it("does not throw when persistence fails — it catches and logs instead", async () => {
      prisma.ticketHistoryEntry.create.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketUpdated({ ticket, actorUserId: "user-1" })).resolves.toBeUndefined();
    });
  });

  describe("onTicketRecategorized", () => {
    it("persists a history row with eventType ticket.recategorized", async () => {
      await listener.onTicketRecategorized({ ticket, actorUserId: null });

      expect(prisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          actorUserId: null,
          eventType: TICKET_RECATEGORIZED_EVENT,
          snapshot: ticket,
        },
      });
    });

    it("does not throw when persistence fails — it catches and logs instead", async () => {
      prisma.ticketHistoryEntry.create.mockRejectedValue(new Error("db unavailable"));

      await expect(
        listener.onTicketRecategorized({ ticket, actorUserId: "user-1" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("onTicketEscalated", () => {
    it("persists a history row with eventType ticket.escalated", async () => {
      await listener.onTicketEscalated({ ticket, actorUserId: null });

      expect(prisma.ticketHistoryEntry.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          actorUserId: null,
          eventType: TICKET_ESCALATED_EVENT,
          snapshot: ticket,
        },
      });
    });

    it("does not throw when persistence fails — it catches and logs instead", async () => {
      prisma.ticketHistoryEntry.create.mockRejectedValue(new Error("db unavailable"));

      await expect(
        listener.onTicketEscalated({ ticket, actorUserId: "user-1" }),
      ).resolves.toBeUndefined();
    });
  });
});
