import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { AutomationActionListener } from "./automation-action.listener";
import { AUTOMATION_RULE_MATCHED_EVENT } from "../sla-policies/automation.events";
import type { AutomationRuleMatchedEvent } from "../sla-policies/automation.events";
import { TICKET_UPDATED_EVENT, TICKET_RECATEGORIZED_EVENT } from "./tickets.events";
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

const matchedEvent: AutomationRuleMatchedEvent = {
  ticketId: "ticket-1",
  ruleId: "rule-1",
  assignToUserId: "user-1",
  setCategory: null,
  setDepartmentId: null,
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

  it("skips entirely when every eligible field is already set — never overwrites", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      ...ticketRow,
      assignedToUserId: "user-other",
      category: "billing",
      departmentId: "dept-existing",
    });

    await listener.onAutomationRuleMatched({
      ...matchedEvent,
      setCategory: "billing",
      setDepartmentId: "dept-1",
    });

    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("applies the assignment when the ticket is still unassigned", async () => {
    prisma.ticket.findUnique.mockResolvedValue(ticketRow);
    prisma.ticket.update.mockResolvedValue({ ...ticketRow, assignedToUserId: "user-1" });

    await listener.onAutomationRuleMatched(matchedEvent);

    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: { assignedToUser: { connect: { id: "user-1" } } },
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

  it("never emits ticket.recategorized for an assignment-only change", async () => {
    prisma.ticket.findUnique.mockResolvedValue(ticketRow);
    prisma.ticket.update.mockResolvedValue({ ...ticketRow, assignedToUserId: "user-1" });

    await listener.onAutomationRuleMatched(matchedEvent);

    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      TICKET_RECATEGORIZED_EVENT,
      expect.anything(),
    );
  });

  // Story 83 — Automation Rules — Category & Department Actions.
  describe("category/department actions (Story 83)", () => {
    it("applies the category when the ticket's own is null", async () => {
      const uncategorized = { ...ticketRow, category: null, assignedToUserId: "user-already" };
      prisma.ticket.findUnique.mockResolvedValue(uncategorized);
      prisma.ticket.update.mockResolvedValue({ ...uncategorized, category: "billing" });

      await listener.onAutomationRuleMatched({ ...matchedEvent, setCategory: "billing" });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: { category: "billing" },
      });
    });

    it("applies the department when the ticket's own is null", async () => {
      const unrouted = { ...ticketRow, departmentId: null, assignedToUserId: "user-already" };
      prisma.ticket.findUnique.mockResolvedValue(unrouted);
      prisma.ticket.update.mockResolvedValue({ ...unrouted, departmentId: "dept-1" });

      await listener.onAutomationRuleMatched({ ...matchedEvent, setDepartmentId: "dept-1" });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: { department: { connect: { id: "dept-1" } } },
      });
    });

    it("applies category, department, and assignment together in one update", async () => {
      const untouched = { ...ticketRow, category: null, departmentId: null, assignedToUserId: null };
      prisma.ticket.findUnique.mockResolvedValue(untouched);
      prisma.ticket.update.mockResolvedValue({
        ...untouched,
        category: "billing",
        departmentId: "dept-1",
        assignedToUserId: "user-1",
      });

      await listener.onAutomationRuleMatched({
        ...matchedEvent,
        setCategory: "billing",
        setDepartmentId: "dept-1",
      });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: {
          assignedToUser: { connect: { id: "user-1" } },
          category: "billing",
          department: { connect: { id: "dept-1" } },
        },
      });
    });

    it("skips a field the ticket already has set, but still applies the others", async () => {
      const partiallySet = { ...ticketRow, category: "billing", departmentId: null, assignedToUserId: null };
      prisma.ticket.findUnique.mockResolvedValue(partiallySet);
      prisma.ticket.update.mockResolvedValue({ ...partiallySet, departmentId: "dept-1" });

      await listener.onAutomationRuleMatched({
        ...matchedEvent,
        setCategory: "sales",
        setDepartmentId: "dept-1",
      });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: {
          assignedToUser: { connect: { id: "user-1" } },
          department: { connect: { id: "dept-1" } },
        },
      });
    });

    it("emits ticket.recategorized when the category changes", async () => {
      const uncategorized = { ...ticketRow, category: null, assignedToUserId: "user-already" };
      prisma.ticket.findUnique.mockResolvedValue(uncategorized);
      prisma.ticket.update.mockResolvedValue({ ...uncategorized, category: "billing" });

      await listener.onAutomationRuleMatched({ ...matchedEvent, setCategory: "billing" });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        TICKET_RECATEGORIZED_EVENT,
        expect.objectContaining({ actorUserId: null }),
      );
    });

    it("emits ticket.recategorized when the department changes", async () => {
      const unrouted = { ...ticketRow, departmentId: null, assignedToUserId: "user-already" };
      prisma.ticket.findUnique.mockResolvedValue(unrouted);
      prisma.ticket.update.mockResolvedValue({ ...unrouted, departmentId: "dept-1" });

      await listener.onAutomationRuleMatched({ ...matchedEvent, setDepartmentId: "dept-1" });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        TICKET_RECATEGORIZED_EVENT,
        expect.objectContaining({ actorUserId: null }),
      );
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
