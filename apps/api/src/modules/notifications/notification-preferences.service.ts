import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateNotificationPreferenceDto } from "./dto/update-notification-preference.dto";

/**
 * Story 58 — the exact three event types `BranchNotificationRealtimeListener`
 * relays (`apps/api/src/realtime/branch-notification-realtime.listener.ts`)
 * — the only events a preference can ever govern.
 */
export const NOTIFICATION_EVENT_TYPES = ["sla.at_risk", "sla.breached", "ticket.escalated"] as const;

export interface NotificationPreferenceSummary {
  eventType: string;
  inAppEnabled: boolean;
}

/**
 * Self-scoped by the caller's own `userId` (the JWT's `sub`, resolved by
 * `NotificationPreferencesController` exactly like `IdentityController.me`)
 * — never a branch-admin resource, so no `TenantContext`/permission is
 * involved here at all. Absence of a row means "enabled" (Design decision 1)
 * — mirrors `SlaPolicy`'s own "no row/null field = unrestricted" convention.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPreferences(userId: string): Promise<NotificationPreferenceSummary[]> {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const byEventType = new Map(rows.map((row) => [row.eventType, row.inAppEnabled]));
    return NOTIFICATION_EVENT_TYPES.map((eventType) => ({
      eventType,
      inAppEnabled: byEventType.get(eventType) ?? true,
    }));
  }

  async setPreference(
    userId: string,
    dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceSummary> {
    await this.prisma.notificationPreference.upsert({
      where: { userId_eventType: { userId, eventType: dto.eventType } },
      create: { userId, eventType: dto.eventType, inAppEnabled: dto.inAppEnabled },
      update: { inAppEnabled: dto.inAppEnabled },
    });
    return { eventType: dto.eventType, inAppEnabled: dto.inAppEnabled };
  }
}
