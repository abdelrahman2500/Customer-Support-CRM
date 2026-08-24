import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../../prisma/prisma.service";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Registered globally (see `app.module.ts`, `APP_INTERCEPTOR`) per
 * docs/architecture/05-auth-and-security.md ("Audit logging"): every
 * mutating request is recorded to the append-only `admin.audit_logs` table.
 *
 * This is intentionally coarse for the foundation story — it logs
 * "who did what to which route", not a semantic before/after diff, since
 * there is no domain entity yet to diff. Feature modules that need a real
 * before/after `diff` (permission grants, exports, bulk operations) call
 * `PrismaService.auditLog.create(...)` explicitly from their own service,
 * as documented in docs/architecture/05-auth-and-security.md.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const user = request.user as JwtAccessTokenClaims | undefined;
        this.prisma.auditLog
          .create({
            data: {
              actorId: user?.sub ?? null,
              action: `${request.method} ${request.route?.path ?? request.path}`,
              entityType: "http_request",
              branchId: user?.branchId ?? null,
              ipAddress: request.ip ?? null,
            },
          })
          .catch((error: unknown) => {
            // Audit logging must never break the request it's observing.
            this.logger.error("Failed to write audit log", error);
          });
      }),
    );
  }
}
