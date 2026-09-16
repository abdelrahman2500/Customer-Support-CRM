import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { MachineReportingController } from "./machine-reporting.controller";

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
 *
 * Story 133 — `MachineReportingController` added as a third controller in
 * the same domain, following that same precedent. It needs no provider of
 * its own: it reuses the `ReportingService` and `TenantContext` already
 * provided here, which is the whole point — the machine surface runs the
 * same query, through the same branch scoping, as the human one. See that
 * controller's own doc comment for why it exists separately from
 * `ReportingController` rather than as a decorator on its routes.
 */
@Module({
  controllers: [ReportingController, DashboardsController, MachineReportingController],
  providers: [ReportingService, DashboardsService, TenantContext],
})
export class ReportingModule {}
