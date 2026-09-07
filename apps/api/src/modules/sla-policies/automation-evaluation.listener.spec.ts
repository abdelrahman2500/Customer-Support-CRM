import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutomationEvaluationListener } from "./automation-evaluation.listener";
import { AUTOMATION_RULE_MATCHED_EVENT } from "./automation.events";
import type { TicketSummary } from "../tickets/tickets.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { EventEmitter2 } from "@nestjs/event-emitter";

function buildPrismaMock() {
  return {
    ticket: {
      findUnique: vi.fn(),
      // RM-24 — LEAST_LOADED's own open-ticket-count query.
      groupBy: vi.fn(),
    },
    automationRule: {
      findFirst: vi.fn(),
    },
  };
}

function buildEventEmitterMock() {
  return { emit: vi.fn() };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  eventEmitterMock: ReturnType<typeof buildEventEmitterMock>,
): AutomationEvaluationListener {
  return new AutomationEvaluationListener(
    prismaMock as unknown as PrismaService,
    eventEmitterMock as unknown as EventEmitter2,
  );
}

const ticket: TicketSummary = {
  id: "ticket-1",
  subject: "Cannot log in",
  categoryId: "category-1",
  categoryName: "billing",
  priority: "MEDIUM",
  status: "OPEN",
  customerId: "customer-1",
  customerName: null,
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("AutomationEvaluationListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let eventEmitter: ReturnType<typeof buildEventEmitterMock>;
  let listener: AutomationEvaluationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    eventEmitter = buildEventEmitterMock();
    listener = createListener(prisma, eventEmitter);
  });

  it("does nothing when the ticket no longer exists", async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

    expect(prisma.automationRule.findFirst).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("never overrides an explicit assignment", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      branchId: "branch-1",
      categoryId: "category-1",
      assignedToUserId: "user-explicit",
    });

    await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

    expect(prisma.automationRule.findFirst).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("does nothing when no active rule matches", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      branchId: "branch-1",
      categoryId: "category-1",
      assignedToUserId: null,
    });
    prisma.automationRule.findFirst.mockResolvedValue(null);

    await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("queries with a category-or-wildcard filter, scoped by branch and isActive", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      branchId: "branch-1",
      categoryId: "category-1",
      assignedToUserId: null,
    });
    prisma.automationRule.findFirst.mockResolvedValue(null);

    await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

    expect(prisma.automationRule.findFirst).toHaveBeenCalledWith({
      where: {
        branchId: "branch-1",
        isActive: true,
        OR: [{ conditionCategoryId: null }, { conditionCategoryId: "category-1" }],
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        actionAssignToUserId: true,
        actionAssignmentMode: true,
        eligibleAgentPool: true,
        actionSetCategoryId: true,
        actionSetDepartmentId: true,
        actionSetPriority: true,
      },
    });
  });

  it("queries with only a wildcard filter when the ticket has no category", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      branchId: "branch-1",
      categoryId: null,
      assignedToUserId: null,
    });
    prisma.automationRule.findFirst.mockResolvedValue(null);

    await listener.onTicketCreated({
      ticket: { ...ticket, categoryId: null, categoryName: null },
      actorUserId: null,
      priorityExplicit: false,
    });

    expect(prisma.automationRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: "branch-1", isActive: true, conditionCategoryId: null },
      }),
    );
  });

  it("emits AUTOMATION_RULE_MATCHED_EVENT when a rule matches", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      branchId: "branch-1",
      categoryId: "category-1",
      assignedToUserId: null,
    });
    prisma.automationRule.findFirst.mockResolvedValue({
      id: "rule-1",
      actionAssignToUserId: "user-1",
      actionSetCategoryId: null,
      actionSetDepartmentId: null,
      actionSetPriority: null,
    });

    await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

    expect(eventEmitter.emit).toHaveBeenCalledWith(AUTOMATION_RULE_MATCHED_EVENT, {
      ticketId: "ticket-1",
      ruleId: "rule-1",
      assignToUserId: "user-1",
      setCategoryId: null,
      setDepartmentId: null,
      setPriority: null,
      priorityExplicit: false,
    });
  });

  // Story 83 — Automation Rules — Category & Department Actions.
  it("includes the matched rule's own setCategoryId/setDepartmentId in the emitted event", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      branchId: "branch-1",
      categoryId: "category-1",
      assignedToUserId: null,
    });
    prisma.automationRule.findFirst.mockResolvedValue({
      id: "rule-1",
      actionAssignToUserId: "user-1",
      actionSetCategoryId: "category-1",
      actionSetDepartmentId: "dept-1",
    });

    await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      AUTOMATION_RULE_MATCHED_EVENT,
      expect.objectContaining({ setCategoryId: "category-1", setDepartmentId: "dept-1" }),
    );
  });

  // RM-29 — Automation Rules: auto-set priority action.
  describe("priority action (RM-29)", () => {
    it("includes the matched rule's own actionSetPriority as setPriority in the emitted event", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        branchId: "branch-1",
        categoryId: "category-1",
        assignedToUserId: null,
      });
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        actionAssignToUserId: "user-1",
        actionSetCategoryId: null,
        actionSetDepartmentId: null,
        actionSetPriority: "URGENT",
      });

      await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AUTOMATION_RULE_MATCHED_EVENT,
        expect.objectContaining({ setPriority: "URGENT" }),
      );
    });

    it("passes the event's own priorityExplicit straight through, never re-deriving it", async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        branchId: "branch-1",
        categoryId: "category-1",
        assignedToUserId: null,
      });
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        actionAssignToUserId: "user-1",
        actionSetCategoryId: null,
        actionSetDepartmentId: null,
        actionSetPriority: "URGENT",
      });

      await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: true });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AUTOMATION_RULE_MATCHED_EVENT,
        expect.objectContaining({ priorityExplicit: true }),
      );
    });
  });

  // RM-24 — Round-Robin / Load-Based Automatic Assignment.
  describe("LEAST_LOADED resolution (RM-24)", () => {
    function mockTicket() {
      prisma.ticket.findUnique.mockResolvedValue({
        branchId: "branch-1",
        categoryId: "category-1",
        assignedToUserId: null,
      });
    }

    it("assigns to the eligible-pool member with the fewest open tickets", async () => {
      mockTicket();
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        actionAssignToUserId: "user-fallback",
        actionAssignmentMode: "LEAST_LOADED",
        eligibleAgentPool: ["user-a", "user-b", "user-c"],
        actionSetCategoryId: null,
        actionSetDepartmentId: null,
      });
      prisma.ticket.groupBy.mockResolvedValue([
        { assignedToUserId: "user-a", status: "OPEN", _count: { _all: 3 } },
        { assignedToUserId: "user-b", status: "IN_PROGRESS", _count: { _all: 1 } },
        { assignedToUserId: "user-c", status: "OPEN", _count: { _all: 5 } },
      ]);

      await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith({
        by: ["assignedToUserId", "status"],
        where: {
          assignedToUserId: { in: ["user-a", "user-b", "user-c"] },
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        _count: { _all: true },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AUTOMATION_RULE_MATCHED_EVENT,
        expect.objectContaining({ assignToUserId: "user-b" }),
      );
    });

    it("sums OPEN and IN_PROGRESS counts together for the same agent", async () => {
      mockTicket();
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        actionAssignToUserId: "user-fallback",
        actionAssignmentMode: "LEAST_LOADED",
        eligibleAgentPool: ["user-a", "user-b"],
        actionSetCategoryId: null,
        actionSetDepartmentId: null,
      });
      prisma.ticket.groupBy.mockResolvedValue([
        { assignedToUserId: "user-a", status: "OPEN", _count: { _all: 1 } },
        { assignedToUserId: "user-a", status: "IN_PROGRESS", _count: { _all: 1 } },
        { assignedToUserId: "user-b", status: "OPEN", _count: { _all: 1 } },
      ]);

      await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

      // user-a: 1 + 1 = 2, user-b: 1 — user-b wins.
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AUTOMATION_RULE_MATCHED_EVENT,
        expect.objectContaining({ assignToUserId: "user-b" }),
      );
    });

    it("treats a pool member with zero open tickets (no groupBy row at all) as a real, winning candidate", async () => {
      mockTicket();
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        actionAssignToUserId: "user-fallback",
        actionAssignmentMode: "LEAST_LOADED",
        eligibleAgentPool: ["user-a", "user-never-assigned"],
        actionSetCategoryId: null,
        actionSetDepartmentId: null,
      });
      prisma.ticket.groupBy.mockResolvedValue([
        { assignedToUserId: "user-a", status: "OPEN", _count: { _all: 2 } },
      ]);

      await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AUTOMATION_RULE_MATCHED_EVENT,
        expect.objectContaining({ assignToUserId: "user-never-assigned" }),
      );
    });

    it("breaks a tie by the pool's own configured order — the first member at the minimum count wins", async () => {
      mockTicket();
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        actionAssignToUserId: "user-fallback",
        actionAssignmentMode: "LEAST_LOADED",
        eligibleAgentPool: ["user-b", "user-a"], // note: user-b listed first
        actionSetCategoryId: null,
        actionSetDepartmentId: null,
      });
      prisma.ticket.groupBy.mockResolvedValue([
        { assignedToUserId: "user-a", status: "OPEN", _count: { _all: 2 } },
        { assignedToUserId: "user-b", status: "OPEN", _count: { _all: 2 } },
      ]);

      await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AUTOMATION_RULE_MATCHED_EVENT,
        expect.objectContaining({ assignToUserId: "user-b" }),
      );
    });

    it("falls back to actionAssignToUserId when eligibleAgentPool is empty, without querying groupBy", async () => {
      mockTicket();
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        actionAssignToUserId: "user-fallback",
        actionAssignmentMode: "LEAST_LOADED",
        eligibleAgentPool: [],
        actionSetCategoryId: null,
        actionSetDepartmentId: null,
      });

      await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

      expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AUTOMATION_RULE_MATCHED_EVENT,
        expect.objectContaining({ assignToUserId: "user-fallback" }),
      );
    });

    it("a FIXED rule never queries groupBy, even if eligibleAgentPool happens to be non-empty", async () => {
      mockTicket();
      prisma.automationRule.findFirst.mockResolvedValue({
        id: "rule-1",
        actionAssignToUserId: "user-fixed",
        actionAssignmentMode: "FIXED",
        eligibleAgentPool: ["user-a", "user-b"],
        actionSetCategoryId: null,
        actionSetDepartmentId: null,
      });

      await listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false });

      expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        AUTOMATION_RULE_MATCHED_EVENT,
        expect.objectContaining({ assignToUserId: "user-fixed" }),
      );
    });
  });

  it("catches and logs a Prisma failure without rethrowing", async () => {
    prisma.ticket.findUnique.mockRejectedValue(new Error("db unavailable"));

    await expect(listener.onTicketCreated({ ticket, actorUserId: null, priorityExplicit: false })).resolves.toBeUndefined();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
