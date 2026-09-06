import { beforeEach, describe, expect, it, vi } from "vitest";
import { TasksService } from "./tasks.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";
import type { TicketsService } from "../tickets/tickets.service";
import type { CustomersService } from "../customers/customers.service";

function buildPrismaMock() {
  return {
    task: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn(),
    },
  };
}

function buildTenantContextMock(userId: string | null = "user-1") {
  return { userId };
}

function buildTicketsServiceMock() {
  return { getTicket: vi.fn().mockResolvedValue({ id: "ticket-1" }) };
}

function buildCustomersServiceMock() {
  return { getCustomer: vi.fn().mockResolvedValue({ id: "customer-1" }) };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
  ticketsMock: ReturnType<typeof buildTicketsServiceMock>,
  customersMock: ReturnType<typeof buildCustomersServiceMock>,
): TasksService {
  return new TasksService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
    ticketsMock as unknown as TicketsService,
    customersMock as unknown as CustomersService,
  );
}

const taskRow = {
  id: "task-1",
  title: "Follow up with Acme Corp",
  notes: null,
  priority: "MEDIUM" as const,
  ticketId: null,
  customerId: null,
  dueAt: null,
  completedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("TasksService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let tickets: ReturnType<typeof buildTicketsServiceMock>;
  let customers: ReturnType<typeof buildCustomersServiceMock>;
  let service: TasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    tickets = buildTicketsServiceMock();
    customers = buildCustomersServiceMock();
    service = createService(prisma, tenantContext, tickets, customers);
    prisma.task.create.mockResolvedValue(taskRow);
  });

  describe("createTask", () => {
    it("creates a task owned by the caller's own user id", async () => {
      const result = await service.createTask({ title: "Follow up with Acme Corp" });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          ownerUserId: "user-1",
          title: "Follow up with Acme Corp",
          notes: null,
          ticketId: null,
          customerId: null,
          dueAt: null,
        },
      });
      expect(result).toEqual({
        id: "task-1",
        title: "Follow up with Acme Corp",
        notes: null,
        priority: "MEDIUM",
        ticketId: null,
        customerId: null,
        dueAt: null,
        completedAt: null,
        createdAt: taskRow.createdAt,
        updatedAt: taskRow.updatedAt,
      });
    });

    it("validates a provided ticketId is in scope via TicketsService.getTicket", async () => {
      await service.createTask({ title: "Check on ticket", ticketId: "ticket-1" });

      expect(tickets.getTicket).toHaveBeenCalledWith("ticket-1");
    });

    it("propagates NotFoundException when the ticket is out of scope", async () => {
      const notFound = new Error("Ticket not found");
      tickets.getTicket.mockRejectedValue(notFound);

      await expect(
        service.createTask({ title: "Check on ticket", ticketId: "unknown" }),
      ).rejects.toThrow(notFound);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it("validates a provided customerId is in scope via CustomersService.getCustomer", async () => {
      await service.createTask({ title: "Follow up", customerId: "customer-1" });

      expect(customers.getCustomer).toHaveBeenCalledWith("customer-1");
    });

    it("propagates NotFoundException when the customer is out of scope", async () => {
      const notFound = new Error("Customer not found");
      customers.getCustomer.mockRejectedValue(notFound);

      await expect(
        service.createTask({ title: "Follow up", customerId: "unknown" }),
      ).rejects.toThrow(notFound);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it("parses dueAt into a real Date", async () => {
      await service.createTask({ title: "Reminder", dueAt: "2026-06-01T12:00:00.000Z" });

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ dueAt: new Date("2026-06-01T12:00:00.000Z") }) }),
      );
    });

    it("passes an explicit priority through when provided", async () => {
      await service.createTask({ title: "Urgent thing", priority: "URGENT" });

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ priority: "URGENT" }) }),
      );
    });

    it("throws when there is no active user on the request", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext, tickets, customers);

      await expect(service.createTask({ title: "x" })).rejects.toThrow(/no active user/);
    });
  });

  describe("listTasks", () => {
    it("scopes the list to the caller's own ownerUserId, never a caller-supplied one", async () => {
      await service.listTasks();

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerUserId: "user-1" } }),
      );
    });

    it("filters completed:true to completedAt not null", async () => {
      await service.listTasks({ completed: "true" });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerUserId: "user-1", completedAt: { not: null } },
        }),
      );
    });

    it("filters completed:false to completedAt null", async () => {
      await service.listTasks({ completed: "false" });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerUserId: "user-1", completedAt: null },
        }),
      );
    });

    it("filters by ticketId when provided", async () => {
      await service.listTasks({ ticketId: "ticket-1" });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerUserId: "user-1", ticketId: "ticket-1" },
        }),
      );
    });

    it("orders soonest-due first, then oldest-created, then id as a tiebreaker", async () => {
      await service.listTasks();

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        }),
      );
    });
  });

  describe("updateTask", () => {
    beforeEach(() => {
      prisma.task.findFirst.mockResolvedValue({ id: "task-1" });
    });

    it("scopes the lookup to the caller's own ownerUserId and 404s otherwise", async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.updateTask("task-1", { title: "x" })).rejects.toThrow("Task not found");
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it("updates only the provided fields", async () => {
      await service.updateTask("task-1", { title: "New title" });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { title: "New title" },
      });
    });

    it("validates a changed ticketId is in scope", async () => {
      await service.updateTask("task-1", { ticketId: "ticket-1" });

      expect(tickets.getTicket).toHaveBeenCalledWith("ticket-1");
    });

    it("clears ticketId when explicitly set to null, without validating", async () => {
      await service.updateTask("task-1", { ticketId: null });

      expect(tickets.getTicket).not.toHaveBeenCalled();
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { ticketId: null },
      });
    });

    it("validates a changed customerId is in scope", async () => {
      await service.updateTask("task-1", { customerId: "customer-1" });

      expect(customers.getCustomer).toHaveBeenCalledWith("customer-1");
    });

    it("resets reminderSentAt when dueAt changes", async () => {
      await service.updateTask("task-1", { dueAt: "2026-06-01T12:00:00.000Z" });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { dueAt: new Date("2026-06-01T12:00:00.000Z"), reminderSentAt: null },
      });
    });

    it("clears dueAt (and resets reminderSentAt) when dueAt is explicitly set to null", async () => {
      await service.updateTask("task-1", { dueAt: null });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { dueAt: null, reminderSentAt: null },
      });
    });

    it("sets completedAt to now when completed:true", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-05T00:00:00.000Z"));

      await service.updateTask("task-1", { completed: true });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { completedAt: new Date("2026-01-05T00:00:00.000Z") },
      });
      vi.useRealTimers();
    });

    it("clears completedAt when completed:false (reopen)", async () => {
      await service.updateTask("task-1", { completed: false });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { completedAt: null },
      });
    });
  });

  describe("deleteTask", () => {
    it("scopes the lookup to the caller's own ownerUserId and 404s otherwise", async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.deleteTask("task-1")).rejects.toThrow("Task not found");
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it("deletes the task once ownership is confirmed", async () => {
      prisma.task.findFirst.mockResolvedValue({ id: "task-1" });

      const result = await service.deleteTask("task-1");

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: "task-1" } });
      expect(result).toEqual({ id: "task-1" });
    });
  });
});
