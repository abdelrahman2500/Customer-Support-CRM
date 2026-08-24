import { Inject, Injectable, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { Request } from "express";

/**
 * Populated by `TenantMiddleware` (see ./tenant.middleware.ts) from the
 * validated access-token claims. Every module that reads/writes a
 * branch/department-scoped table injects this instead of trusting a
 * client-supplied branch id.
 *
 * See docs/architecture/04-data-and-multitenancy.md ("Enforcement: TenantContext").
 */
export interface TenantClaims {
  userId: string;
  branchId: string | null;
  departmentId: string | null;
  roles: string[];
}

/** Augment Express's Request with the field `TenantMiddleware` attaches. */
declare module "express" {
  interface Request {
    tenantClaims?: TenantClaims;
  }
}

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  get userId(): string | null {
    return this.request.tenantClaims?.userId ?? null;
  }

  get branchId(): string | null {
    return this.request.tenantClaims?.branchId ?? null;
  }

  get departmentId(): string | null {
    return this.request.tenantClaims?.departmentId ?? null;
  }

  get roles(): string[] {
    return this.request.tenantClaims?.roles ?? [];
  }

  get isAuthenticated(): boolean {
    return this.request.tenantClaims !== undefined;
  }

  /**
   * Repositories/services call this to build a Prisma `where` fragment that
   * scopes a query to the active branch (and department, when relevant),
   * so a scoped table can never be queried without it.
   *
   * Feature stories that add branch-scoped tables use this rather than
   * hand-rolling `branchId` filters at each call site.
   */
  requireBranchScope(): { branchId: string } {
    if (!this.branchId) {
      throw new Error("TenantContext: no active branch on this request");
    }
    return { branchId: this.branchId };
  }
}
