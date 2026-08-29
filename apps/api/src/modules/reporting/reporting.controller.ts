import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type { CsatSummary, SlaComplianceSummary, TicketVolumeByStatus } from "./reporting.service";
import { ReportingService } from "./reporting.service";

/** Story 56 — Reporting & Analytics Foundation. Every route is read-only,
 * gated by the new `report:read` permission, and branch-scoped exactly like
 * `AuditLogsController`. Three separate, focused endpoints rather than one
 * combined payload — mirrors this codebase's existing convention of one
 * endpoint per concern (`sla-target`/`sla-escalations`/`notes`/`csat` as
 * separate `Ticket` sub-resources). */
@ApiTags("reporting")
@ApiBearerAuth()
@Controller("reports")
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get("ticket-volume")
  @RequirePermissions("report:read")
  getTicketVolume(): Promise<TicketVolumeByStatus[]> {
    return this.reportingService.getTicketVolumeByStatus();
  }

  @Get("sla-compliance")
  @RequirePermissions("report:read")
  getSlaCompliance(): Promise<SlaComplianceSummary> {
    return this.reportingService.getSlaCompliance();
  }

  @Get("csat")
  @RequirePermissions("report:read")
  getCsat(): Promise<CsatSummary> {
    return this.reportingService.getCsatSummary();
  }
}
