import { Injectable, NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { NextFunction, Request, Response } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import type { EnvConfig } from "../config/env.validation";

/**
 * Decodes the access token (if present) and attaches its branch/department
 * claims to the request as `tenantClaims`, so `TenantContext` (a
 * request-scoped provider) can expose them to services via DI.
 *
 * Express middleware runs before Nest guards, so this is intentionally
 * independent of `AuthGuard`: an invalid/missing token here just leaves
 * `tenantClaims` unset — it does NOT reject the request. `AuthGuard` (which
 * runs afterwards, as a Passport strategy) is the only place a request is
 * actually rejected for being unauthenticated. This means the token is
 * decoded twice per authenticated request (once here, once in the Passport
 * strategy); that duplication is deliberate — it keeps tenant-context
 * resolution decoupled from the auth/authorization pipeline rather than
 * threading one through the other.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const token = this.extractToken(req);
    if (token) {
      try {
        const claims = this.jwtService.verify<JwtAccessTokenClaims>(token, {
          secret: this.configService.get("JWT_ACCESS_SECRET", { infer: true }),
        });
        req.tenantClaims = {
          userId: claims.sub,
          branchId: claims.branchId,
          departmentId: claims.departmentId,
          roles: claims.roles,
        };
      } catch {
        // Invalid/expired token: leave tenantClaims unset. AuthGuard rejects
        // the request later if the route requires authentication.
      }
    }
    next();
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      return header.slice("Bearer ".length);
    }
    return null;
  }
}
