import { Module } from "@nestjs/common";
import { SlaAtRiskNotificationListener } from "./sla-at-risk-notification.listener";

/**
 * Owns the `notifications` schema — see
 * docs/architecture/03-domain-boundaries.md ("Notifications"). The first
 * story in this domain; no controller yet (`NotificationLog` has no HTTP
 * surface, mirroring `SlaEscalation`'s own precedent). `TenantContext` is
 * not provided here — `SlaAtRiskNotificationListener` runs outside request
 * scope, reading `branchId` from the event payload only, the same pattern
 * `SlaEscalationListener`/`TicketEscalationListener` already use.
 */
@Module({
  providers: [SlaAtRiskNotificationListener],
})
export class NotificationsModule {}
