import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { SlaPoliciesController } from "./sla-policies.controller";
import { SlaPoliciesService } from "./sla-policies.service";
import { SlaEscalationListener } from "./sla-escalation.listener";
import { SlaTargetListener } from "./sla-target.listener";
import { SlaTargetsController } from "./sla-targets.controller";
import { SlaTargetsService } from "./sla-targets.service";
import { BusinessHoursCalendarsController } from "./business-hours-calendars.controller";
import { BusinessHoursCalendarsService } from "./business-hours-calendars.service";

/**
 * Owns the `sla` schema — see docs/architecture/03-domain-boundaries.md
 * ("SLA & Automation"). `TenantContext` is provided here the same way
 * `CustomersModule`/`TicketsModule` provide it. `SlaTargetListener`'s
 * `@OnEvent` handler is discovered automatically by `EventEmitterModule`
 * once the class is instantiated as a provider here — the same pattern
 * `TicketsModule` uses for `TicketHistoryListener`. `BusinessHoursCalendars*`
 * (Story 12) is added here rather than a new module, continuing the same
 * "grow this module per `sla`-schema concern" pattern Story 11 already used
 * for `SlaTargets*`.
 */
@Module({
  controllers: [SlaPoliciesController, SlaTargetsController, BusinessHoursCalendarsController],
  providers: [
    SlaPoliciesService,
    SlaTargetsService,
    BusinessHoursCalendarsService,
    TenantContext,
    SlaTargetListener,
    SlaEscalationListener,
  ],
  exports: [SlaPoliciesService, SlaTargetsService, BusinessHoursCalendarsService],
})
export class SlaPoliciesModule {}
