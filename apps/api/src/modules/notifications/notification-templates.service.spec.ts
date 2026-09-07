import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { NotificationTemplatesService } from "./notification-templates.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    notificationTemplate: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
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
  tenantMock: ReturnType<typeof buildTenantContextMock>,
): NotificationTemplatesService {
  return new NotificationTemplatesService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

describe("NotificationTemplatesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: NotificationTemplatesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("createOrUpdateTemplate", () => {
    it("creates a new default (locale: null) row when none exists yet for this (branchId, eventType, locale)", async () => {
      prisma.notificationTemplate.findFirst.mockResolvedValue(null);
      prisma.notificationTemplate.create.mockResolvedValue({
        id: "template-1",
        eventType: "sla.at_risk",
        locale: null,
        template: "Ticket {ticketId} is at risk",
      });

      await service.createOrUpdateTemplate({
        eventType: "sla.at_risk",
        template: "Ticket {ticketId} is at risk",
      });

      expect(prisma.notificationTemplate.findFirst).toHaveBeenCalledWith({
        where: { branchId: "branch-1", eventType: "sla.at_risk", locale: null },
      });
      expect(prisma.notificationTemplate.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          eventType: "sla.at_risk",
          locale: null,
          template: "Ticket {ticketId} is at risk",
        },
      });
    });

    it("updates the existing row's text when one already exists for this (branchId, eventType, locale)", async () => {
      prisma.notificationTemplate.findFirst.mockResolvedValue({
        id: "template-1",
        eventType: "sla.at_risk",
        locale: null,
      });
      prisma.notificationTemplate.update.mockResolvedValue({
        id: "template-1",
        eventType: "sla.at_risk",
        locale: null,
        template: "Updated text",
      });

      await service.createOrUpdateTemplate({ eventType: "sla.at_risk", template: "Updated text" });

      expect(prisma.notificationTemplate.update).toHaveBeenCalledWith({
        where: { id: "template-1" },
        data: { template: "Updated text" },
      });
      expect(prisma.notificationTemplate.create).not.toHaveBeenCalled();
    });

    it("returns the resulting template summary", async () => {
      prisma.notificationTemplate.findFirst.mockResolvedValue(null);
      prisma.notificationTemplate.create.mockResolvedValue({
        id: "template-1",
        eventType: "sla.at_risk",
        locale: null,
        template: "Ticket {ticketId} is at risk",
      });

      const result = await service.createOrUpdateTemplate({
        eventType: "sla.at_risk",
        template: "Ticket {ticketId} is at risk",
      });

      expect(result).toEqual({
        id: "template-1",
        eventType: "sla.at_risk",
        locale: null,
        template: "Ticket {ticketId} is at risk",
      });
    });

    // RM-30 — Notification Templates: locale-aware content.
    describe("locale (RM-30)", () => {
      it("scopes the lookup/create by the given locale, distinct from the default row", async () => {
        prisma.notificationTemplate.findFirst.mockResolvedValue(null);
        prisma.notificationTemplate.create.mockResolvedValue({
          id: "template-2",
          eventType: "sla.at_risk",
          locale: "ar",
          template: "تذكرتك في خطر",
        });

        await service.createOrUpdateTemplate({
          eventType: "sla.at_risk",
          locale: "ar",
          template: "تذكرتك في خطر",
        });

        expect(prisma.notificationTemplate.findFirst).toHaveBeenCalledWith({
          where: { branchId: "branch-1", eventType: "sla.at_risk", locale: "ar" },
        });
        expect(prisma.notificationTemplate.create).toHaveBeenCalledWith({
          data: {
            branchId: "branch-1",
            eventType: "sla.at_risk",
            locale: "ar",
            template: "تذكرتك في خطر",
          },
        });
      });

      it("updates the existing locale-specific row rather than the default row", async () => {
        prisma.notificationTemplate.findFirst.mockResolvedValue({
          id: "template-2",
          eventType: "sla.at_risk",
          locale: "ar",
        });
        prisma.notificationTemplate.update.mockResolvedValue({
          id: "template-2",
          eventType: "sla.at_risk",
          locale: "ar",
          template: "نص محدّث",
        });

        await service.createOrUpdateTemplate({
          eventType: "sla.at_risk",
          locale: "ar",
          template: "نص محدّث",
        });

        expect(prisma.notificationTemplate.update).toHaveBeenCalledWith({
          where: { id: "template-2" },
          data: { template: "نص محدّث" },
        });
        expect(prisma.notificationTemplate.create).not.toHaveBeenCalled();
      });
    });
  });

  describe("listTemplates", () => {
    it("scopes the query by branch, ordered by eventType", async () => {
      prisma.notificationTemplate.findMany.mockResolvedValue([]);

      await service.listTemplates();

      expect(prisma.notificationTemplate.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: { eventType: "asc" },
      });
    });

    it("returns [] when the branch has no templates yet", async () => {
      prisma.notificationTemplate.findMany.mockResolvedValue([]);

      const result = await service.listTemplates();

      expect(result).toEqual([]);
    });
  });

  describe("updateTemplate", () => {
    it("throws NotFoundException for a template in a different branch or unknown id", async () => {
      prisma.notificationTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTemplate("template-1", { template: "New text" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.notificationTemplate.update).not.toHaveBeenCalled();
    });

    it("updates the template text when found in scope", async () => {
      prisma.notificationTemplate.findFirst.mockResolvedValue({ id: "template-1" });
      prisma.notificationTemplate.update.mockResolvedValue({ id: "template-1" });

      const result = await service.updateTemplate("template-1", { template: "New text" });

      expect(prisma.notificationTemplate.update).toHaveBeenCalledWith({
        where: { id: "template-1" },
        data: { template: "New text" },
      });
      expect(result).toEqual({ id: "template-1" });
    });
  });
});
