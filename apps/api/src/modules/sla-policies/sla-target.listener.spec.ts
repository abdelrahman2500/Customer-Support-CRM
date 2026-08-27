import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlaTargetListener } from "./sla-target.listener";
import { TICKET_CREATED_EVENT, TICKET_RECATEGORIZED_EVENT } from "../tickets/tickets.events";
import type { TicketSummary } from "../tickets/tickets.service";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    ticket: {
      findUnique: vi.fn(),
    },
    slaPolicy: {
      findMany: vi.fn(),
    },
    // Defaults to `null` (no calendar for the branch) so every pre-existing
    // test below — none of which configure this mock — continues to
    // exercise exactly the wall-clock fallback path they always have.
    businessHoursCalendar: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    slaTicketTarget: {
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
}

function createListener(prismaMock: ReturnType<typeof buildPrismaMock>): SlaTargetListener {
  return new SlaTargetListener(prismaMock as unknown as PrismaService);
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
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

const fullTicketRow = {
  branchId: "branch-1",
  departmentId: null as string | null,
  category: null as string | null,
  priority: "MEDIUM",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function wildcardPolicy(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "policy-wildcard",
    departmentId: null,
    category: null,
    priority: null,
    responseTargetMinutes: 30,
    resolutionTargetMinutes: 240,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("SlaTargetListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: SlaTargetListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    listener = createListener(prisma);
  });

  describe("onTicketCreated", () => {
    it("re-fetches the ticket by event.ticket.id", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        select: {
          branchId: true,
          departmentId: true,
          category: true,
          priority: true,
          createdAt: true,
        },
      });
    });

    it("does nothing when the ticket cannot be re-fetched (defensive edge case)", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaPolicy.findMany).not.toHaveBeenCalled();
      expect(prisma.slaTicketTarget.create).not.toHaveBeenCalled();
    });

    it("creates no target when no active policy matches", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.create).not.toHaveBeenCalled();
    });

    it("creates a target computed from the ticket's createdAt plus the matched policy's minute counts", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          slaPolicyId: "policy-wildcard",
          responseTargetAt: new Date("2026-01-01T00:30:00.000Z"),
          resolutionTargetAt: new Date("2026-01-01T04:00:00.000Z"),
        },
      });
    });

    it("prefers the more specific of two matching candidates", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ ...fullTicketRow, category: "billing" });
      const wildcard = wildcardPolicy({
        id: "policy-wildcard",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const scoped = wildcardPolicy({
        id: "policy-scoped",
        category: "billing",
        responseTargetMinutes: 15,
        resolutionTargetMinutes: 120,
        createdAt: new Date("2026-01-01T00:05:00.000Z"),
      });
      prisma.slaPolicy.findMany.mockResolvedValue([wildcard, scoped]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          slaPolicyId: "policy-scoped",
          responseTargetAt: new Date("2026-01-01T00:15:00.000Z"),
          resolutionTargetAt: new Date("2026-01-01T02:00:00.000Z"),
        },
      });
    });

    it("breaks ties between equally-specific candidates by earliest createdAt", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      const earlier = wildcardPolicy({
        id: "policy-earlier",
        responseTargetMinutes: 10,
        resolutionTargetMinutes: 100,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const later = wildcardPolicy({
        id: "policy-later",
        responseTargetMinutes: 999,
        resolutionTargetMinutes: 999,
        createdAt: new Date("2026-01-01T01:00:00.000Z"),
      });
      // Simulate the service's own `orderBy: { createdAt: "asc" }` ordering.
      prisma.slaPolicy.findMany.mockResolvedValue([earlier, later]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slaPolicyId: "policy-earlier" }) }),
      );
    });

    it("does not throw when persistence fails — it catches and logs instead", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]);
      prisma.slaTicketTarget.create.mockRejectedValue(new Error("db unavailable"));

      await expect(
        listener.onTicketCreated({ ticket, actorUserId: "user-1" }),
      ).resolves.toBeUndefined();
    });

    it("uses the branch's BusinessHoursCalendar to compute both targets when one exists (Story 13)", async () => {
      // fullTicketRow.createdAt is 2026-01-01T00:00:00.000Z, a Thursday
      // (weekday 4), at local midnight — before the calendar's 09:00 open.
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]); // response 30, resolution 240
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({
        branch: { timezone: "UTC" },
        days: [{ weekday: 4, isOpen: true, startMinute: 540, endMinute: 1020 }],
        exceptions: [],
      });

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.businessHoursCalendar.findFirst).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        include: { branch: { select: { timezone: true } }, days: true, exceptions: true },
      });
      // Business-hours-aware: both targets start counting from 09:00
      // (the window's open), not from midnight — clearly different from
      // the plain wall-clock 00:30/04:00 the fallback path would produce,
      // proving the calendar path was actually used.
      expect(prisma.slaTicketTarget.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          slaPolicyId: "policy-wildcard",
          responseTargetAt: new Date("2026-01-01T09:30:00.000Z"),
          resolutionTargetAt: new Date("2026-01-01T13:00:00.000Z"),
        },
      });
    });

    it("catches and logs when the calendar's business hours never permit a target (e.g. all closed)", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]);
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({
        branch: { timezone: "UTC" },
        days: [],
        exceptions: [],
      });

      await expect(
        listener.onTicketCreated({ ticket, actorUserId: "user-1" }),
      ).resolves.toBeUndefined();
      expect(prisma.slaTicketTarget.create).not.toHaveBeenCalled();
    });
  });

  describe("onTicketRecategorized", () => {
    it("re-fetches the ticket by event.ticket.id", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([]);

      await listener.onTicketRecategorized({ ticket, actorUserId: "user-1" });

      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        select: {
          branchId: true,
          departmentId: true,
          category: true,
          priority: true,
          createdAt: true,
        },
      });
    });

    it("does nothing when the ticket cannot be re-fetched (defensive edge case)", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await listener.onTicketRecategorized({ ticket, actorUserId: "user-1" });

      expect(prisma.slaPolicy.findMany).not.toHaveBeenCalled();
      expect(prisma.slaTicketTarget.upsert).not.toHaveBeenCalled();
      expect(prisma.slaTicketTarget.deleteMany).not.toHaveBeenCalled();
    });

    it("recomputes and upserts the target using the newly-matched policy, resetting all four notified-at columns", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]); // response 30, resolution 240

      await listener.onTicketRecategorized({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.upsert).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        create: {
          ticketId: "ticket-1",
          slaPolicyId: "policy-wildcard",
          responseTargetAt: new Date("2026-01-01T00:30:00.000Z"),
          resolutionTargetAt: new Date("2026-01-01T04:00:00.000Z"),
        },
        update: {
          slaPolicyId: "policy-wildcard",
          responseTargetAt: new Date("2026-01-01T00:30:00.000Z"),
          resolutionTargetAt: new Date("2026-01-01T04:00:00.000Z"),
          responseAtRiskNotifiedAt: null,
          responseBreachedNotifiedAt: null,
          resolutionAtRiskNotifiedAt: null,
          resolutionBreachedNotifiedAt: null,
        },
      });
    });

    it("supplies a correctly-shaped `create` payload for a ticket that previously had no target", async () => {
      // Whether Prisma's `upsert` actually takes the `create` or `update`
      // branch depends on whether a row matching `where` already exists in
      // the real database — not observable through this mock. This test
      // only proves the `create` payload this listener supplies is correct
      // for that case; the branch selection itself is covered by the e2e
      // suite (real Postgres).
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]);

      await listener.onTicketRecategorized({ ticket, actorUserId: "user-1" });

      const call = prisma.slaTicketTarget.upsert.mock.calls[0]![0];
      expect(call.create).toEqual({
        ticketId: "ticket-1",
        slaPolicyId: "policy-wildcard",
        responseTargetAt: new Date("2026-01-01T00:30:00.000Z"),
        resolutionTargetAt: new Date("2026-01-01T04:00:00.000Z"),
      });
    });

    it("resets notified-at columns to null unconditionally, regardless of any previous at-risk/breached state", async () => {
      // The listener never reads the existing row's notified-at values — the
      // `update` payload's four `null`s are unconditional (Design item 6),
      // so a previously at-risk/breached target is reset the same way a
      // never-fired one is.
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]);

      await listener.onTicketRecategorized({ ticket, actorUserId: "user-1" });

      const call = prisma.slaTicketTarget.upsert.mock.calls[0]![0];
      expect(call.update).toMatchObject({
        responseAtRiskNotifiedAt: null,
        responseBreachedNotifiedAt: null,
        resolutionAtRiskNotifiedAt: null,
        resolutionBreachedNotifiedAt: null,
      });
    });

    it("deletes the existing target and does not upsert when no policy matches", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([]);

      await listener.onTicketRecategorized({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.deleteMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
      });
      expect(prisma.slaTicketTarget.upsert).not.toHaveBeenCalled();
    });

    it("reuses the branch's BusinessHoursCalendar the same way onTicketCreated does (Story 13, shared helper)", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]); // response 30, resolution 240
      prisma.businessHoursCalendar.findFirst.mockResolvedValue({
        branch: { timezone: "UTC" },
        days: [{ weekday: 4, isOpen: true, startMinute: 540, endMinute: 1020 }],
        exceptions: [],
      });

      await listener.onTicketRecategorized({ ticket, actorUserId: "user-1" });

      expect(prisma.businessHoursCalendar.findFirst).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        include: { branch: { select: { timezone: true } }, days: true, exceptions: true },
      });
      expect(prisma.slaTicketTarget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            responseTargetAt: new Date("2026-01-01T09:30:00.000Z"),
            resolutionTargetAt: new Date("2026-01-01T13:00:00.000Z"),
          }),
        }),
      );
    });

    it("does not throw when persistence fails — it catches and logs instead", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]);
      prisma.slaTicketTarget.upsert.mockRejectedValue(new Error("db unavailable"));

      await expect(
        listener.onTicketRecategorized({ ticket, actorUserId: "user-1" }),
      ).resolves.toBeUndefined();
    });

    it("does not throw when the deleteMany persistence fails — it catches and logs instead", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([]);
      prisma.slaTicketTarget.deleteMany.mockRejectedValue(new Error("db unavailable"));

      await expect(
        listener.onTicketRecategorized({ ticket, actorUserId: "user-1" }),
      ).resolves.toBeUndefined();
    });
  });

  it("does not subscribe to ticket.updated", () => {
    expect((listener as unknown as Record<string, unknown>).onTicketUpdated).toBeUndefined();
  });

  it("subscribes to ticket.created", () => {
    // Sanity check that the constant this listener is decorated with matches
    // the constant TicketsService actually emits.
    expect(TICKET_CREATED_EVENT).toBe("ticket.created");
  });

  it("subscribes to ticket.recategorized via a distinct handler from onTicketUpdated", () => {
    // Sanity check that the constant this listener is decorated with matches
    // the constant TicketsService actually emits (Story 16).
    expect(TICKET_RECATEGORIZED_EVENT).toBe("ticket.recategorized");
    expect(typeof listener.onTicketRecategorized).toBe("function");
    expect((listener as unknown as Record<string, unknown>).onTicketUpdated).toBeUndefined();
  });
});
