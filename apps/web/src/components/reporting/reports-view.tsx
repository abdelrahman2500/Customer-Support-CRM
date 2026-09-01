"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  useAgentPerformanceQuery,
  useCsatSummaryQuery,
  useSlaComplianceQuery,
  useTicketAgingQuery,
  useTicketVolumeQuery,
} from "@/hooks/use-reporting";
import type { ReportDateRange } from "@/lib/reporting-api";
import { ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

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
 */
export function ReportsView() {
  const t = useTranslations("reporting");
  const [range, setRange] = useState<ReportDateRange>({});

  const ticketVolumeQuery = useTicketVolumeQuery(range);
  const slaComplianceQuery = useSlaComplianceQuery(range);
  const csatQuery = useCsatSummaryQuery(range);
  const agentPerformanceQuery = useAgentPerformanceQuery(range);
  const ticketAgingQuery = useTicketAgingQuery(range);

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ReportCard
          heading={t("ticketVolume.heading")}
          query={ticketVolumeQuery}
          t={t}
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

        <ReportCard
          heading={t("slaCompliance.heading")}
          query={slaComplianceQuery}
          t={t}
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

        <ReportCard heading={t("csat.heading")} query={csatQuery} t={t}>
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

        <ReportCard heading={t("agentPerformance.heading")} query={agentPerformanceQuery} t={t}>
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

        <ReportCard heading={t("ticketAging.heading")} query={ticketAgingQuery} t={t}>
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

/** Shared card shell — loading/forbidden/generic-error states are identical
 * across all three cards; only the populated body differs (passed as
 * `children`, rendered only once `query.isSuccess`). */
function ReportCard({
  heading,
  query,
  t,
  children,
}: {
  heading: string;
  query: QueryLike;
  t: ReturnType<typeof useTranslations>;
  children: ReactNode;
}) {
  const forbidden = query.isError && query.error instanceof ApiError && query.error.status === 403;
  // Story 93 — an invalid/reversed date range (400) is distinguished from a
  // generic failure the same way `forbidden` already is: no retry action,
  // since retrying with the exact same range cannot change the outcome —
  // the fix is changing the range via the controls above the cards.
  const invalidRange =
    query.isError && query.error instanceof ApiError && query.error.status === 400;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{heading}</h2>
      {query.isLoading && <Skeleton className="mt-2 h-16 w-full" />}
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
