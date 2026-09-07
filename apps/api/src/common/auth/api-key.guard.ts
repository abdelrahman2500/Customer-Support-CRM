import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { CanActivate } from "@nestjs/common";
import type { Request } from "express";
import type { ApiKey } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiKeyHasher } from "../../modules/integrations/api-key-hash";
import { ALLOW_API_KEY_KEY } from "./allow-api-key.decorator";
import { API_KEY_SCOPES_KEY } from "./require-api-key-scope.decorator";

/** Augment Express's Request with the field this guard attaches, mirroring
 * `TenantContext`'s own `declare module "express"` precedent — a route
 * handler or service that needs the authenticated key itself (not just its
 * `tenantClaims` projection) can read this directly. */
declare module "express" {
  interface Request {
    apiKey?: ApiKey;
  }
}

/**
 * RM-22 — registered globally alongside `AuthGuard`/`AudienceGuard`/
 * `PermissionsGuard` (see `app.module.ts`), immediately after
 * `PermissionsGuard`. Two responsibilities, mirroring `PermissionsGuard`'s
 * own "resolve, then check" shape:
 *
 * 1. On a route with no `@AllowApiKey()` — including every existing route
 *    in this application — this guard is a complete no-op, `return true`
 *    immediately. It never rejects a request `AuthGuard`/`PermissionsGuard`
 *    would otherwise have accepted, and never runs a query for one.
 * 2. On an `@AllowApiKey()` route: if `AuthGuard`'s own JWT strategy
 *    already authenticated this request (`request.user` set), this guard
 *    is a no-op too — JWT auth on this route works exactly as it always
 *    has. Only when JWT auth did NOT succeed does this guard actually
 *    authenticate the bearer token as an API key (hash → look up → check
 *    revoked/expired → check `@RequireApiKeyScope`), and it is the ONLY
 *    place that happens.
 *
 * On success, populates `request.tenantClaims` in exactly the shape
 * `TenantMiddleware` would have populated it from a JWT
 * (`userId`/`branchId`/`departmentId`/`roles`) — this is the mechanism
 * that keeps every existing branch-scoped service (`TenantContext.
 * requireBranchScope()`) working unchanged for an API-key-authenticated
 * request, and the reason an API key can never read or write outside its
 * own `branchId`: that value is resolved once, here, from the durable
 * `ApiKey` row itself, never from anything the caller supplies. `roles: []`
 * is deliberate — an API key has no roles, and no route reachable via
 * `@AllowApiKey()` may also declare `@RequirePermissions(...)` (that
 * guard's own role-based check would find no roles and reject); scope
 * enforcement for API-key routes is this guard's own job instead.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly apiKeyHasher: ApiKeyHasher,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowsApiKey = this.reflector.getAllAndOverride<boolean>(ALLOW_API_KEY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowsApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (request.user) {
      // Already authenticated via a real JWT — nothing for this guard to do.
      return true;
    }

    const rawKey = this.extractBearerToken(request);
    if (!rawKey) {
      throw new UnauthorizedException("Missing credentials");
    }

    const hashedKey = this.apiKeyHasher.hash(rawKey);
    const apiKey = await this.prisma.apiKey.findUnique({ where: { hashedKey } });
    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException("Invalid or revoked API key");
    }
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("API key has expired");
    }

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!requiredScopes.every((scope) => apiKey.scopes.includes(scope))) {
      throw new ForbiddenException("Missing required API key scope");
    }

    request.apiKey = apiKey;
    request.tenantClaims = {
      userId: apiKey.createdByUserId,
      branchId: apiKey.branchId,
      departmentId: null,
      roles: [],
    };

    // Best-effort — never blocks or fails the request it's observing,
    // mirroring `AuditInterceptor`'s own "logging must never break the
    // request" convention.
    void this.prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      return header.slice("Bearer ".length);
    }
    return null;
  }
}
