import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AuditLogsController } from "./audit-logs.controller";
import { AuditLogsService } from "./audit-logs.service";
import { BrandingController } from "./branding.controller";
import { BrandingService } from "./branding.service";

/**
 * Owns the `admin` schema's HTTP surface — see
 * docs/architecture/03-domain-boundaries.md. `AuditLog` itself (the model)
 * has existed since Story 02, written only by the globally-registered
 * `AuditInterceptor` (`common/audit/audit.interceptor.ts`, unchanged by
 * this story). Story 37 adds this module purely to expose a read-only
 * `GET /audit-logs` over that already-populated table — `TenantContext` is
 * provided here the same way every other feature module provides it (see
 * `CustomersModule`'s own doc comment).
 *
 * Story 62 — `Branding*` added the same way, growing this module's HTTP
 * surface for the "branding" piece of Administration's documented scope.
 *
 * Story 82 — `BrandingService` exported so `PortalModule`'s
 * `PortalBrandingController` can inject it directly, mirroring how
 * `AiModule` exports `AiChatService` for `PortalChatController`.
 */
@Module({
  controllers: [AuditLogsController, BrandingController],
  providers: [AuditLogsService, BrandingService, TenantContext],
  exports: [BrandingService],
})
export class AdminModule {}
