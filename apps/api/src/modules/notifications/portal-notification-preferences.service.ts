import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdatePortalNotificationPreferenceDto } from "./dto/update-portal-notification-preference.dto";

/**
 * Story 90 — the exact two event types `CustomerNotificationRealtimeListener`
 * relays (`apps/api/src/realtime/customer-notification-realtime.listener.ts`)
 * — the only events a portal preference can ever govern.
 */
export const PORTAL_NOTIFICATION_EVENT_TYPES = ["ticket.updated", "channel.message.created"] as const;

export interface PortalNotificationPreferenceSummary {
  eventType: string;
  inAppEnabled: boolean;
}

/**
 * Self-scoped by the caller's own `contactId` (resolved by
 * `PortalNotificationPreferencesController` via `PortalService.
 * getAuthenticatedContact`) — never a branch-admin/agent resource, so no
 * `TenantContext`/permission is involved. Absence of a row means "enabled"
 * — mirrors `NotificationPreferencesService`'s own convention exactly, for
 * a `Contact` instead of a `User` (see `PortalNotificationPreference`'s own
 * schema doc comment for why this is a separate model, not a widened
 * `NotificationPreference`).
 */
@Injectable()
export class PortalNotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPreferences(contactId: string): Promise<PortalNotificationPreferenceSummary[]> {
    const rows = await this.prisma.portalNotificationPreference.findMany({ where: { contactId } });
    const byEventType = new Map(rows.map((row) => [row.eventType, row.inAppEnabled]));
    return PORTAL_NOTIFICATION_EVENT_TYPES.map((eventType) => ({
      eventType,
      inAppEnabled: byEventType.get(eventType) ?? true,
    }));
  }

  async setPreference(
    contactId: string,
    dto: UpdatePortalNotificationPreferenceDto,
  ): Promise<PortalNotificationPreferenceSummary> {
    await this.prisma.portalNotificationPreference.upsert({
      where: { contactId_eventType: { contactId, eventType: dto.eventType } },
      create: { contactId, eventType: dto.eventType, inAppEnabled: dto.inAppEnabled },
      update: { inAppEnabled: dto.inAppEnabled },
    });
    return { eventType: dto.eventType, inAppEnabled: dto.inAppEnabled };
  }
}
