import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { TicketsService } from "./tickets.service";
import type { TicketListItem } from "./tickets.service";
import {
  TICKET_CREATED_EVENT,
  TICKET_UPDATED_EVENT,
  TICKET_RECATEGORIZED_EVENT,
  TICKET_NOTE_ADDED_EVENT,
} from "./tickets.events";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    ticket: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      // Story S-8e — `paginate` issues this alongside `findMany`, so it
      // needs a default; the pagination tests below override it.
      count: vi.fn().mockResolvedValue(0),
    },
    ticketHistoryEntry: {
      findMany: vi.fn(),
    },
    ticketNote: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    ticketCsatResponse: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
    },
    // Defaults to a truthy match so every pre-existing test that passes a
    // `categoryId` through `updateTicket`/`createTicket` without itself
    // caring about category-scope validation continues to exercise the
    // exact same downstream behavior it always has.
    ticketCategory: {
      findFirst: vi.fn().mockResolvedValue({ id: "category-1" }),
    },
    userBranchRole: {
      findFirst: vi.fn(),
    },
    // Story 68 — Ticket Department-Scoped Visibility.
    role: {
      findMany: vi.fn(),
    },
  };
}

/** Story 68 — `roles` defaults to `[]`, so `resolveDepartmentVisibilityFilter`
 * short-circuits to `{}` (today's exact, unchanged behavior) for every
 * pre-existing test that doesn't explicitly opt into department scoping. */
function buildTenantContextMock(
  branchId: string | null = "branch-1",
  userId: string | null = "user-1",
  roles: string[] = [],
  departmentId: string | null = null,
) {
  return {
    userId,
    roles,
    departmentId,
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
        categoryId: null,
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
          categoryId: null,
        },
        include: {
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
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
        categoryId: null,
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
          categoryId: null,
        },
        include: {
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
      });
    });

    it("passes an explicit priority through instead of relying on the schema default", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.ticket.create.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: null,
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
    const baseTicketRow = {
      id: "ticket-1",
      subject: "Cannot log in",
      categoryId: "category-1",
      category: { name: "billing" },
      priority: "MEDIUM" as const,
      status: "OPEN" as const,
      customerId: "customer-1",
      contactId: null,
      departmentId: null,
      assignedToUserId: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      slaTarget: null,
    };

    it("scopes the query to the caller's active branch and defaults to createdAt desc, with no filters", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      // Story S-8e — the requested direction is the direction queried
      // (Story 105 had to query `desc` and reverse), `id` breaks ties, and
      // `take` is the page size rather than a fixed cap.
      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          slaTarget: true,
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
        skip: 0,
        take: 25,
      });
    });

    // Story S-8e — pagination replaces Story 105's Bounded Result Cap.
    it("no longer caps the query at a fixed row count", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ status: "OPEN" });

      // Story 105's unconditional `take: 500` put every older ticket out
      // of reach entirely; `take` is now one page and `skip` reaches the
      // rest.
      const args = prisma.ticket.findMany.mock.calls[0]![0];
      expect(args.take).toBe(25);
      expect(args.skip).toBe(0);
    });

    it("queries the requested direction directly instead of reversing in memory", async () => {
      const older = {
        ...baseTicketRow,
        id: "ticket-older",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      };
      const newer = {
        ...baseTicketRow,
        id: "ticket-newer",
        createdAt: new Date("2024-01-05T00:00:00.000Z"),
      };
      // Prisma, asked for `desc`, returns newest-first - and that is now
      // what the default asks for, so the rows pass straight through. Story
      // 105 asked for `desc` and reversed, which only matched a direct
      // `asc` query while the branch stayed under the cap.
      prisma.ticket.findMany.mockResolvedValue([newer, older]);

      const result = await service.listTickets();

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      );
      expect(result.items.map((t: TicketListItem) => t.id)).toEqual([
        "ticket-newer",
        "ticket-older",
      ]);
    });

    it("uses the id desc tie-breaker when createdAt values are equal", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets();

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      );
    });

    it("preserves explicit ascending sorting", async () => {
      const older = {
        ...baseTicketRow,
        id: "ticket-older",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      };
      const newer = {
        ...baseTicketRow,
        id: "ticket-newer",
        createdAt: new Date("2024-01-05T00:00:00.000Z"),
      };
      prisma.ticket.findMany.mockResolvedValue([older, newer]);

      const result = await service.listTickets({ sortDir: "asc" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      );
      expect(result.items.map((t: TicketListItem) => t.id)).toEqual([
        "ticket-older",
        "ticket-newer",
      ]);
    });

    it("preserves explicit descending sorting", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ sortDir: "desc" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      );
    });

    it("applies status/priority/categoryId/assignedToUserId filters independently and in combination", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({
        status: "OPEN",
        priority: "URGENT" as never,
        categoryId: "category-1",
        assignedToUserId: "user-1",
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            branchId: "branch-1",
            status: "OPEN",
            priority: "URGENT",
            categoryId: "category-1",
            assignedToUserId: "user-1",
          },
        }),
      );
    });

    it("sorts by the requested field and direction", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ sortBy: "updatedAt", sortDir: "desc" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }),
      );
    });

    it("maps createdAt/updatedAt and a null slaTarget through to the response", async () => {
      prisma.ticket.findMany.mockResolvedValue([baseTicketRow]);

      const result = await service.listTickets();

      expect(result.items).toEqual([
        {
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
          createdAt: baseTicketRow.createdAt,
          updatedAt: baseTicketRow.updatedAt,
          slaTarget: null,
        },
      ]);
    });

    it("maps a present slaTarget relation into the response's slaTarget field", async () => {
      const slaTarget = {
        id: "target-1",
        slaPolicyId: "policy-1",
        responseTargetAt: new Date("2024-01-03T00:00:00.000Z"),
        resolutionTargetAt: new Date("2024-01-04T00:00:00.000Z"),
      };
      prisma.ticket.findMany.mockResolvedValue([{ ...baseTicketRow, slaTarget }]);

      const result = await service.listTickets();

      expect(result.items[0]?.slaTarget).toEqual(slaTarget);
    });

    // Story 70 — Ticket Search Foundation.
    describe("search", () => {
      it("adds a subject/category OR clause when search is given", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);

        await service.listTickets({ search: "login" });

        expect(prisma.ticket.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              branchId: "branch-1",
              OR: [
                { subject: { contains: "login", mode: "insensitive" } },
                { category: { name: { contains: "login", mode: "insensitive" } } },
              ],
            },
          }),
        );
      });

      it("behaves identically to the no-arg call when search is an empty string", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);

        await service.listTickets({ search: "" });

        expect(prisma.ticket.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { branchId: "branch-1" } }),
        );
      });

      it("composes with existing equality filters (status/priority/category/assignedToUserId)", async () => {
        prisma.ticket.findMany.mockResolvedValue([]);

        await service.listTickets({ search: "login", status: "OPEN", assignedToUserId: "user-1" });

        expect(prisma.ticket.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              branchId: "branch-1",
              OR: [
                { subject: { contains: "login", mode: "insensitive" } },
                { category: { name: { contains: "login", mode: "insensitive" } } },
              ],
              status: "OPEN",
              assignedToUserId: "user-1",
            },
          }),
        );
      });

      it("ANDs the search filter with the department-visibility filter rather than letting either OR clobber the other", async () => {
        tenantContext.roles = ["DeptOnly"];
        tenantContext.departmentId = "dept-1";
        prisma.role.findMany.mockResolvedValue([{ ticketVisibilityScope: "DEPARTMENT" }]);
        prisma.ticket.findMany.mockResolvedValue([]);

        await service.listTickets({ search: "login" });

        expect(prisma.ticket.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              branchId: "branch-1",
              AND: [
                { OR: [{ departmentId: "dept-1" }, { departmentId: null }] },
                {
                  OR: [
                    { subject: { contains: "login", mode: "insensitive" } },
                    { category: { name: { contains: "login", mode: "insensitive" } } },
                  ],
                },
              ],
            },
          }),
        );
      });

      it("uses only the department-visibility OR clause (unchanged Story 68 shape) when search is absent", async () => {
        tenantContext.roles = ["DeptOnly"];
        tenantContext.departmentId = "dept-1";
        prisma.role.findMany.mockResolvedValue([{ ticketVisibilityScope: "DEPARTMENT" }]);
        prisma.ticket.findMany.mockResolvedValue([]);

        await service.listTickets();

        expect(prisma.ticket.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              branchId: "branch-1",
              OR: [{ departmentId: "dept-1" }, { departmentId: null }],
            },
          }),
        );
      });
    });
  });

  describe("getTicket", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getTicket("missing-id")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: "missing-id", branchId: "branch-1" },
        include: {
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
      });
    });
  });

  // Story S-8d — filters that let the dashboard and customer-detail screens
  // ask the server the question they used to answer client-side.
  describe("listTickets slaUrgency ordering (Story S-9)", () => {
    it("orders through the slaTarget relation, with createdAt breaking ties", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ sortBy: "slaUrgency", sortDir: "asc" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { slaTarget: { responseTargetAt: "asc" } },
            { createdAt: "asc" },
            { id: "asc" },
          ],
        }),
      );
    });

    it("does not emit a rank/breached term: the target order already implies it", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ sortBy: "slaUrgency" });

      // A breached ticket's target is in the past and an on-track one's is
      // in the future, so ascending target order puts breached first with
      // no extra term - which is also why this ordering needs no `now`.
      const args = prisma.ticket.findMany.mock.calls[0]![0];
      expect(JSON.stringify(args.orderBy)).not.toContain("breach");
      expect(args.orderBy).toHaveLength(3);
    });

    it("honours sortDir on the relation sort", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ sortBy: "slaUrgency", sortDir: "desc" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { slaTarget: { responseTargetAt: "desc" } },
            { createdAt: "desc" },
            { id: "desc" },
          ],
        }),
      );
    });

    it("leaves the scalar sorts untouched", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ sortBy: "updatedAt", sortDir: "desc" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }),
      );
    });
  });

  describe("listTickets statuses filter (Story S-9)", () => {
    it("matches any of the given statuses", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ statuses: ["OPEN", "IN_PROGRESS"] });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: "branch-1", status: { in: ["OPEN", "IN_PROGRESS"] } },
        }),
      );
    });

    it("counts over the same status predicate it fetches with", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.listTickets({ statuses: ["OPEN"] });

      expect(prisma.ticket.count).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: { in: ["OPEN"] } },
      });
    });

    it("rejects status and statuses together rather than letting one clobber the other", async () => {
      // Both constrain the same column, so spreading them into one `where`
      // would silently drop whichever came first.
      await expect(
        service.listTickets({ status: "OPEN", statuses: ["IN_PROGRESS"] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    });

    it("composes with the unassigned filter and the urgency sort", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({
        unassigned: "true",
        statuses: ["OPEN", "IN_PROGRESS"],
        sortBy: "slaUrgency",
        sortDir: "asc",
      });

      // Exactly the request the dashboard's unclaimed panel makes.
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            branchId: "branch-1",
            assignedToUserId: null,
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
          orderBy: [
            { slaTarget: { responseTargetAt: "asc" } },
            { createdAt: "asc" },
            { id: "asc" },
          ],
        }),
      );
    });
  });
  describe("listTickets pagination (Story S-8e)", () => {
    it("translates a page number into the right offset", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ page: 4, pageSize: 10 });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 30, take: 10 }),
      );
    });

    it("counts over exactly the same where clause it fetches with", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.listTickets({ status: "OPEN", customerId: "customer-7" });

      // A `total` counted over a wider predicate than `items` would
      // report rows the caller cannot reach - here, tickets outside the
      // branch scope or the requested customer.
      const where = { branchId: "branch-1", status: "OPEN", customerId: "customer-7" };
      expect(prisma.ticket.count).toHaveBeenCalledWith({ where });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    });

    it("counts over the department-scoped predicate too, not just the branch", async () => {
      tenantContext.roles = ["DeptOnly"];
      tenantContext.departmentId = "dept-1";
      prisma.role.findMany.mockResolvedValue([{ ticketVisibilityScope: "DEPARTMENT" }]);
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.listTickets();

      // The authorization arm is the one that matters most here: a total
      // counted without it would tell a department-scoped agent how many
      // tickets exist outside their department.
      expect(prisma.ticket.count).toHaveBeenCalledWith({
        where: {
          branchId: "branch-1",
          OR: [{ departmentId: "dept-1" }, { departmentId: null }],
        },
      });
    });

    it("reports the total and page count from the count query", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(101);

      const result = await service.listTickets({ pageSize: 25 });

      expect(result.total).toBe(101);
      expect(result.totalPages).toBe(5);
    });

    it("returns an empty page past the end without losing the metadata", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(3);

      const result = await service.listTickets({ page: 50 });

      expect(result).toEqual({ items: [], total: 3, page: 50, pageSize: 25, totalPages: 1 });
    });

    it("still includes the sla/category/customer relations on a paged fetch", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ page: 2 });

      // The delegate is wrapped to add this `include`, so a paging change
      // is exactly where it could go missing.
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            slaTarget: true,
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        }),
      );
    });
  });
  describe("listTickets filters (Story S-8d)", () => {
    it("narrows to one customer's tickets when customerId is given", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ customerId: "customer-7" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: "branch-1", customerId: "customer-7" },
        }),
      );
    });

    it("narrows to unclaimed tickets when unassigned=true", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ unassigned: "true" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: "branch-1", assignedToUserId: null },
        }),
      );
    });

    it("narrows to claimed tickets when unassigned=false", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ unassigned: "false" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: "branch-1", assignedToUserId: { not: null } },
        }),
      );
    });

    it("omits both filters entirely when neither is supplied", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({});

      // Absent must mean "no constraint", not "match null" — otherwise the
      // plain ticket list would silently show only unassigned tickets.
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
      );
    });

    it("composes customerId with the existing status filter rather than replacing it", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ customerId: "customer-7", status: "OPEN" });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: "branch-1", status: "OPEN", customerId: "customer-7" },
        }),
      );
    });

    it("composes unassigned with department scoping instead of overriding it", async () => {
      tenantContext.roles = ["DeptOnly"];
      tenantContext.departmentId = "dept-1";
      prisma.role.findMany.mockResolvedValue([{ ticketVisibilityScope: "DEPARTMENT" }]);
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets({ unassigned: "true" });

      // A department-scoped agent asking for unclaimed work must not thereby
      // see unclaimed work outside their own department.
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            branchId: "branch-1",
            assignedToUserId: null,
            OR: [{ departmentId: "dept-1" }, { departmentId: null }],
          },
        }),
      );
    });

    it("returns the customer's display name on each summary", async () => {
      prisma.ticket.findMany.mockResolvedValue([
        {
          id: "ticket-1",
          branchId: "branch-1",
          customerId: "customer-7",
          subject: "Cannot log in",
          status: "OPEN",
          priority: "MEDIUM",
          categoryId: null,
          category: null,
          customer: { displayName: "Acme Corp" },
          departmentId: null,
          assignedToUserId: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);

      const result = await service.listTickets({});

      expect(result.items[0]!.customerName).toBe("Acme Corp");
    });
  });

  // Story 68 — Ticket Department-Scoped Visibility.
  describe("department-scoped visibility", () => {
    it("listTickets: adds no extra filter when the caller holds no roles (today's exact behavior)", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets();

      expect(prisma.role.findMany).not.toHaveBeenCalled();
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
      );
    });

    it("listTickets: adds no extra filter when any held role is BRANCH-scoped (most-permissive-wins)", async () => {
      tenantContext.roles = ["Agent", "DeptOnly"];
      prisma.role.findMany.mockResolvedValue([
        { ticketVisibilityScope: "BRANCH" },
        { ticketVisibilityScope: "DEPARTMENT" },
      ]);
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets();

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
      );
    });

    it("listTickets: filters to the caller's department plus unassigned tickets when every held role is DEPARTMENT-scoped", async () => {
      tenantContext.roles = ["DeptOnly"];
      tenantContext.departmentId = "dept-1";
      prisma.role.findMany.mockResolvedValue([{ ticketVisibilityScope: "DEPARTMENT" }]);
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets();

      expect(prisma.role.findMany).toHaveBeenCalledWith({
        where: { name: { in: ["DeptOnly"] } },
        select: { ticketVisibilityScope: true },
      });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            branchId: "branch-1",
            OR: [{ departmentId: "dept-1" }, { departmentId: null }],
          },
        }),
      );
    });

    it("getTicket: 404s for a DEPARTMENT-scoped caller requesting a ticket outside their department", async () => {
      tenantContext.roles = ["DeptOnly"];
      tenantContext.departmentId = "dept-1";
      prisma.role.findMany.mockResolvedValue([{ ticketVisibilityScope: "DEPARTMENT" }]);
      prisma.ticket.findFirst.mockResolvedValue(null); // the real DB query itself excludes it.

      await expect(service.getTicket("ticket-in-other-dept")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: {
          id: "ticket-in-other-dept",
          branchId: "branch-1",
          OR: [{ departmentId: "dept-1" }, { departmentId: null }],
        },
        include: {
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
      });
    });

    it("getTicket: succeeds for a DEPARTMENT-scoped caller requesting their own department's ticket", async () => {
      tenantContext.roles = ["DeptOnly"];
      tenantContext.departmentId = "dept-1";
      prisma.role.findMany.mockResolvedValue([{ ticketVisibilityScope: "DEPARTMENT" }]);
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: "dept-1",
        assignedToUserId: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      });

      const result = await service.getTicket("ticket-1");

      expect(result.id).toBe("ticket-1");
    });

    it("resolves to no extra filter (fails safe) when the role-name lookup returns nothing", async () => {
      tenantContext.roles = ["RenamedOrDeletedRole"];
      prisma.role.findMany.mockResolvedValue([]);
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTickets();

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
      );
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
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        categoryId: null,
        priority: "MEDIUM",
        departmentId: null,
      });
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

    // Story 69 — the "assignment" half of the same disclosed doc sentence
    // Story 68 closed the "visibility" half of.
    it("rejects a DEPARTMENT-scoped caller reassigning a ticket to a different department", async () => {
      tenantContext.roles = ["DeptOnly"];
      tenantContext.departmentId = "dept-1";
      prisma.role.findMany.mockResolvedValue([{ ticketVisibilityScope: "DEPARTMENT" }]);
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        categoryId: null,
        priority: "MEDIUM",
        departmentId: "dept-1",
      });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-2", branchId: "branch-1" });

      await expect(
        service.updateTicket("ticket-1", { departmentId: "dept-2" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("allows a DEPARTMENT-scoped caller reassigning a ticket to their own department", async () => {
      tenantContext.roles = ["DeptOnly"];
      tenantContext.departmentId = "dept-1";
      prisma.role.findMany.mockResolvedValue([{ ticketVisibilityScope: "DEPARTMENT" }]);
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        categoryId: null,
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-1", branchId: "branch-1" });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: "dept-1",
        assignedToUserId: null,
      });

      await expect(service.updateTicket("ticket-1", { departmentId: "dept-1" })).resolves.toEqual({
        id: "ticket-1",
      });
      expect(prisma.ticket.update).toHaveBeenCalledOnce();
    });

    it("allows a BRANCH-scoped caller (unchanged, pre-Story-69 behavior) to reassign to any department", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        categoryId: null,
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-2", branchId: "branch-1" });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: "dept-2",
        assignedToUserId: null,
      });

      await expect(service.updateTicket("ticket-1", { departmentId: "dept-2" })).resolves.toEqual({
        id: "ticket-1",
      });
      expect(prisma.role.findMany).not.toHaveBeenCalled();
    });

    it("only includes fields present in the DTO", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: null,
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
        include: {
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
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
        categoryId: "billing",
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "New subject",
        categoryId: "billing",
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
        categoryId: "billing",
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: "billing",
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", { categoryId: "billing" });

      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        TICKET_RECATEGORIZED_EVENT,
        expect.anything(),
      );
    });

    it("emits ticket.recategorized when category changes", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        categoryId: "billing",
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: "technical",
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", { categoryId: "technical" });

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_UPDATED_EVENT, {
        ticket: expect.objectContaining({ id: "ticket-1", categoryId: "technical" }),
        actorUserId: "user-1",
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_RECATEGORIZED_EVENT, {
        ticket: expect.objectContaining({ id: "ticket-1", categoryId: "technical" }),
        actorUserId: "user-1",
      });
    });

    it("emits ticket.recategorized when priority changes", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        categoryId: null,
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: null,
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
        categoryId: null,
        priority: "MEDIUM",
        departmentId: "dept-old",
      });
      prisma.department.findFirst.mockResolvedValue({ id: "dept-new" });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: null,
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
        categoryId: "billing",
        priority: "MEDIUM",
        departmentId: null,
      });
      prisma.ticket.update.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: "technical",
        priority: "URGENT",
        status: "OPEN",
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      });

      await service.updateTicket("ticket-1", {
        categoryId: "technical",
        priority: "URGENT" as never,
      });

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
        categoryId: null,
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
        include: {
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_UPDATED_EVENT, {
        ticket: expect.objectContaining({ id: "ticket-1", assignedToUserId: "user-1" }),
        actorUserId: "user-1",
      });
    });

    // Story 99 — Ticket.resolvedAt transitions.
    describe("resolvedAt transitions (Story 99)", () => {
      const NOW = new Date("2026-01-08T12:00:00.000Z");

      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it("sets resolvedAt to now when transitioning from OPEN to RESOLVED", async () => {
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "OPEN",
        });
        prisma.ticket.update.mockResolvedValue({
          id: "ticket-1",
          subject: "Cannot log in",
          categoryId: null,
          priority: "MEDIUM",
          status: "RESOLVED",
          customerId: "customer-1",
          contactId: null,
          departmentId: null,
          assignedToUserId: null,
        });

        await service.updateTicket("ticket-1", { status: "RESOLVED" as never });

        expect(prisma.ticket.update).toHaveBeenCalledWith({
          where: { id: "ticket-1" },
          data: { status: "RESOLVED", resolvedAt: NOW },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });
      });

      it("sets resolvedAt to now when transitioning from IN_PROGRESS to CLOSED", async () => {
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "IN_PROGRESS",
        });
        prisma.ticket.update.mockResolvedValue({ id: "ticket-1", status: "CLOSED" });

        await service.updateTicket("ticket-1", { status: "CLOSED" as never });

        expect(prisma.ticket.update).toHaveBeenCalledWith({
          where: { id: "ticket-1" },
          data: { status: "CLOSED", resolvedAt: NOW },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });
      });

      it("clears resolvedAt to null when reopening a RESOLVED ticket back to IN_PROGRESS", async () => {
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "RESOLVED",
        });
        prisma.ticket.update.mockResolvedValue({ id: "ticket-1", status: "IN_PROGRESS" });

        await service.updateTicket("ticket-1", { status: "IN_PROGRESS" as never });

        expect(prisma.ticket.update).toHaveBeenCalledWith({
          where: { id: "ticket-1" },
          data: { status: "IN_PROGRESS", resolvedAt: null },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });
      });

      it("clears resolvedAt to null when reopening a CLOSED ticket back to OPEN", async () => {
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "CLOSED",
        });
        prisma.ticket.update.mockResolvedValue({ id: "ticket-1", status: "OPEN" });

        await service.updateTicket("ticket-1", { status: "OPEN" as never });

        expect(prisma.ticket.update).toHaveBeenCalledWith({
          where: { id: "ticket-1" },
          data: { status: "OPEN", resolvedAt: null },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });
      });

      it("leaves resolvedAt untouched when moving between RESOLVED and CLOSED (never actually reopened)", async () => {
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "RESOLVED",
        });
        prisma.ticket.update.mockResolvedValue({ id: "ticket-1", status: "CLOSED" });

        await service.updateTicket("ticket-1", { status: "CLOSED" as never });

        expect(prisma.ticket.update).toHaveBeenCalledWith({
          where: { id: "ticket-1" },
          data: { status: "CLOSED" },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });
      });

      it("leaves resolvedAt untouched (no key in data at all) when the transition never crosses the resolved boundary", async () => {
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "OPEN",
        });
        prisma.ticket.update.mockResolvedValue({ id: "ticket-1", status: "IN_PROGRESS" });

        await service.updateTicket("ticket-1", { status: "IN_PROGRESS" as never });

        expect(prisma.ticket.update).toHaveBeenCalledWith({
          where: { id: "ticket-1" },
          data: { status: "IN_PROGRESS" },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });
      });

      it("does not touch resolvedAt when status is absent from the DTO entirely, regardless of current status", async () => {
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "RESOLVED",
        });
        prisma.ticket.update.mockResolvedValue({ id: "ticket-1", subject: "New subject" });

        await service.updateTicket("ticket-1", { subject: "New subject" });

        expect(prisma.ticket.update).toHaveBeenCalledWith({
          where: { id: "ticket-1" },
          data: { subject: "New subject" },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });
      });

      it("sets a fresh resolvedAt when resolving again after a reopen, not the original timestamp", async () => {
        // First resolution.
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "OPEN",
        });
        prisma.ticket.update.mockResolvedValue({ id: "ticket-1", status: "RESOLVED" });
        await service.updateTicket("ticket-1", { status: "RESOLVED" as never });
        expect(prisma.ticket.update).toHaveBeenLastCalledWith({
          where: { id: "ticket-1" },
          data: { status: "RESOLVED", resolvedAt: NOW },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });

        // Reopen.
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "RESOLVED",
        });
        prisma.ticket.update.mockResolvedValue({ id: "ticket-1", status: "OPEN" });
        await service.updateTicket("ticket-1", { status: "OPEN" as never });
        expect(prisma.ticket.update).toHaveBeenLastCalledWith({
          where: { id: "ticket-1" },
          data: { status: "OPEN", resolvedAt: null },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });

        // Resolve again, later.
        const LATER = new Date("2026-01-09T09:00:00.000Z");
        vi.setSystemTime(LATER);
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          categoryId: null,
          priority: "MEDIUM",
          departmentId: null,
          status: "OPEN",
        });
        prisma.ticket.update.mockResolvedValue({ id: "ticket-1", status: "RESOLVED" });
        await service.updateTicket("ticket-1", { status: "RESOLVED" as never });
        expect(prisma.ticket.update).toHaveBeenLastCalledWith({
          where: { id: "ticket-1" },
          data: { status: "RESOLVED", resolvedAt: LATER },
          include: {
            category: { select: { name: true } },
            customer: { select: { displayName: true } },
          },
        });
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

  // Story 55 — Customer Portal — Ticket CSAT / Feedback.
  describe("getCsatForTicket", () => {
    it("throws NotFoundException for an unknown/out-of-scope ticket id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getCsatForTicket("missing-id")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.ticketCsatResponse.findUnique).not.toHaveBeenCalled();
    });

    it("returns null when no feedback has been submitted yet", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketCsatResponse.findUnique.mockResolvedValue(null);

      const result = await service.getCsatForTicket("ticket-1");

      expect(prisma.ticketCsatResponse.findUnique).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
      });
      expect(result).toBeNull();
    });

    it("returns the feedback once submitted", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketCsatResponse.findUnique.mockResolvedValue({
        id: "csat-1",
        ticketId: "ticket-1",
        submittedByContactId: "contact-1",
        rating: 5,
        comment: "Great support",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const result = await service.getCsatForTicket("ticket-1");

      expect(result).toEqual({
        id: "csat-1",
        ticketId: "ticket-1",
        submittedByContactId: "contact-1",
        rating: 5,
        comment: "Great support",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });
  });

  describe("getTicketNotes", () => {
    it("throws NotFoundException for an unknown/out-of-scope ticket id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getTicketNotes("missing-id")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticketNote.findMany).not.toHaveBeenCalled();
    });

    it("returns [] for a ticket with no notes", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketNote.findMany.mockResolvedValue([]);

      const result = await service.getTicketNotes("ticket-1");

      expect(result).toEqual([]);
    });

    it("scopes and orders notes chronologically (asc) once the ticket is confirmed in scope", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketNote.findMany.mockResolvedValue([
        {
          id: "note-1",
          ticketId: "ticket-1",
          authorUserId: "user-1",
          body: "Called the customer back.",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);

      const result = await service.getTicketNotes("ticket-1");

      expect(prisma.ticketNote.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual([
        {
          id: "note-1",
          ticketId: "ticket-1",
          authorUserId: "user-1",
          body: "Called the customer back.",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
    });
  });

  describe("createTicketNote", () => {
    it("throws NotFoundException for a ticket not in the caller's branch, never creating a note", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.createTicketNote("missing-id", { body: "Some note" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticketNote.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("creates the note as the authenticated actor and emits ticket.note-added", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.ticketNote.create.mockResolvedValue({
        id: "note-1",
        ticketId: "ticket-1",
        authorUserId: "user-1",
        body: "Called the customer back.",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const result = await service.createTicketNote("ticket-1", {
        body: "Called the customer back.",
      });

      expect(prisma.ticketNote.create).toHaveBeenCalledWith({
        data: { ticketId: "ticket-1", authorUserId: "user-1", body: "Called the customer back." },
      });
      expect(result).toEqual({ id: "note-1" });
      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_NOTE_ADDED_EVENT, {
        ticketId: "ticket-1",
        note: {
          id: "note-1",
          ticketId: "ticket-1",
          authorUserId: "user-1",
          body: "Called the customer back.",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
    });
  });

  // Story 53 — Customer Portal — Submit & Track Own Tickets.
  describe("createTicketForContact", () => {
    it("throws NotFoundException for an unknown contact, never creating a ticket", async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(
        service.createTicketForContact("missing-contact", { subject: "Help" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticket.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("creates the ticket scoped to the contact's own customer/branch, with actorUserId null", async () => {
      prisma.contact.findUnique.mockResolvedValue({
        id: "contact-1",
        customerId: "customer-1",
        customer: { id: "customer-1", branchId: "branch-1" },
      });
      prisma.ticket.create.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: "contact-1",
        departmentId: null,
        assignedToUserId: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const result = await service.createTicketForContact("contact-1", {
        subject: "Cannot log in",
      });

      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          customerId: "customer-1",
          contactId: "contact-1",
          subject: "Cannot log in",
          categoryId: null,
        },
        include: {
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
      });
      expect(prisma.ticketCategory.findFirst).not.toHaveBeenCalled();
      expect(result.customerId).toBe("customer-1");
      expect(eventEmitter.emit).toHaveBeenCalledOnce();
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_CREATED_EVENT, {
        ticket: result,
        actorUserId: null,
      });
    });

    // Story 120 — `dto.category` is still free text on this customer/public
    // -facing surface; it's resolved here to an existing `TicketCategory` by
    // exact, case-insensitive name within the contact's own branch.
    it("resolves a free-text category to an existing category id, case-insensitively, within the contact's branch", async () => {
      prisma.contact.findUnique.mockResolvedValue({
        id: "contact-1",
        customerId: "customer-1",
        customer: { id: "customer-1", branchId: "branch-1" },
      });
      prisma.ticketCategory.findFirst.mockResolvedValue({ id: "category-1" });
      prisma.ticket.create.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: "category-1",
        category: { name: "Account" },
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: "contact-1",
        departmentId: null,
        assignedToUserId: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      await service.createTicketForContact("contact-1", {
        subject: "Cannot log in",
        category: "account",
      });

      expect(prisma.ticketCategory.findFirst).toHaveBeenCalledWith({
        where: { branchId: "branch-1", name: { equals: "account", mode: "insensitive" } },
        select: { id: true },
      });
      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoryId: "category-1" }) }),
      );
    });

    it("leaves the category unset (never auto-creates) when no existing category matches", async () => {
      prisma.contact.findUnique.mockResolvedValue({
        id: "contact-1",
        customerId: "customer-1",
        customer: { id: "customer-1", branchId: "branch-1" },
      });
      prisma.ticketCategory.findFirst.mockResolvedValue(null);
      prisma.ticket.create.mockResolvedValue({
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "customer-1",
        contactId: "contact-1",
        departmentId: null,
        assignedToUserId: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      await service.createTicketForContact("contact-1", {
        subject: "Cannot log in",
        category: "nonexistent-category",
      });

      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoryId: null }) }),
      );
    });
  });

  describe("listTicketsForCustomer", () => {
    // PORTAL-1 — paginated: the id tie-breaker follows createdAt desc, and
    // the query is a page (skip/take), not the whole table.
    it("scopes the query to the given customerId, ordered createdAt desc with an id tie-breaker, paginated", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.listTicketsForCustomer("customer-1");

      expect(prisma.ticket.count).toHaveBeenCalledWith({ where: { customerId: "customer-1" } });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { customerId: "customer-1" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: {
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
      });
    });

    it("returns a paginated envelope with items: [] for a customer with no tickets", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      const result = await service.listTicketsForCustomer("customer-1");

      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 });
    });

    it("forwards an explicit page/pageSize to skip/take", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.listTicketsForCustomer("customer-1", { page: 3, pageSize: 10 });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("maps each row through toTicketSummary", async () => {
      const row = {
        id: "ticket-1",
        subject: "Cannot log in",
        categoryId: "category-1",
        category: { name: "billing" },
        priority: "MEDIUM" as const,
        status: "OPEN" as const,
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      };
      prisma.ticket.findMany.mockResolvedValue([row]);
      prisma.ticket.count.mockResolvedValue(1);

      const result = await service.listTicketsForCustomer("customer-1");

      expect(result.items).toEqual([
        {
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
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      ]);
    });
  });

  describe("getTicketForCustomer", () => {
    it("throws NotFoundException for a ticket belonging to a different customer or unknown id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getTicketForCustomer("ticket-1", "customer-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: "ticket-1", customerId: "customer-1" },
        include: {
          category: { select: { name: true } },
          customer: { select: { displayName: true } },
        },
      });
    });
  });

  describe("getTicketHistoryForCustomer", () => {
    it("throws NotFoundException for a ticket belonging to a different customer", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.getTicketHistoryForCustomer("ticket-1", "customer-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticketHistoryEntry.findMany).not.toHaveBeenCalled();
    });

    it("scopes and orders history entries once the ticket is confirmed in scope", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1", customerId: "customer-1" });
      prisma.ticketHistoryEntry.findMany.mockResolvedValue([
        {
          id: "history-1",
          eventType: TICKET_CREATED_EVENT,
          actorUserId: null,
          snapshot: { id: "ticket-1" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);

      const result = await service.getTicketHistoryForCustomer("ticket-1", "customer-1");

      expect(prisma.ticketHistoryEntry.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual([
        {
          id: "history-1",
          eventType: TICKET_CREATED_EVENT,
          actorUserId: null,
          snapshot: { id: "ticket-1" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
    });
  });

  // Story 55 — Customer Portal — Ticket CSAT / Feedback (customer-scoped).
  describe("submitCsatForCustomer", () => {
    it("throws NotFoundException for a ticket belonging to a different customer or unknown id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.submitCsatForCustomer("ticket-1", "customer-1", "contact-1", { rating: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ticketCsatResponse.create).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when the ticket isn't resolved or closed", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        customerId: "customer-1",
        status: "OPEN",
      });

      await expect(
        service.submitCsatForCustomer("ticket-1", "customer-1", "contact-1", { rating: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ticketCsatResponse.create).not.toHaveBeenCalled();
    });

    it.each(["RESOLVED", "CLOSED"])(
      "creates the feedback when the ticket is %s",
      async (status) => {
        prisma.ticket.findFirst.mockResolvedValue({
          id: "ticket-1",
          customerId: "customer-1",
          status,
        });
        prisma.ticketCsatResponse.create.mockResolvedValue({ id: "csat-1" });

        const result = await service.submitCsatForCustomer("ticket-1", "customer-1", "contact-1", {
          rating: 4,
          comment: "Good",
        });

        expect(prisma.ticketCsatResponse.create).toHaveBeenCalledWith({
          data: {
            ticketId: "ticket-1",
            submittedByContactId: "contact-1",
            rating: 4,
            comment: "Good",
          },
        });
        expect(result).toEqual({ id: "csat-1" });
      },
    );

    it("defaults comment to null when omitted", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        customerId: "customer-1",
        status: "RESOLVED",
      });
      prisma.ticketCsatResponse.create.mockResolvedValue({ id: "csat-1" });

      await service.submitCsatForCustomer("ticket-1", "customer-1", "contact-1", { rating: 3 });

      expect(prisma.ticketCsatResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ comment: null }) }),
      );
    });

    it("translates a duplicate submission (P2002) into ConflictException", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        customerId: "customer-1",
        status: "RESOLVED",
      });
      prisma.ticketCsatResponse.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      await expect(
        service.submitCsatForCustomer("ticket-1", "customer-1", "contact-1", { rating: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rethrows unrelated errors from the create call", async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: "ticket-1",
        customerId: "customer-1",
        status: "RESOLVED",
      });
      const unrelated = new Error("connection lost");
      prisma.ticketCsatResponse.create.mockRejectedValue(unrelated);

      await expect(
        service.submitCsatForCustomer("ticket-1", "customer-1", "contact-1", { rating: 5 }),
      ).rejects.toBe(unrelated);
    });
  });

  describe("getCsatForCustomer", () => {
    it("throws NotFoundException for a ticket belonging to a different customer or unknown id", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getCsatForCustomer("ticket-1", "customer-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.ticketCsatResponse.findUnique).not.toHaveBeenCalled();
    });

    it("returns null when no feedback has been submitted yet", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1", customerId: "customer-1" });
      prisma.ticketCsatResponse.findUnique.mockResolvedValue(null);

      const result = await service.getCsatForCustomer("ticket-1", "customer-1");

      expect(result).toBeNull();
    });

    it("returns the feedback once submitted", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1", customerId: "customer-1" });
      prisma.ticketCsatResponse.findUnique.mockResolvedValue({
        id: "csat-1",
        ticketId: "ticket-1",
        submittedByContactId: "contact-1",
        rating: 5,
        comment: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const result = await service.getCsatForCustomer("ticket-1", "customer-1");

      expect(result).toEqual({
        id: "csat-1",
        ticketId: "ticket-1",
        submittedByContactId: "contact-1",
        rating: 5,
        comment: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });
  });
});
