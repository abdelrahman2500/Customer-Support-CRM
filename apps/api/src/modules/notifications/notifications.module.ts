import { Module } from "@nestjs/common";
import { SlaAtRiskNotificationListener } from "./sla-at-risk-notification.listener";
import { TicketEscalatedNotificationListener } from "./ticket-escalated-notification.listener";

/**
 * Owns the `notifications` schema — see
 * docs/architecture/03-domain-boundaries.md ("Notifications"). No
 * controller yet (`NotificationLog` has no HTTP surface, mirroring
 * `SlaEscalation`'s own precedent). `TenantContext` is not provided here —
 * neither listener runs inside request scope; `SlaAtRiskNotificationListener`
 * reads `branchId` from its event payload, `TicketEscalatedNotificationListener`
 * (Story 19) has none available and leaves it `null` (see that file's own
 * doc comment). Neither listener imports `TicketsModule`/`SlaPoliciesModule`
 * — only their event contracts (`tickets.events.ts`/`sla-detection.events.ts`),
 * the same plain-TypeScript-import pattern every existing cross-module
 * listener in this codebase already uses.
 */
@Module({
  providers: [SlaAtRiskNotificationListener, TicketEscalatedNotificationListener],
})
export class NotificationsModule {}
