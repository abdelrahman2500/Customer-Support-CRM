import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { AutomationActionListener } from "./automation-action.listener";
import { AUTOMATION_RULE_MATCHED_EVENT } from "../sla-policies/automation.events";
import { TICKET_UPDATED_EVENT } from "./tickets.events";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    ticket: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

function buildEventEmitterMock() {
  return { emit: vi.fn() };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  eventEmitterMock: ReturnType<typeof buildEventEmitterMock>,
): AutomationActionListener {
  return new AutomationActionListener(
    prismaMock as unknown as PrismaService,
    eventEmitterMock as unknown as EventEmitter2,
  );
}

const matchedEvent = {
  ticketId: "ticket-1",
  ruleId: "rule-1",
  assignToUserId: "user-1",
};

const ticketRow = {
  id: "ticket-1",
  subject: "Cannot log in",
  category: "billing",
  priority: "MEDIUM",
  status: "OPEN",
  customerId: "customer-1",
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("AutomationActionListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let eventEmitter: ReturnType<typeof buildEventEmitterMock>;
  let listener: AutomationActionListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    eventEmitter = buildEventEmitterMock();
    listener = createListener(prisma, eventEmitter);
  });

  it("does nothing when the ticket no longer exists", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    await listener.onAutomationRuleMatched(matchedEvent);

    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("skips when the ticket became assigned in the meantime — never overwrites", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ ...ticketRow, assignedToUserId: "user-other" });

    await listener.onAutomationRuleMatched(matchedEvent);

    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("applies the assignment when the ticket is still unassigned", async () => {
    prisma.ticket.findUnique.mockResolvedValue(ticketRow);
    prisma.ticket.update.mockResolvedValue({ ...ticketRow, assignedToUserId: "user-1" });

    await listener.onAutomationRuleMatched(matchedEvent);

    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: { assignedToUserId: "user-1" },
    });
  });

  it("emits ticket.updated with actorUserId null after a successful assignment", async () => {
    prisma.ticket.findUnique.mockResolvedValue(ticketRow);
    prisma.ticket.update.mockResolvedValue({ ...ticketRow, assignedToUserId: "user-1" });

    await listener.onAutomationRuleMatched(matchedEvent);

    expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_UPDATED_EVENT, {
      ticket: {
        id: "ticket-1",
        subject: "Cannot log in",
        category: "billing",
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: "user-1",
        createdAt: ticketRow.createdAt,
        updatedAt: ticketRow.updatedAt,
      },
      actorUserId: null,
    });
  });

  it("catches and logs a Prisma failure without rethrowing", async () => {
    prisma.ticket.findUnique.mockRejectedValue(new Error("db unavailable"));

    await expect(listener.onAutomationRuleMatched(matchedEvent)).resolves.toBeUndefined();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("subscribes to automation.rule_matched", () => {
    expect(AUTOMATION_RULE_MATCHED_EVENT).toBe("automation.rule_matched");
  });
});
