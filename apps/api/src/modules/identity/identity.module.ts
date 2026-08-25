import { Module } from "@nestjs/common";
import { AuthModule } from "../../common/auth/auth.module";
import { TenantContext } from "../../common/tenant/tenant-context";
import { IdentityController } from "./identity.controller";
import { UsersController } from "./users.controller";
import { IdentityService } from "./identity.service";

/**
 * Owns branches/departments/users/roles/permissions AND the auth endpoints
 * (login/refresh/logout/me) — see docs/architecture/03-domain-boundaries.md
 * ("Identity & Access"). `AuthModule` (in `common/`) only provides the
 * cross-cutting Passport/JWT plumbing every module relies on; the actual
 * account/session logic lives here.
 *
 * `TenantContext` is provided here (not globally) since this is currently
 * its only consumer (`IdentityService.listUsers`) — see
 * docs/architecture/04-data-and-multitenancy.md. Any future module that
 * needs it can list it in its own `providers` array the same way; it has no
 * dependencies beyond the ambient `REQUEST` token, so nothing stops it being
 * provided in more than one module.
 */
@Module({
  imports: [AuthModule],
  controllers: [IdentityController, UsersController],
  providers: [IdentityService, TenantContext],
  exports: [IdentityService],
})
export class IdentityModule {}
