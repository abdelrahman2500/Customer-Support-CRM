import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { SlaPoliciesController } from "./sla-policies.controller";
import { SlaPoliciesService } from "./sla-policies.service";
import { SlaTargetListener } from "./sla-target.listener";
import { SlaTargetsController } from "./sla-targets.controller";
import { SlaTargetsService } from "./sla-targets.service";

/**
 * Owns the `sla` schema — see docs/architecture/03-domain-boundaries.md
 * ("SLA & Automation"). `TenantContext` is provided here the same way
 * `CustomersModule`/`TicketsModule` provide it. `SlaTargetListener`'s
 * `@OnEvent` handler is discovered automatically by `EventEmitterModule`
 * once the class is instantiated as a provider here — the same pattern
 * `TicketsModule` uses for `TicketHistoryListener`.
 */
@Module({
  controllers: [SlaPoliciesController, SlaTargetsController],
  providers: [SlaPoliciesService, SlaTargetsService, TenantContext, SlaTargetListener],
  exports: [SlaPoliciesService, SlaTargetsService],
})
export class SlaPoliciesModule {}
