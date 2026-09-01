import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { ReportDateRangeQueryDto } from "./dto/report-date-range-query.dto";
import type {
  AgentPerformanceSummary,
  CsatSummary,
  SlaComplianceSummary,
  TicketAgingBucket,
  TicketVolumeByStatus,
} from "./reporting.service";
import { ReportingService } from "./reporting.service";

/** Story 56 — Reporting & Analytics Foundation. Every route is read-only,
 * gated by the new `report:read` permission, and branch-scoped exactly like
 * `AuditLogsController`. Three separate, focused endpoints rather than one
 * combined payload — mirrors this codebase's existing convention of one
 * endpoint per concern (`sla-target`/`sla-escalations`/`notes`/`csat` as
 * separate `Ticket` sub-resources).
 *
 * Story 59 — `GET /reports/agent-performance` added the same way; no new
 * permission.
 *
 * Story 60 — `GET /reports/ticket-aging` added the same way; no new
 * permission.
 *
 * Story 93 — every route gains optional `?from=&to=` (`ReportDateRangeQueryDto`),
 * forwarded straight to the corresponding `ReportingService` method. Both
 * omitted reproduces each route's exact pre-Story-93 response. */
@ApiTags("reporting")
@ApiBearerAuth()
@Controller("reports")
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get("ticket-volume")
  @RequirePermissions("report:read")
  getTicketVolume(@Query() { from, to }: ReportDateRangeQueryDto): Promise<TicketVolumeByStatus[]> {
    return this.reportingService.getTicketVolumeByStatus(from, to);
  }

  @Get("sla-compliance")
  @RequirePermissions("report:read")
  getSlaCompliance(@Query() { from, to }: ReportDateRangeQueryDto): Promise<SlaComplianceSummary> {
    return this.reportingService.getSlaCompliance(from, to);
  }

  @Get("csat")
  @RequirePermissions("report:read")
  getCsat(@Query() { from, to }: ReportDateRangeQueryDto): Promise<CsatSummary> {
    return this.reportingService.getCsatSummary(from, to);
  }

  @Get("agent-performance")
  @RequirePermissions("report:read")
  getAgentPerformance(
    @Query() { from, to }: ReportDateRangeQueryDto,
  ): Promise<AgentPerformanceSummary[]> {
    return this.reportingService.getAgentPerformance(from, to);
  }

  @Get("ticket-aging")
  @RequirePermissions("report:read")
  getTicketAging(@Query() { from, to }: ReportDateRangeQueryDto): Promise<TicketAgingBucket[]> {
    return this.reportingService.getTicketAging(from, to);
  }
}
