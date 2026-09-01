import { beforeEach, describe, expect, it, vi } from "vitest";
import { PortalNotificationPreferencesService } from "./portal-notification-preferences.service";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    portalNotificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
): PortalNotificationPreferencesService {
  return new PortalNotificationPreferencesService(prismaMock as unknown as PrismaService);
}

describe("PortalNotificationPreferencesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: PortalNotificationPreferencesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    service = createService(prisma);
  });

  describe("listPreferences", () => {
    it("scopes the query by contactId", async () => {
      prisma.portalNotificationPreference.findMany.mockResolvedValue([]);

      await service.listPreferences("contact-1");

      expect(prisma.portalNotificationPreference.findMany).toHaveBeenCalledWith({
        where: { contactId: "contact-1" },
      });
    });

    it("defaults every event type to enabled when no rows exist yet", async () => {
      prisma.portalNotificationPreference.findMany.mockResolvedValue([]);

      const result = await service.listPreferences("contact-1");

      expect(result).toEqual([
        { eventType: "ticket.updated", inAppEnabled: true },
        { eventType: "channel.message.created", inAppEnabled: true },
      ]);
    });

    it("reflects a persisted disabled row, leaving the other at its default", async () => {
      prisma.portalNotificationPreference.findMany.mockResolvedValue([
        { eventType: "ticket.updated", inAppEnabled: false },
      ]);

      const result = await service.listPreferences("contact-1");

      expect(result).toEqual([
        { eventType: "ticket.updated", inAppEnabled: false },
        { eventType: "channel.message.created", inAppEnabled: true },
      ]);
    });

    it("always returns exactly the two known event types, regardless of row order", async () => {
      prisma.portalNotificationPreference.findMany.mockResolvedValue([
        { eventType: "channel.message.created", inAppEnabled: false },
      ]);

      const result = await service.listPreferences("contact-1");

      expect(result.map((row) => row.eventType)).toEqual([
        "ticket.updated",
        "channel.message.created",
      ]);
    });
  });

  describe("setPreference", () => {
    it("upserts on the (contactId, eventType) compound key", async () => {
      prisma.portalNotificationPreference.upsert.mockResolvedValue({});

      await service.setPreference("contact-1", {
        eventType: "ticket.updated",
        inAppEnabled: false,
      });

      expect(prisma.portalNotificationPreference.upsert).toHaveBeenCalledWith({
        where: { contactId_eventType: { contactId: "contact-1", eventType: "ticket.updated" } },
        create: { contactId: "contact-1", eventType: "ticket.updated", inAppEnabled: false },
        update: { inAppEnabled: false },
      });
    });

    it("returns the resulting preference", async () => {
      prisma.portalNotificationPreference.upsert.mockResolvedValue({});

      const result = await service.setPreference("contact-1", {
        eventType: "channel.message.created",
        inAppEnabled: true,
      });

      expect(result).toEqual({ eventType: "channel.message.created", inAppEnabled: true });
    });
  });
});
