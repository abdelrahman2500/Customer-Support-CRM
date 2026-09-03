"use client";

import { Fragment, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  useAgentPerformanceQuery,
  useAiUsageQuery,
  useCreateDashboardMutation,
  useCsatSummaryQuery,
  useDashboardsQuery,
  useDeleteDashboardMutation,
  useResolutionTimeQuery,
  useSlaComplianceQuery,
  useTicketAgingQuery,
  useTicketVolumeByCategoryQuery,
  useTicketVolumeQuery,
  useUpdateDashboardMutation,
} from "@/hooks/use-reporting";
import { downloadReportCsv } from "@/lib/reporting-api";
import type { ReportDateRange, ReportExportPath, ReportWidgetType } from "@/lib/reporting-api";
import { ApiError } from "@/lib/api";
import { formatRemaining } from "@/lib/sla";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/** Every existing report, in the same order this screen has always shown
 * them — also the "All reports" default and the widget set a brand-new
 * "save current view" dashboard is created with. */
const ALL_WIDGET_TYPES: ReportWidgetType[] = [
  "TICKET_VOLUME",
  "SLA_COMPLIANCE",
  "CSAT",
  "AGENT_PERFORMANCE",
  "TICKET_AGING",
  "RESOLUTION_TIME",
  "AI_USAGE",
  "TICKET_VOLUME_BY_CATEGORY",
];

/** Story 121 — no currency-formatting precedent exists anywhere else in
 * this codebase (Recon finding), so this is a small, local helper rather
 * than a new shared `lib` module for a single caller. Renders as e.g.
 * "$0.0034" — AI per-call costs are routinely sub-cent, so a fixed 2-decimal
 * `Intl.NumberFormat` "currency" style would round every real value to
 * "$0.00"; 4 decimals is the smallest fixed precision that still shows a
 * typical single Claude call's cost as a nonzero number. */
function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount);
}

/**
 * Story 56 — Reporting & Analytics Foundation. Independent cards over
 * `GET /reports/ticket-volume`, `/reports/sla-compliance`, `/reports/csat` —
 * each with its own loading/forbidden/generic-error/populated state, so one
 * query's failure never blocks another's data (Design decision 9 of the
 * plan). Mirrors `AuditLogView`'s exact forbidden-vs-generic-error split;
 * no charting library exists anywhere in this codebase (Recon finding), so
 * this renders plain stat tiles, consistent with every other data screen
 * here.
 *
 * Story 59 — a fourth card, `GET /reports/agent-performance`, added the
 * same way; no permission/layout-shell change beyond widening the grid.
 *
 * Story 60 — a fifth card, `GET /reports/ticket-aging`, added the same
 * way; always renders all four fixed buckets (no "empty" state — the
 * backend already zero-fills every bucket).
 *
 * Story 93 — a single, shared `{from, to}` date-range state drives all five
 * cards at once (one dashboard-wide "view this period" control, not five
 * independent pickers — nothing in this per-card architecture disclosed a
 * need for report-specific ranges). Native `<Input type="date">` ×2
 * (mirrors `business-hours-view.tsx`'s own exact date-input pattern — no
 * new UI library) plus a Clear button resetting to `{}`, the exact
 * pre-Story-93 all-time default every hook already falls back to.
 *
 * Story 99 — a sixth card, `GET /reports/resolution-time`, added the same
 * way; shares the same date-range state. Its populated body reuses
 * `apps/web/src/lib/sla.ts`'s existing `formatRemaining(ms)` rather than a
 * new duration formatter (see that card's own comment below for why).
 *
 * Story 110 — Saved Dashboards. A picker above the grid switches between
 * "All reports" (this exact, always-available six-card view, unchanged)
 * and any dashboard the caller owns or that is shared in their branch —
 * selecting one renders only its saved widgets, in its saved order,
 * through this same `renderWidget`/`ReportCard`. No saved date range: a
 * dashboard's widgets still use this page's one shared `{from, to}`
 * control, exactly like "All reports" always has (Story 93's own explicit
 * decision against per-card independent controls).
 *
 * Story 121 — a seventh card, `GET /reports/ai-usage`, added the same
 * way; no permission/layout-shell change beyond widening "All reports."
 * Total cost plus a per-`AiFeature` breakdown, with an explicit caveat
 * when some successful calls used an unpriced/unrecognized model (see
 * `AiUsageSummary.unpricedCallCount`'s own doc comment).
 *
 * Story 126 — an eighth card, `GET /reports/ticket-volume-by-category`,
 * added the same way. The backend's `categoryId: null` row (a real ticket
 * cohort — "no category assigned" — not a value with nothing to display)
 * renders with this screen's own localized `ticketVolumeByCategory.
 * uncategorized` label rather than the raw `null`.
 */
export function ReportsView() {
  const t = useTranslations("reporting");
  const [range, setRange] = useState<ReportDateRange>({});
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardShared, setNewDashboardShared] = useState(false);
  // Deleting a saved dashboard is irreversible and — when shared — removes it
  // for the whole branch, so it goes through the same `ConfirmDialog` gate
  // every other destructive action in this app already uses (Story 94).
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const ticketVolumeQuery = useTicketVolumeQuery(range);
  const slaComplianceQuery = useSlaComplianceQuery(range);
  const csatQuery = useCsatSummaryQuery(range);
  const agentPerformanceQuery = useAgentPerformanceQuery(range);
  const resolutionTimeQuery = useResolutionTimeQuery(range);
  const ticketAgingQuery = useTicketAgingQuery(range);
  const aiUsageQuery = useAiUsageQuery(range);
  const ticketVolumeByCategoryQuery = useTicketVolumeByCategoryQuery(range);

  const dashboardsQuery = useDashboardsQuery();
  const createDashboardMutation = useCreateDashboardMutation();
  const updateDashboardMutation = useUpdateDashboardMutation(selectedDashboardId ?? "");
  const deleteDashboardMutation = useDeleteDashboardMutation();

  const dashboards = dashboardsQuery.data ?? [];
  const selectedDashboard = dashboards.find((dashboard) => dashboard.id === selectedDashboardId);
  const widgetTypesToRender = selectedDashboard
    ? selectedDashboard.widgets.map((widget) => widget.widgetType)
    : ALL_WIDGET_TYPES;

  async function handleSaveCurrentView() {
    const name = newDashboardName.trim();
    if (!name) {
      return;
    }
    const created = await createDashboardMutation.mutateAsync({
      name,
      isShared: newDashboardShared,
      widgetTypes: ALL_WIDGET_TYPES,
    });
    setSelectedDashboardId(created.id);
    setShowSaveForm(false);
    setNewDashboardName("");
    setNewDashboardShared(false);
  }

  function handleToggleShare() {
    if (!selectedDashboard) {
      return;
    }
    updateDashboardMutation.mutate({ isShared: !selectedDashboard.isShared });
  }

  async function handleDelete() {
    if (!selectedDashboard) {
      return;
    }
    await deleteDashboardMutation.mutateAsync(selectedDashboard.id);
    setShowDeleteConfirm(false);
    setSelectedDashboardId(null);
  }

  function renderWidget(widgetType: ReportWidgetType): ReactNode {
    switch (widgetType) {
      case "TICKET_VOLUME":
        return (
          <ReportCard
            heading={t("ticketVolume.heading")}
            query={ticketVolumeQuery}
            t={t}
            skeleton="list"
            exportPath="ticket-volume"
            range={range}
          >
            {ticketVolumeQuery.isSuccess && ticketVolumeQuery.data.length === 0 && (
              <p className="text-sm text-slate-500">{t("ticketVolume.empty")}</p>
            )}
            {ticketVolumeQuery.isSuccess && ticketVolumeQuery.data.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {ticketVolumeQuery.data.map((row) => (
                  <li key={row.status} className="flex items-center justify-between">
                    <span className="text-slate-600">{row.status}</span>
                    <span className="font-medium text-slate-900">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </ReportCard>
        );

      case "SLA_COMPLIANCE":
        return (
          <ReportCard
            heading={t("slaCompliance.heading")}
            query={slaComplianceQuery}
            t={t}
            skeleton="stat"
            exportPath="sla-compliance"
            range={range}
          >
            {slaComplianceQuery.isSuccess && slaComplianceQuery.data.totalWithTarget === 0 && (
              <p className="text-sm text-slate-500">{t("slaCompliance.empty")}</p>
            )}
            {slaComplianceQuery.isSuccess && slaComplianceQuery.data.totalWithTarget > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-2xl font-semibold text-slate-900">
                  {Math.round((slaComplianceQuery.data.complianceRate ?? 0) * 100)}%
                </span>
                <span className="text-slate-500">
                  {t("slaCompliance.detail", {
                    compliant: slaComplianceQuery.data.compliantCount,
                    total: slaComplianceQuery.data.totalWithTarget,
                  })}
                </span>
              </div>
            )}
          </ReportCard>
        );

      case "CSAT":
        return (
          <ReportCard
            heading={t("csat.heading")}
            query={csatQuery}
            t={t}
            skeleton="stat"
            exportPath="csat"
            range={range}
          >
            {csatQuery.isSuccess && csatQuery.data.responseCount === 0 && (
              <p className="text-sm text-slate-500">{t("csat.empty")}</p>
            )}
            {csatQuery.isSuccess && csatQuery.data.responseCount > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-2xl font-semibold text-slate-900">
                  {csatQuery.data.averageRating?.toFixed(1)}/5
                </span>
                <span className="text-slate-500">
                  {t("csat.detail", { count: csatQuery.data.responseCount })}
                </span>
              </div>
            )}
          </ReportCard>
        );

      case "AGENT_PERFORMANCE":
        return (
          <ReportCard
            heading={t("agentPerformance.heading")}
            query={agentPerformanceQuery}
            t={t}
            skeleton="list"
            exportPath="agent-performance"
            range={range}
          >
            {agentPerformanceQuery.isSuccess && agentPerformanceQuery.data.length === 0 && (
              <p className="text-sm text-slate-500">{t("agentPerformance.empty")}</p>
            )}
            {agentPerformanceQuery.isSuccess && agentPerformanceQuery.data.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {agentPerformanceQuery.data.map((row) => (
                  <li key={row.userId} className="flex flex-col">
                    <span className="font-medium text-slate-900">{row.fullName}</span>
                    <span className="text-slate-500">
                      {t("agentPerformance.detail", {
                        open: row.openCount,
                        resolved: row.resolvedCount,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ReportCard>
        );

      case "TICKET_AGING":
        return (
          <ReportCard
            heading={t("ticketAging.heading")}
            query={ticketAgingQuery}
            t={t}
            skeleton="list"
            exportPath="ticket-aging"
            range={range}
          >
            {ticketAgingQuery.isSuccess && (
              <ul className="flex flex-col gap-1 text-sm">
                {ticketAgingQuery.data.map((row) => (
                  <li key={row.bucket} className="flex items-center justify-between">
                    <span className="text-slate-600">{row.bucket}</span>
                    <span className="font-medium text-slate-900">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </ReportCard>
        );

      case "RESOLUTION_TIME":
        // Story 99 — reuses `formatRemaining(ms)` (`apps/web/src/lib/sla.ts`)
        // rather than a new duration formatter: its logic (floor to
        // minutes, split into hours/minutes) is generic duration
        // formatting, not inherently a countdown, despite the function's
        // name predating this use case. A multi-day resolution time
        // renders as e.g. "52h 30m" rather than "2d 4h 30m" — a minor,
        // accepted readability trade-off in exchange for zero new
        // formatting code.
        return (
          <ReportCard
            heading={t("resolutionTime.heading")}
            query={resolutionTimeQuery}
            t={t}
            skeleton="stat"
            exportPath="resolution-time"
            range={range}
          >
            {resolutionTimeQuery.isSuccess && resolutionTimeQuery.data.resolvedCount === 0 && (
              <p className="text-sm text-slate-500">{t("resolutionTime.empty")}</p>
            )}
            {resolutionTimeQuery.isSuccess && resolutionTimeQuery.data.resolvedCount > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-2xl font-semibold text-slate-900">
                  {formatRemaining(resolutionTimeQuery.data.averageResolutionMs ?? 0)}
                </span>
                <span className="text-slate-500">
                  {t("resolutionTime.detail", { count: resolutionTimeQuery.data.resolvedCount })}
                </span>
              </div>
            )}
          </ReportCard>
        );

      case "AI_USAGE":
        // Story 121 — `totalCostUsd` is `null` (never a misleading `$0`)
        // when no successful call in range has a priced cost; a nonzero
        // `unpricedCallCount` is surfaced as an explicit caveat, mirroring
        // this screen's existing "never hide a caveat" convention (e.g.
        // `slaCompliance.detail`, `resolutionTime.detail`).
        return (
          <ReportCard
            heading={t("aiUsage.heading")}
            query={aiUsageQuery}
            t={t}
            skeleton="list"
            exportPath="ai-usage"
            range={range}
          >
            {aiUsageQuery.isSuccess && aiUsageQuery.data.totalCalls === 0 && (
              <p className="text-sm text-slate-500">{t("aiUsage.empty")}</p>
            )}
            {aiUsageQuery.isSuccess && aiUsageQuery.data.totalCalls > 0 && (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-semibold text-slate-900">
                    {aiUsageQuery.data.totalCostUsd !== null
                      ? formatUsd(aiUsageQuery.data.totalCostUsd)
                      : t("aiUsage.costUnknown")}
                  </span>
                  <span className="text-slate-500">
                    {t("aiUsage.detail", {
                      calls: aiUsageQuery.data.totalCalls,
                      inputTokens: aiUsageQuery.data.totalInputTokens,
                      outputTokens: aiUsageQuery.data.totalOutputTokens,
                    })}
                  </span>
                </div>
                <ul className="flex flex-col gap-1 border-t border-slate-100 pt-2">
                  {aiUsageQuery.data.byFeature.map((row) => (
                    <li key={row.feature} className="flex items-center justify-between">
                      <span className="text-slate-600">{row.feature}</span>
                      <span className="font-medium text-slate-900">
                        {row.totalCostUsd !== null ? formatUsd(row.totalCostUsd) : t("aiUsage.costUnknown")}
                      </span>
                    </li>
                  ))}
                </ul>
                {aiUsageQuery.data.unpricedCallCount > 0 && (
                  <p className="text-xs text-amber-700">
                    {t("aiUsage.unpricedWarning", { count: aiUsageQuery.data.unpricedCallCount })}
                  </p>
                )}
              </div>
            )}
          </ReportCard>
        );

      case "TICKET_VOLUME_BY_CATEGORY":
        return (
          <ReportCard
            heading={t("ticketVolumeByCategory.heading")}
            query={ticketVolumeByCategoryQuery}
            t={t}
            skeleton="list"
            exportPath="ticket-volume-by-category"
            range={range}
          >
            {ticketVolumeByCategoryQuery.isSuccess && ticketVolumeByCategoryQuery.data.length === 0 && (
              <p className="text-sm text-slate-500">{t("ticketVolumeByCategory.empty")}</p>
            )}
            {ticketVolumeByCategoryQuery.isSuccess && ticketVolumeByCategoryQuery.data.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {ticketVolumeByCategoryQuery.data.map((row) => (
                  <li key={row.categoryId ?? "uncategorized"} className="flex items-center justify-between">
                    <span className="text-slate-600">
                      {row.categoryName ?? t("ticketVolumeByCategory.uncategorized")}
                    </span>
                    <span className="font-medium text-slate-900">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </ReportCard>
        );
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("dateRange.fromLabel")}
          <Input
            type="date"
            value={range.from ?? ""}
            onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value || undefined }))}
            className="w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("dateRange.toLabel")}
          <Input
            type="date"
            value={range.to ?? ""}
            onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value || undefined }))}
            className="w-40"
          />
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRange({})}
          disabled={!range.from && !range.to}
        >
          {t("dateRange.clear")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("dashboards.pickerLabel")}
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            value={selectedDashboardId ?? ""}
            onChange={(event) => setSelectedDashboardId(event.target.value || null)}
          >
            <option value="">{t("dashboards.allReports")}</option>
            {dashboards.map((dashboard) => (
              <option key={dashboard.id} value={dashboard.id}>
                {dashboard.isShared
                  ? t("dashboards.sharedOptionLabel", { name: dashboard.name })
                  : dashboard.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" size="sm" onClick={() => setShowSaveForm(true)}>
          {t("dashboards.saveCurrentView")}
        </Button>
        {selectedDashboard?.isOwner && (
          <>
            <Button variant="outline" size="sm" onClick={handleToggleShare}>
              {selectedDashboard.isShared ? t("dashboards.unshare") : t("dashboards.share")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              {t("dashboards.delete")}
            </Button>
          </>
        )}
      </div>

      {selectedDashboard && (
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title={t("dashboards.deleteConfirmTitle")}
          description={t("dashboards.deleteConfirmDescription", { name: selectedDashboard.name })}
          confirmLabel={t("dashboards.delete")}
          onConfirm={() => void handleDelete()}
          isPending={deleteDashboardMutation.isPending}
        />
      )}

      {showSaveForm && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-3">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            {t("dashboards.nameLabel")}
            <Input
              value={newDashboardName}
              onChange={(event) => setNewDashboardName(event.target.value)}
              className="w-56"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={newDashboardShared}
              onChange={(event) => setNewDashboardShared(event.target.checked)}
            />
            {t("dashboards.shareLabel")}
          </label>
          <Button
            size="sm"
            onClick={() => void handleSaveCurrentView()}
            disabled={!newDashboardName.trim() || createDashboardMutation.isPending}
          >
            {t("dashboards.save")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSaveForm(false)}>
            {t("dashboards.cancel")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {widgetTypesToRender.map((widgetType) => (
          <Fragment key={widgetType}>{renderWidget(widgetType)}</Fragment>
        ))}
      </div>
    </section>
  );
}

interface QueryLike {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Story 97 — Loading & Skeleton UX. Every card previously rendered the
 * identical `h-16` bar while loading, regardless of whether its eventual
 * content is a short list of rows (Ticket Volume, Agent Performance,
 * Ticket Aging) or one big stat number plus a caption line (SLA
 * Compliance, CSAT). `skeleton` shapes it per card instead.
 */
function ReportCardSkeleton({ variant }: { variant: "list" | "stat" }) {
  if (variant === "stat") {
    return (
      <div className="mt-2 flex flex-col gap-1">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-col gap-1">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
    </div>
  );
}

/** Shared card shell — loading/forbidden/generic-error states are identical
 * across all three cards; only the populated body differs (passed as
 * `children`, rendered only once `query.isSuccess`).
 *
 * Story 125 — Reporting Export. `exportPath`/`range` are optional so this
 * shell stays reusable without export support if a future card ever needs
 * that; every current caller passes both. The button only appears once the
 * report has real data (`query.isSuccess`) — exporting a loading/error
 * card's (nonexistent) data makes no sense. A failed export shows a small
 * inline error next to the button rather than replacing the card's already-
 * loaded content with a full error state (mirrors this component's own
 * `invalidRange`/`forbidden` split: a failure in one concern must never
 * blank out data that loaded successfully in another). */
function ReportCard({
  heading,
  query,
  t,
  skeleton = "list",
  exportPath,
  range,
  children,
}: {
  heading: string;
  query: QueryLike;
  t: ReturnType<typeof useTranslations>;
  skeleton?: "list" | "stat";
  exportPath?: ReportExportPath;
  range?: ReportDateRange;
  children: ReactNode;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const forbidden = query.isError && query.error instanceof ApiError && query.error.status === 403;
  // Story 93 — an invalid/reversed date range (400) is distinguished from a
  // generic failure the same way `forbidden` already is: no retry action,
  // since retrying with the exact same range cannot change the outcome —
  // the fix is changing the range via the controls above the cards.
  const invalidRange =
    query.isError && query.error instanceof ApiError && query.error.status === 400;

  async function handleExport() {
    if (!exportPath) {
      return;
    }
    setIsExporting(true);
    setExportError(false);
    try {
      const { blob, filename } = await downloadReportCsv(exportPath, range);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      {/* `<header>`, not another `<div>` — several existing tests locate
          this card via `heading.closest("div")` to reach the OUTER card
          shell (skeleton/content included); a nested `<div>` here would
          make `closest("div")` resolve to this row instead. */}
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{heading}</h2>
        {exportPath && query.isSuccess && (
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={() => void handleExport()}
          >
            {t("export.button")}
          </Button>
        )}
      </header>
      {exportError && <p className="mt-1 text-xs text-red-600">{t("export.error")}</p>}
      {query.isLoading && <ReportCardSkeleton variant={skeleton} />}
      {query.isError && forbidden && (
        <Alert variant="destructive" className="mt-2">
          {t("forbidden")}
        </Alert>
      )}
      {query.isError && invalidRange && (
        <Alert variant="destructive" className="mt-2">
          {t("dateRange.invalidRange")}
        </Alert>
      )}
      {query.isError && !forbidden && !invalidRange && (
        <Alert variant="destructive" className="mt-2 flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}
      {query.isSuccess && <div className="mt-2">{children}</div>}
    </div>
  );
}
