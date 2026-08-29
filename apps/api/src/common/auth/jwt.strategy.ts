import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtAccessTokenClaims } from "@crm/shared";
import type { EnvConfig } from "../config/env.validation";

/**
 * Validates the access token on every request to a route that isn't marked
 * `@Public()`. Accepts either audience — Passport's job here is only "is
 * this a validly-signed, unexpired token," not "which surface may use it."
 *
 * Story 52 — the `audience !== "agent"` rejection this class used to do
 * moved out into `AudienceGuard` (`common/auth/audience.guard.ts`), a
 * reflector-driven guard that can tell a `@PortalRoute()` from every other
 * route and enforce the right audience for each — something a Passport
 * strategy (which runs once, globally, before any route metadata is
 * available to it) cannot express. See
 * docs/architecture/05-auth-and-security.md ("audience" claim).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService<EnvConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get("JWT_ACCESS_SECRET", { infer: true }),
    });
  }

  validate(payload: JwtAccessTokenClaims): JwtAccessTokenClaims {
    // Whatever is returned here becomes `request.user`.
    return payload;
  }
}
