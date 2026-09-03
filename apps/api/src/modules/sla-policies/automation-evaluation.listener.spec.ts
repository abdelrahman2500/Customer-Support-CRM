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

    await listener.onTicketCreated({ ticket, actorUserId: null });

    expect(prisma.automationRule.findFirst).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("never overrides an explicit assignment", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      branchId: "branch-1",
      categoryId: "category-1",
      assignedToUserId: "user-explicit",
    });

    await listener.onTicketCreated({ ticket, actorUserId: null });

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

    await listener.onTicketCreated({ ticket, actorUserId: null });

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("queries with a category-or-wildcard filter, scoped by branch and isActive", async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      branchId: "branch-1",
      categoryId: "category-1",
      assignedToUserId: null,
    });
    prisma.automationRule.findFirst.mockResolvedValue(null);

    await listener.onTicketCreated({ ticket, actorUserId: null });

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
        actionSetCategoryId: true,
        actionSetDepartmentId: true,
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
    });

    await listener.onTicketCreated({ ticket, actorUserId: null });

    expect(eventEmitter.emit).toHaveBeenCalledWith(AUTOMATION_RULE_MATCHED_EVENT, {
      ticketId: "ticket-1",
      ruleId: "rule-1",
      assignToUserId: "user-1",
      setCategoryId: null,
      setDepartmentId: null,
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

    await listener.onTicketCreated({ ticket, actorUserId: null });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      AUTOMATION_RULE_MATCHED_EVENT,
      expect.objectContaining({ setCategoryId: "category-1", setDepartmentId: "dept-1" }),
    );
  });

  it("catches and logs a Prisma failure without rethrowing", async () => {
    prisma.ticket.findUnique.mockRejectedValue(new Error("db unavailable"));

    await expect(listener.onTicketCreated({ ticket, actorUserId: null })).resolves.toBeUndefined();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
