import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";

/**
 * Story 56 — Reporting & Analytics Foundation
 * (docs/architecture/08-supporting-domains.md). No new schema/model, no
 * worker job — see `ReportingService`'s own doc comment. `TenantContext`
 * provided here the same way every other feature module provides it
 * (mirrors `NotificationsModule`).
 */
@Module({
  controllers: [ReportingController],
  providers: [ReportingService, TenantContext],
})
export class ReportingModule {}
