import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

/**
 * Owns the `ticketing` schema — see docs/architecture/03-domain-boundaries.md
 * ("Ticketing"). `TenantContext` is provided here the same way
 * `CustomersModule` provides it — it has no dependencies beyond the ambient
 * `REQUEST` token, so nothing stops it being provided in more than one module.
 */
@Module({
  controllers: [TicketsController],
  providers: [TicketsService, TenantContext],
  exports: [TicketsService],
})
export class TicketsModule {}
