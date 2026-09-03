import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AiModule } from "../ai/ai.module";
import { ChannelsModule } from "../channels/channels.module";
import { CustomersModule } from "../customers/customers.module";
import { QueuesModule } from "../../queues/queues.module";
import { AutomationActionListener } from "./automation-action.listener";
import { TicketAiService } from "./ticket-ai.service";
import { TicketCategoriesController } from "./ticket-categories.controller";
import { TicketCategoriesService } from "./ticket-categories.service";
import { TicketChannelService } from "./ticket-channel.service";
import { TicketEscalationListener } from "./ticket-escalation.listener";
import { TicketHistoryListener } from "./ticket-history.listener";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { WebFormIntakeController } from "./web-form-intake.controller";
import { WebFormIntakeService } from "./web-form-intake.service";

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
 *
 * Story 77 — `ChannelsModule` imported the same way, so
 * `TicketChannelService` can inject the already-exported
 * `ChannelMessagesService` directly. `TicketChannelService` is also
 * exported (unlike `TicketAiService`, which has no cross-module caller
 * yet) — `PortalModule`'s `PortalTicketsService` calls its customer-scoped
 * methods directly, mirroring how it already calls `TicketsService`'s own
 * customer-scoped methods.
 *
 * Story 87 — `CustomersModule` imported the same way, so the new
 * `WebFormIntakeService` can inject the already-exported
 * `CustomersService` directly. `WebFormIntakeController`/`Service` are the
 * first fully public (`@Public()`, no `TenantContext`) surface on this
 * module — see `web-form-intake.controller.ts`'s own doc comment.
 *
 * Story 120 — `TicketCategoriesController`/`Service` added the same way
 * `Department` CRUD lives in `IdentityModule`: pure branch-scoped CRUD,
 * no cross-module reactions, registered here because `TicketCategory` is
 * owned by the `ticketing` schema.
 */
@Module({
  imports: [AiModule, ChannelsModule, CustomersModule, QueuesModule],
  controllers: [TicketsController, TicketCategoriesController, WebFormIntakeController],
  providers: [
    TicketsService,
    TenantContext,
    TicketHistoryListener,
    TicketEscalationListener,
    AutomationActionListener,
    TicketAiService,
    TicketCategoriesService,
    TicketChannelService,
    WebFormIntakeService,
  ],
  exports: [TicketsService, TicketChannelService],
})
export class TicketsModule {}
