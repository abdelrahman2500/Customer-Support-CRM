import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { TicketsService } from "./tickets.service";
import { TICKET_CREATED_EVENT, TICKET_UPDATED_EVENT, TICKET_RECATEGORIZED_EVENT } from "./tickets.events";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    ticket: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    ticketHistoryEntry: {
      findMany: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
    },
    userBranchRole: {
      findFirst: vi.fn(),
    },
  };
}

function buildTenantContextMock(branchId: string | null = "branch-1", userId: string | null = "user-1") {
  return {
    userId,
    requireBranchScope: vi.fn(() => {
      if (!branchId) {
        throw new Error("TenantContext: no active branch on this request");
      }
      return { branchId };
    }),
  };
}

function buildEventEmitterMock() {
  return { emit: vi.fn() };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
  eventEmitterMock: ReturnType<typeof buildEventEmitterMock>,
): TicketsService {
  return new TicketsService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
    eventEmitterMock as unknown as EventEmitter2,
  );
}

describe("TicketsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let eventEmitter: ReturnType<typeof buildEventEmitterMock>;
  let service: TicketsService;

  const baseDto = { customerId: "customer-1", subject: "Cannot log in" };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    eventEmitter = buildEventEmitterMock();
    service = createService(prisma, tenantContext, eventEmitter);
  });

  describe("createTicket", () => {
    it("throws NotFoundException when the customer isn't in the caller's branch", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.createTicket(baseDto)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: "customer-1", branchId: "branch-1" },
      });
      expect(prisma.ticket.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the contact doesn't belong to the given customer", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.createTicket({ ...baseDto, contactId: "contact-from-elsewhere" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: { id: "contact-from-elsewhere", customerId: "customer-1" },
      });
      expect(prisma.ticket.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the department isn't in the caller's branch", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.createTicket({ ...baseDto, departmentId: "dept-from-elsewhere" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.department.findFirst).toHaveBeenCalledWith({
        where: { id: "dept-from-elsewhere", branchId: "branch-1" },
      });
      expect(prisma.ticket.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when assignedToUserId has no role in the caller's branch", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.userBranchRole.findFirst.mockResolvedValue(null);

      await expect(
        service.createTicket({ ...baseDto, assignedToUserId: "user-from-elsewhere" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.userBranchRole.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-from-elsewhere", branchId: "branch-1" },
      });
      expect(prisma.ticket.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("creates the ticket with all cross-domain checks passing, defaulting nullable fields", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.contact.findFirst.mockResolvedValue({ id: "contact-1" });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1" });
      prisma.userBranchRole.findFirst.mockResolvedValue({ id: "ubr-1" });
      prisma.ticket.create.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: "contact-1",
        departmentId: "dept-1",
        assignedToUserId: "user-1",
      });

      const result = await service.createTicket({
        ...baseDto,
        contactId: "contact-1",
        departmentId: "dept-1",
        assignedToUserId: "user-1",
      });

      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          customerId: "customer-1",
          contactId: "contact-1",
          departmentId: "dept-1",
          assignedToUserId: "user-1",
          subject: "Cannot log in",
          category: null,
        },
      });
      expect(result.status).toBe("OPEN");
      expect(result.priority).toBe("MEDIUM");
      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_CREATED_EVENT, {
        ticket: result,
        actorUserId: "user-1",
      });
    });

    it("omits contactId/departmentId/assignedToUserId checks entirely when not provided", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.ticket.create.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.createTicket(baseDto);

      expect(prisma.contact.findFirst).not.toHaveBeenCalled();
      expect(prisma.department.findFirst).not.toHaveBeenCalled();
      expect(prisma.userBranchRole.findFirst).not.toHaveBeenCalled();
      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          customerId: "customer-1",
          contactId: null,
          departmentId: null,
          assignedToUserId: null,
          subject: "Cannot log in",
          category: null,
        },
      });
    });

    it("passes an explicit priority through instead of relying on the schema default", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.ticket.create.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: null,
        priority: "URGENT",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.createTicket({ ...baseDto, priority: "URGENT" as never });

      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ priority: "URGENT" }) }),
      );
    });
  });

  describe("listTickets", () => {
    it("scopes the query to the caller's active branch", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
      );
    });
  });

  describe("getTicket", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getTicket("missing-id")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: "missing-id", branchId: "branch-1" },
      });
    });
  });

  describe("updateTicket", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTicket("missing-id", { status: "CLOSED" as never }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when reassigning to a user outside the caller's branch", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.userBranchRole.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTicket("ticket-1", { assignedToUserId: "user-from-elsewhere" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.userBranchRole.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-from-elsewhere", branchId: "branch-1" },
      });
      expect(prisma.ticket.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when moving to a department outside the caller's branch, before updating or emitting", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1", category: null, priority: "MEDIUM", departmentId: null });
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTicket("ticket-1", { departmentId: "dept-from-elsewhere" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.department.findFirst).toHaveBeenCalledWith({
        where: { id: "dept-from-elsewhere", branchId: "branch-1" },
      });
      expect(prisma.ticket.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("only includes fields present in the DTO", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: null,
        priority: "MEDIUM",
        status: "IN_PROGRESS",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", { status: "IN_PROGRESS" as never });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: { status: "IN_PROGRESS" },
      });
      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_UPDATED_EVENT, {
        ticket: expect.objectContaining({ id: "ticket-1", status: "IN_PROGRESS" }),
        actorUserId: "user-1",
      });
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        TICKET_RECATEGORIZED_EVENT,
        expect.anything(),
      );
    });

    it("does not emit ticket.recategorized when only subject changes", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        category: "billing",
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "New subject",
        category: "billing",
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", { subject: "New subject" });

      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        TICKET_RECATEGORIZED_EVENT,
        expect.anything(),
      );
    });

    it("does not emit ticket.recategorized when the DTO resends the ticket's current category", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        category: "billing",
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: "billing",
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", { category: "billing" });

      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        TICKET_RECATEGORIZED_EVENT,
        expect.anything(),
      );
    });

    it("emits ticket.recategorized when category changes", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        category: "billing",
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: "technical",
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", { category: "technical" });

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_UPDATED_EVENT, {
        ticket: expect.objectContaining({ id: "ticket-1", category: "technical" }),
        actorUserId: "user-1",
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_RECATEGORIZED_EVENT, {
        ticket: expect.objectContaining({ id: "ticket-1", category: "technical" }),
        actorUserId: "user-1",
      });
    });

    it("emits ticket.recategorized when priority changes", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        category: null,
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: null,
        priority: "URGENT",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", { priority: "URGENT" as never });

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        TICKET_RECATEGORIZED_EVENT,
        expect.objectContaining({ ticket: expect.objectContaining({ priority: "URGENT" }) }),
      );
    });

    it("emits ticket.recategorized when departmentId changes", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        category: null,
        priority: "MEDIUM",
        departmentId: "dept-old",
      });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-new" });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: "dept-new",
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", { departmentId: "dept-new" });

      expect(prisma.department.findFirst).toHaveBeenCalledWith({
        where: { id: "dept-new", branchId: "branch-1" },
      });
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        TICKET_RECATEGORIZED_EVENT,
        expect.objectContaining({ ticket: expect.objectContaining({ departmentId: "dept-new" }) }),
      );
    });

    it("emits ticket.recategorized exactly once when category and priority both change in the same update", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        category: "billing",
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: "technical",
        priority: "URGENT",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", { category: "technical", priority: "URGENT" as never });

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      const recategorizedCalls = eventEmitter.emit.mock.calls.filter(
        ([eventName]) => eventName === TICKET_RECATEGORIZED_EVENT,
      );
      expect(recategorizedCalls).toHaveLength(1);
    });

    it("reassigns successfully once the user is confirmed in scope", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.userBranchRole.findFirst.mockResolvedValue({ id: "ubr-1" });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        category: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: "user-1",
      });

      await service.updateTicket("ticket-1", { assignedToUserId: "user-1" });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: { assignedToUserId: "user-1" },
      });
      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_UPDATED_EVENT, {
        ticket: expect.objectContaining({ id: "ticket-1", assignedToUserId: "user-1" }),
        actorUserId: "user-1",
      });
    });
  });

  describe("getTicketHistory", () => {
    it("throws NotFoundException for an unknown/out-of-scope ticket id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getTicketHistory("missing-id")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.ticketHistoryEntry.findMany).not.toHaveBeenCalled();
    });

    it("scopes and orders history entries once the ticket is confirmed in scope", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketHistoryEntry.findMany.mockResolvedValue([
        {
          id: "history-1",
          eventType: TICKET_CREATED_EVENT,
          actorUserId: "user-1",
          snapshot: { id: "ticket-1" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);

      const result = await service.getTicketHistory("ticket-1");

      expect(prisma.ticketHistoryEntry.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual([
        {
          id: "history-1",
          eventType: TICKET_CREATED_EVENT,
          actorUserId: "user-1",
          snapshot: { id: "ticket-1" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
    });
  });
});
