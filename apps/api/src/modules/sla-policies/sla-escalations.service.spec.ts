import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { SlaEscalationsService } from "./sla-escalations.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    ticket: {
      findFirst: vi.fn(),
    },
    slaEscalation: {
      findMany: vi.fn(),
    },
  };
}

function buildTenantContextMock(branchId: string | null = "branch-1") {
  return {
    requireBranchScope: vi.fn(() => {
      if (!branchId) {
        throw new Error("TenantContext: no active branch on this request");
      }
      return { branchId };
    }),
  };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  tenantContextMock: ReturnType<typeof buildTenantContextMock>,
): SlaEscalationsService {
  return new SlaEscalationsService(
    prismaMock as unknown as PrismaService,
    tenantContextMock as unknown as TenantContext,
  );
}

describe("SlaEscalationsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: SlaEscalationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("getEscalationsForTicket", () => {
    it("returns escalations for a ticket in the caller's branch, ordered by escalatedAt desc", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      const rows = [
        {
          id: "escalation-2",
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "resolution",
          targetAt: new Date("2026-01-01T04:00:00.000Z"),
          escalatedAt: new Date("2026-01-01T04:05:00.000Z"),
        },
        {
          id: "escalation-1",
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "response",
          targetAt: new Date("2026-01-01T00:30:00.000Z"),
          escalatedAt: new Date("2026-01-01T00:35:00.000Z"),
        },
      ];
      prisma.slaEscalation.findMany.mockResolvedValue(rows);

      const result = await service.getEscalationsForTicket("ticket-1");

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: "ticket-1", branchId: "branch-1" },
      });
      expect(prisma.slaEscalation.findMany).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        orderBy: { escalatedAt: "desc" },
      });
      expect(result).toEqual([
        {
          id: "escalation-2",
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "resolution",
          targetAt: new Date("2026-01-01T04:00:00.000Z"),
          escalatedAt: new Date("2026-01-01T04:05:00.000Z"),
        },
        {
          id: "escalation-1",
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "response",
          targetAt: new Date("2026-01-01T00:30:00.000Z"),
          escalatedAt: new Date("2026-01-01T00:35:00.000Z"),
        },
      ]);
    });

    it("returns an empty array when the ticket has no escalations", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.slaEscalation.findMany.mockResolvedValue([]);

      const result = await service.getEscalationsForTicket("ticket-1");

      expect(result).toEqual([]);
    });

    it("throws NotFoundException when the ticket isn't found in the caller's branch", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getEscalationsForTicket("ticket-1")).rejects.toThrow(NotFoundException);
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: "ticket-1", branchId: "branch-1" },
      });
      expect(prisma.slaEscalation.findMany).not.toHaveBeenCalled();
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.getEscalationsForTicket("ticket-1")).rejects.toThrow(/no active branch/);
    });
  });
});
