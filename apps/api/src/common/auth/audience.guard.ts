import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { CanActivate } from "@nestjs/common";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { IS_PORTAL_ROUTE_KEY } from "./portal-route.decorator";

/**
 * Story 52 — registered globally alongside `AuthGuard`/`PermissionsGuard`
 * (see `app.module.ts`), immediately after `AuthGuard` (whose Passport
 * strategy populates `request.user`) and before `PermissionsGuard` (whose
 * permission-key check is orthogonal to this one). A route marked
 * `@PortalRoute()` requires `audience === "customer"`; every other
 * authenticated route — the entire pre-existing agent-facing surface,
 * unchanged — requires `audience === "agent"`. A request with no
 * `request.user` (an unauthenticated `@Public()` route) passes through
 * untouched: `AuthGuard` is what rejects those, not this guard.
 */
@Injectable()
export class AudienceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtAccessTokenClaims | undefined;
    if (!user) {
      return true;
    }

    const isPortalRoute = this.reflector.getAllAndOverride<boolean>(IS_PORTAL_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredAudience = isPortalRoute ? "customer" : "agent";

    if (user.audience !== requiredAudience) {
      throw new UnauthorizedException("Token audience not accepted on this surface");
    }
    return true;
  }
}
