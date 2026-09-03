import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { ReportDateRangeQueryDto } from "./dto/report-date-range-query.dto";
import { toCsv } from "./report-csv.util";
import type { CsvColumn } from "./report-csv.util";
import type {
  AgentPerformanceSummary,
  AiUsageByFeature,
  AiUsageSummary,
  CsatSummary,
  ResolutionTimeSummary,
  SlaComplianceSummary,
  TicketAgingBucket,
  TicketVolumeByStatus,
} from "./reporting.service";
import { ReportingService } from "./reporting.service";

const TICKET_VOLUME_COLUMNS: Array<CsvColumn<TicketVolumeByStatus>> = [
  { key: "status", header: "Status" },
  { key: "count", header: "Count" },
];

const SLA_COMPLIANCE_COLUMNS: Array<CsvColumn<SlaComplianceSummary>> = [
  { key: "totalWithTarget", header: "Total With Target" },
  { key: "breachedCount", header: "Breached Count" },
  { key: "compliantCount", header: "Compliant Count" },
  { key: "complianceRate", header: "Compliance Rate" },
];

const CSAT_COLUMNS: Array<CsvColumn<CsatSummary>> = [
  { key: "responseCount", header: "Response Count" },
  { key: "averageRating", header: "Average Rating" },
];

const AGENT_PERFORMANCE_COLUMNS: Array<CsvColumn<AgentPerformanceSummary>> = [
  { key: "userId", header: "User ID" },
  { key: "fullName", header: "Full Name" },
  { key: "openCount", header: "Open Count" },
  { key: "resolvedCount", header: "Resolved Count" },
];

const TICKET_AGING_COLUMNS: Array<CsvColumn<TicketAgingBucket>> = [
  { key: "bucket", header: "Age Bucket" },
  { key: "count", header: "Count" },
];

const RESOLUTION_TIME_COLUMNS: Array<CsvColumn<ResolutionTimeSummary>> = [
  { key: "resolvedCount", header: "Resolved Count" },
  { key: "averageResolutionMs", header: "Average Resolution (ms)" },
];

const AI_USAGE_COLUMNS: Array<CsvColumn<AiUsageByFeature>> = [
  { key: "feature", header: "Feature" },
  { key: "callCount", header: "Call Count" },
  { key: "successCount", header: "Success Count" },
  { key: "errorCount", header: "Error Count" },
  { key: "totalInputTokens", header: "Total Input Tokens" },
  { key: "totalOutputTokens", header: "Total Output Tokens" },
  { key: "totalCostUsd", header: "Total Cost (USD)" },
];

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
 * omitted reproduces each route's exact pre-Story-93 response.
 *
 * Story 99 — `GET /reports/resolution-time` added the same way; no new
 * permission (reuses `report:read`).
 *
 * Story 121 — `GET /reports/ai-usage` added the same way; no new
 * permission (reuses `report:read`).
 *
 * Story 125 — Reporting Export. Every report above gains a sibling
 * `GET /reports/<name>/export` route (a dedicated sub-route, not a
 * `?format=csv` query param on the existing route — the JSON routes'
 * strongly-typed return values stay untouched) that calls the exact same
 * `ReportingService` method as its JSON sibling — no duplicated data-
 * fetching or filtering logic — then serializes the result via the shared
 * `toCsv` util (`report-csv.util.ts`) and writes it directly via `@Res()`,
 * mirroring `MetricsController.getMetrics`'s and this module's own sibling
 * `TicketsController.getCsat`'s existing "drop to `@Res()` for a non-JSON
 * response" precedent — no new response-handling mechanism. CSV only (no
 * PDF/XLSX): every report here is a small, bounded aggregate, and no new
 * binary/native dependency is warranted for this Story. Reuses `report:read`
 * — an export is the same data the caller can already read via the JSON
 * route, just serialized differently. Buffered, not streamed: every
 * report's row count is inherently small (per-status/per-agent/per-bucket/
 * per-feature counts, never a raw ticket-row dump).
 *
 * `AiUsageSummary` has no single natural row shape (it's one summary object
 * nesting a `byFeature[]` breakdown) — its export serializes `byFeature`,
 * the report's actual tabular data (mirrors the frontend's own rendering:
 * `ReportsView` already renders `byFeature` as a per-row table under the
 * summary totals), not the outer summary object.
 */
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

  @Get("ticket-volume/export")
  @RequirePermissions("report:read")
  async exportTicketVolume(
    @Query() { from, to }: ReportDateRangeQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const rows = await this.reportingService.getTicketVolumeByStatus(from, to);
    sendCsv(response, "ticket-volume", from, to, toCsv(rows, TICKET_VOLUME_COLUMNS));
  }

  @Get("sla-compliance")
  @RequirePermissions("report:read")
  getSlaCompliance(@Query() { from, to }: ReportDateRangeQueryDto): Promise<SlaComplianceSummary> {
    return this.reportingService.getSlaCompliance(from, to);
  }

  @Get("sla-compliance/export")
  @RequirePermissions("report:read")
  async exportSlaCompliance(
    @Query() { from, to }: ReportDateRangeQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const summary = await this.reportingService.getSlaCompliance(from, to);
    sendCsv(response, "sla-compliance", from, to, toCsv([summary], SLA_COMPLIANCE_COLUMNS));
  }

  @Get("csat")
  @RequirePermissions("report:read")
  getCsat(@Query() { from, to }: ReportDateRangeQueryDto): Promise<CsatSummary> {
    return this.reportingService.getCsatSummary(from, to);
  }

  @Get("csat/export")
  @RequirePermissions("report:read")
  async exportCsat(
    @Query() { from, to }: ReportDateRangeQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const summary = await this.reportingService.getCsatSummary(from, to);
    sendCsv(response, "csat", from, to, toCsv([summary], CSAT_COLUMNS));
  }

  @Get("agent-performance")
  @RequirePermissions("report:read")
  getAgentPerformance(
    @Query() { from, to }: ReportDateRangeQueryDto,
  ): Promise<AgentPerformanceSummary[]> {
    return this.reportingService.getAgentPerformance(from, to);
  }

  @Get("agent-performance/export")
  @RequirePermissions("report:read")
  async exportAgentPerformance(
    @Query() { from, to }: ReportDateRangeQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const rows = await this.reportingService.getAgentPerformance(from, to);
    sendCsv(response, "agent-performance", from, to, toCsv(rows, AGENT_PERFORMANCE_COLUMNS));
  }

  @Get("ticket-aging")
  @RequirePermissions("report:read")
  getTicketAging(@Query() { from, to }: ReportDateRangeQueryDto): Promise<TicketAgingBucket[]> {
    return this.reportingService.getTicketAging(from, to);
  }

  @Get("ticket-aging/export")
  @RequirePermissions("report:read")
  async exportTicketAging(
    @Query() { from, to }: ReportDateRangeQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const rows = await this.reportingService.getTicketAging(from, to);
    sendCsv(response, "ticket-aging", from, to, toCsv(rows, TICKET_AGING_COLUMNS));
  }

  @Get("resolution-time")
  @RequirePermissions("report:read")
  getResolutionTime(
    @Query() { from, to }: ReportDateRangeQueryDto,
  ): Promise<ResolutionTimeSummary> {
    return this.reportingService.getResolutionTime(from, to);
  }

  @Get("resolution-time/export")
  @RequirePermissions("report:read")
  async exportResolutionTime(
    @Query() { from, to }: ReportDateRangeQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const summary = await this.reportingService.getResolutionTime(from, to);
    sendCsv(response, "resolution-time", from, to, toCsv([summary], RESOLUTION_TIME_COLUMNS));
  }

  @Get("ai-usage")
  @RequirePermissions("report:read")
  getAiUsage(@Query() { from, to }: ReportDateRangeQueryDto): Promise<AiUsageSummary> {
    return this.reportingService.getAiUsage(from, to);
  }

  @Get("ai-usage/export")
  @RequirePermissions("report:read")
  async exportAiUsage(
    @Query() { from, to }: ReportDateRangeQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const summary = await this.reportingService.getAiUsage(from, to);
    sendCsv(response, "ai-usage", from, to, toCsv(summary.byFeature, AI_USAGE_COLUMNS));
  }
}

/** Shared by every export route above: sets the CSV content headers and
 * writes the body. `filename` encodes the report name and the requested
 * range (`<report>-<from>_<to>.csv`, or `<report>-all.csv` when no range
 * was given) — deterministic and human-readable, mirroring the same
 * `from`/`to` semantics already surfaced by the JSON API. */
function sendCsv(
  response: Response,
  reportName: string,
  from: string | undefined,
  to: string | undefined,
  csv: string,
): void {
  const rangeSuffix = from || to ? `${from ?? "start"}_${to ?? "end"}` : "all";
  const filename = `${reportName}-${rangeSuffix}.csv`;
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.send(csv);
}
