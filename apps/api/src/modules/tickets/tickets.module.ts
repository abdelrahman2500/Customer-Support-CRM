import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
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
 */
@Module({
  controllers: [TicketsController],
  providers: [TicketsService, TenantContext, TicketHistoryListener],
  exports: [TicketsService],
})
export class TicketsModule {}
