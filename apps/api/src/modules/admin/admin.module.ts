import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AuditLogsController } from "./audit-logs.controller";
import { AuditLogsService } from "./audit-logs.service";

/**
 * Owns the `admin` schema's HTTP surface — see
 * docs/architecture/03-domain-boundaries.md. `AuditLog` itself (the model)
 * has existed since Story 02, written only by the globally-registered
 * `AuditInterceptor` (`common/audit/audit.interceptor.ts`, unchanged by
 * this story). Story 37 adds this module purely to expose a read-only
 * `GET /audit-logs` over that already-populated table — `TenantContext` is
 * provided here the same way every other feature module provides it (see
 * `CustomersModule`'s own doc comment).
 */
@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, TenantContext],
})
export class AdminModule {}
