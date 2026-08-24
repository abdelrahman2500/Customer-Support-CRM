import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { CanActivate } from "@nestjs/common";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { PERMISSIONS_KEY } from "./require-permissions.decorator";

/**
 * Registered globally alongside `AuthGuard` (see `app.module.ts`) — a route
 * with no `@RequirePermissions()` metadata is allowed through unchanged;
 * `AuthGuard` having already run is what makes `request.user` available here.
 *
 * See docs/architecture/05-auth-and-security.md. CASL is called out there
 * for the finer-grained, per-record checks (e.g. "only within my
 * department") that a flat permission-key list can't express — those are
 * added by the feature modules that need them, on top of this guard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtAccessTokenClaims | undefined;
    if (!user) {
      // AuthGuard should already have rejected this; treat as forbidden defensively.
      return false;
    }

    const granted = await this.prisma.permission.findMany({
      where: { roles: { some: { role: { name: { in: user.roles } } } } },
      select: { key: true },
    });
    const grantedKeys = new Set(granted.map((p) => p.key));
    const hasAll = required.every((key) => grantedKeys.has(key));

    if (!hasAll) {
      throw new ForbiddenException("Missing required permission");
    }
    return true;
  }
}
