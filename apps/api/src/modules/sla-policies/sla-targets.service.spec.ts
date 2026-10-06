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
    // Demo hardening — the first agent reply.
    channelMessage: {
      findFirst: vi.fn().mockResolvedValue(null),
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
        onHoldSince: null,
      };
      prisma.slaTicketTarget.findUnique.mockResolvedValue(target);

      const result = await service.getSlaTargetForTicket("ticket-1");

      // Demo hardening — plus when an agent first replied (none here).
      expect(result).toEqual({ ...target, firstResponseAt: null });
    });

    it("adds the first agent reply, looked up as the earliest outbound message a person sent", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      prisma.slaTicketTarget.findUnique.mockResolvedValue({
        id: "target-1",
        ticketId: "ticket-1",
        slaPolicyId: "policy-1",
        responseTargetAt: new Date("2026-01-01T00:30:00.000Z"),
        resolutionTargetAt: new Date("2026-01-01T04:00:00.000Z"),
        onHoldSince: null,
      });
      const repliedAt = new Date("2026-01-01T00:10:00.000Z");
      prisma.channelMessage.findFirst.mockResolvedValue({ createdAt: repliedAt });

      const result = await service.getSlaTargetForTicket("ticket-1");

      expect(result.firstResponseAt).toBe(repliedAt);
      expect(prisma.channelMessage.findFirst).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1", direction: "OUTBOUND", senderUserId: { not: null } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
    });

    // RM-25 — SLA Pause/Resume.
    it("passes through a set onHoldSince unchanged", async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: "ticket-1" });
      const onHoldSince = new Date("2026-01-01T01:00:00.000Z");
      prisma.slaTicketTarget.findUnique.mockResolvedValue({
        id: "target-1",
        ticketId: "ticket-1",
        slaPolicyId: "policy-1",
        responseTargetAt: new Date("2026-01-01T00:30:00.000Z"),
        resolutionTargetAt: new Date("2026-01-01T04:00:00.000Z"),
        onHoldSince,
      });

      const result = await service.getSlaTargetForTicket("ticket-1");

      expect(result.onHoldSince).toBe(onHoldSince);
    });
  });
});
