import { Module } from "@nestjs/common";
import { AuthModule } from "../../common/auth/auth.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";

/**
 * Story 52 — the Customer Portal's first module. `AuthModule` provides the
 * `JwtService` this module signs/verifies **access** tokens with (the same
 * pattern `IdentityModule` already uses) — refresh tokens are hashed
 * directly in `PortalService` with a separate secret, exactly like
 * `IdentityService`'s own refresh-token mechanism.
 */
@Module({
  imports: [AuthModule],
  controllers: [PortalController],
  providers: [PortalService],
  exports: [PortalService],
})
export class PortalModule {}
