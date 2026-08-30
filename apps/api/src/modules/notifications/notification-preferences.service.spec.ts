import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationPreferencesService } from "./notification-preferences.service";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    notificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

function createService(prismaMock: ReturnType<typeof buildPrismaMock>): NotificationPreferencesService {
  return new NotificationPreferencesService(prismaMock as unknown as PrismaService);
}

describe("NotificationPreferencesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: NotificationPreferencesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    service = createService(prisma);
  });

  describe("listPreferences", () => {
    it("scopes the query by userId", async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([]);

      await service.listPreferences("user-1");

      expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("defaults every event type to enabled when no rows exist yet", async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([]);

      const result = await service.listPreferences("user-1");

      expect(result).toEqual([
        { eventType: "sla.at_risk", inAppEnabled: true },
        { eventType: "sla.breached", inAppEnabled: true },
        { eventType: "ticket.escalated", inAppEnabled: true },
      ]);
    });

    it("reflects a persisted disabled row, leaving the other two at their default", async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([
        { eventType: "sla.at_risk", inAppEnabled: false },
      ]);

      const result = await service.listPreferences("user-1");

      expect(result).toEqual([
        { eventType: "sla.at_risk", inAppEnabled: false },
        { eventType: "sla.breached", inAppEnabled: true },
        { eventType: "ticket.escalated", inAppEnabled: true },
      ]);
    });

    it("always returns exactly the three known event types, regardless of row order", async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([
        { eventType: "ticket.escalated", inAppEnabled: false },
        { eventType: "sla.breached", inAppEnabled: false },
      ]);

      const result = await service.listPreferences("user-1");

      expect(result.map((row) => row.eventType)).toEqual([
        "sla.at_risk",
        "sla.breached",
        "ticket.escalated",
      ]);
    });
  });

  describe("setPreference", () => {
    it("upserts on the (userId, eventType) compound key", async () => {
      prisma.notificationPreference.upsert.mockResolvedValue({});

      await service.setPreference("user-1", { eventType: "sla.at_risk", inAppEnabled: false });

      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId_eventType: { userId: "user-1", eventType: "sla.at_risk" } },
        create: { userId: "user-1", eventType: "sla.at_risk", inAppEnabled: false },
        update: { inAppEnabled: false },
      });
    });

    it("returns the resulting preference", async () => {
      prisma.notificationPreference.upsert.mockResolvedValue({});

      const result = await service.setPreference("user-1", {
        eventType: "ticket.escalated",
        inAppEnabled: true,
      });

      expect(result).toEqual({ eventType: "ticket.escalated", inAppEnabled: true });
    });
  });
});
