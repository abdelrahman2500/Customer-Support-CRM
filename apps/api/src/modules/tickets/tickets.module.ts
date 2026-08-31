import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AiModule } from "../ai/ai.module";
import { QueuesModule } from "../../queues/queues.module";
import { AutomationActionListener } from "./automation-action.listener";
import { TicketAiService } from "./ticket-ai.service";
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
 *
 * Story 73 — `AiModule` imported so `TicketAiService` can inject the
 * already-exported `AiGatewayService` directly, mirroring exactly how
 * `PortalModule` imports `TicketsModule`/`KnowledgeBaseModule` for its own
 * composing services.
 *
 * Story 76 — `QueuesModule` imported the same way, so `TicketAiService`
 * can inject the already-exported `AiProcessingProducer` directly.
 */
@Module({
  imports: [AiModule, QueuesModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TenantContext,
    TicketHistoryListener,
    TicketEscalationListener,
    AutomationActionListener,
    TicketAiService,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
