import { Module } from "@nestjs/common";
import { AuthModule } from "../../common/auth/auth.module";
import { IdentityController } from "./identity.controller";
import { IdentityService } from "./identity.service";

/**
 * Owns branches/departments/users/roles/permissions AND the auth endpoints
 * (login/refresh/logout/me) — see docs/architecture/03-domain-boundaries.md
 * ("Identity & Access"). `AuthModule` (in `common/`) only provides the
 * cross-cutting Passport/JWT plumbing every module relies on; the actual
 * account/session logic lives here.
 */
@Module({
  imports: [AuthModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
