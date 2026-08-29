import { SetMetadata } from "@nestjs/common";

export const IS_PORTAL_ROUTE_KEY = "isPortalRoute";

/**
 * Story 52 — marks a route as belonging to the Customer Portal surface:
 * `AudienceGuard` requires `audience === "customer"` on a route marked this
 * way, and `audience === "agent"` on every other authenticated route. See
 * `audience.guard.ts`.
 */
export const PortalRoute = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PORTAL_ROUTE_KEY, true);
