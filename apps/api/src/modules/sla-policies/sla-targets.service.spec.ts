import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { SlaTargetsService } from "./sla-targets.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    ticket: {
      findFirst: vi.fn(),
    },
    slaTicketTarget: {
      findUnique: vi.fn(),
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
): SlaTargetsService {
  return new SlaTargetsService(
    prismaMock as unknown as PrismaService,
    tenantContextMock as unknown as TenantContext,
  );
}

describe("SlaTargetsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: SlaTargetsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("getSlaTargetForTicket", () => {
    it("throws NotFoundException when the ticket is not in the caller's branch", async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getSlaTargetForTicket("ticket-1")).rejects.toThrow(NotFoundException);
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: "ticket-1", branchId: "branch-1" },
      });
      expect(prisma.slaTicketTarget.findUnique).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the ticket is in scope but has no computed target", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.slaTicketTarget.findUnique.mockResolvedValue(null);

      await expect(service.getSlaTargetForTicket("ticket-1")).rejects.toThrow(NotFoundException);
      expect(prisma.slaTicketTarget.findUnique).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
      });
    });

    it("returns the mapped summary when both the ticket and its target exist", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      const target = {
        id: "target-1",
        ticketId: "ticket-1",
        slaPolicyId: "policy-1",
        responseTargetAt: new Date("2026-01-01T00:30:00.000Z"),
        resolutionTargetAt: new Date("2026-01-01T04:00:00.000Z"),
      };
      prisma.slaTicketTarget.findUnique.mockResolvedValue(target);

      const result = await service.getSlaTargetForTicket("ticket-1");

      expect(result).toEqual(target);
    });
  });
});
