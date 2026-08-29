import { Module } from "@nestjs/common";
import { AuthModule } from "../../common/auth/auth.module";
import { TicketsModule } from "../tickets/tickets.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";
import { PortalTicketsController } from "./portal-tickets.controller";
import { PortalTicketsService } from "./portal-tickets.service";

/**
 * Story 52 — the Customer Portal's first module. `AuthModule` provides the
 * `JwtService` this module signs/verifies **access** tokens with (the same
 * pattern `IdentityModule` already uses) — refresh tokens are hashed
 * directly in `PortalService` with a separate secret, exactly like
 * `IdentityService`'s own refresh-token mechanism.
 *
 * Story 53 — `TicketsModule` imported so `PortalTicketsService` can inject
 * the already-exported `TicketsService` directly (see that service's
 * additive, customer-scoped methods) rather than reimplementing ticket
 * creation/lookup.
 */
@Module({
  imports: [AuthModule, TicketsModule],
  controllers: [PortalController, PortalTicketsController],
  providers: [PortalService, PortalTicketsService],
  exports: [PortalService],
})
export class PortalModule {}
