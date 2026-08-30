import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationPreferencesController } from "./notification-preferences.controller";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { SlaAtRiskNotificationListener } from "./sla-at-risk-notification.listener";
import { TicketEscalatedNotificationListener } from "./ticket-escalated-notification.listener";

/**
 * Owns the `notifications` schema — see
 * docs/architecture/03-domain-boundaries.md ("Notifications"). Neither
 * listener runs inside request scope — `SlaAtRiskNotificationListener`
 * reads `branchId` from its event payload, `TicketEscalatedNotificationListener`
 * (Story 19) has none available and leaves it `null` (see that file's own
 * doc comment). Neither listener imports `TicketsModule`/`SlaPoliciesModule`
 * — only their event contracts (`tickets.events.ts`/`sla-detection.events.ts`),
 * the same plain-TypeScript-import pattern every existing cross-module
 * listener in this codebase already uses.
 *
 * Story 36 — adds the module's first HTTP surface, `NotificationsController`/
 * `NotificationsService` (read-only `GET /notifications`), which DOES run
 * inside request scope and needs `TenantContext` — provided here the same
 * way every other feature module provides it (see `CustomersModule`'s own
 * doc comment).
 *
 * Story 58 — `NotificationPreferences*` added the same way. Self-scoped by
 * the caller's own `userId` (never `TenantContext`/a permission) — see that
 * service's own doc comment.
 */
@Module({
  controllers: [NotificationsController, NotificationPreferencesController],
  providers: [
    NotificationsService,
    NotificationPreferencesService,
    TenantContext,
    SlaAtRiskNotificationListener,
    TicketEscalatedNotificationListener,
  ],
})
export class NotificationsModule {}
