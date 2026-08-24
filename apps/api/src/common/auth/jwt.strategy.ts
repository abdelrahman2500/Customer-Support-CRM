import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtAccessTokenClaims } from "@crm/shared";
import type { EnvConfig } from "../config/env.validation";

/**
 * Validates the access token on every request to a route that isn't marked
 * `@Public()`. Only the `agent` audience is issued by this story (customer
 * portal auth is a future story's `PortalModule`) — see
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
    if (payload.audience !== "agent") {
      throw new Error("Token audience not accepted on this surface");
    }
    // Whatever is returned here becomes `request.user`.
    return payload;
  }
}
