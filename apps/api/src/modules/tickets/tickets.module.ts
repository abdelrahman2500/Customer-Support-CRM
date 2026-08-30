import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AutomationActionListener } from "./automation-action.listener";
import { TicketEscalationListener } from "./ticket-escalation.listener";
import { TicketHistoryListener } from "./ticket-history.listener";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

/**
 * Owns the `ticketing` schema — see docs/architecture/03-domain-boundaries.md
 * ("Ticketing"). `TenantContext` is provided here the same way
 * `CustomersModule` provides it — it has no dependencies beyond the ambient
 * `REQUEST` token, so nothing stops it being provided in more than one module.
 * `TicketHistoryListener`'s `@OnEvent` handlers are discovered automatically
 * by `EventEmitterModule` once the class is instantiated as a provider here.
 *
 * Story 57 — `AutomationActionListener` added the same way: it reacts to
 * the SLA & Automation domain's `automation.rule_matched` but writes only
 * to this module's own `Ticket` table (mirrors `TicketEscalationListener`).
 */
@Module({
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TenantContext,
    TicketHistoryListener,
    TicketEscalationListener,
    AutomationActionListener,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
