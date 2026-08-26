import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { SlaPoliciesController } from "./sla-policies.controller";
import { SlaPoliciesService } from "./sla-policies.service";

/**
 * Owns the `sla` schema — see docs/architecture/03-domain-boundaries.md
 * ("SLA & Automation"). `TenantContext` is provided here the same way
 * `CustomersModule`/`TicketsModule` provide it.
 */
@Module({
  controllers: [SlaPoliciesController],
  providers: [SlaPoliciesService, TenantContext],
  exports: [SlaPoliciesService],
})
export class SlaPoliciesModule {}
