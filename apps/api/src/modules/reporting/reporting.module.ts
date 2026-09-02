import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";

/**
 * Story 56 — Reporting & Analytics Foundation
 * (docs/architecture/08-supporting-domains.md). No new schema/model, no
 * worker job — see `ReportingService`'s own doc comment. `TenantContext`
 * provided here the same way every other feature module provides it
 * (mirrors `NotificationsModule`).
 *
 * Story 110 — `DashboardsController`/`DashboardsService` (saved
 * dashboards) added alongside, not in a new module — same domain,
 * mirrors `QuickRepliesController`/`QuickRepliesService`'s own precedent
 * of a second controller-facing resource inside an existing module.
 */
@Module({
  controllers: [ReportingController, DashboardsController],
  providers: [ReportingService, DashboardsService, TenantContext],
})
export class ReportingModule {}
