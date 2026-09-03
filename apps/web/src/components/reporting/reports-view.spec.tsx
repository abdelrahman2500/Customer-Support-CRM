import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ReportsView } from "./reports-view";
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
import { ApiError } from "@/lib/api";
import { downloadReportCsv } from "@/lib/reporting-api";

vi.mock("@/lib/reporting-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reporting-api")>();
  return { ...actual, downloadReportCsv: vi.fn() };
});

const mockedDownloadReportCsv = vi.mocked(downloadReportCsv);

// jsdom does not implement the Blob URL APIs the export button uses.
URL.createObjectURL = vi.fn(() => "blob:mock-url");
URL.revokeObjectURL = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-reporting", () => ({
  useTicketVolumeQuery: vi.fn(),
  useSlaComplianceQuery: vi.fn(),
  useCsatSummaryQuery: vi.fn(),
  useAgentPerformanceQuery: vi.fn(),
  useTicketAgingQuery: vi.fn(),
  useResolutionTimeQuery: vi.fn(),
  useAiUsageQuery: vi.fn(),
  useTicketVolumeByCategoryQuery: vi.fn(),
  useDashboardsQuery: vi.fn(),
  useCreateDashboardMutation: vi.fn(),
  useUpdateDashboardMutation: vi.fn(),
  useDeleteDashboardMutation: vi.fn(),
}));

const mockedUseTicketVolumeQuery = vi.mocked(useTicketVolumeQuery);
const mockedUseSlaComplianceQuery = vi.mocked(useSlaComplianceQuery);
const mockedUseCsatSummaryQuery = vi.mocked(useCsatSummaryQuery);
const mockedUseAgentPerformanceQuery = vi.mocked(useAgentPerformanceQuery);
const mockedUseTicketAgingQuery = vi.mocked(useTicketAgingQuery);
const mockedUseResolutionTimeQuery = vi.mocked(useResolutionTimeQuery);
const mockedUseAiUsageQuery = vi.mocked(useAiUsageQuery);
const mockedUseTicketVolumeByCategoryQuery = vi.mocked(useTicketVolumeByCategoryQuery);
const mockedUseDashboardsQuery = vi.mocked(useDashboardsQuery);
const mockedUseCreateDashboardMutation = vi.mocked(useCreateDashboardMutation);
const mockedUseUpdateDashboardMutation = vi.mocked(useUpdateDashboardMutation);
const mockedUseDeleteDashboardMutation = vi.mocked(useDeleteDashboardMutation);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("ReportsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseTicketVolumeQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseSlaComplianceQuery.mockReturnValue(
      queryResult({
        data: { totalWithTarget: 0, breachedCount: 0, compliantCount: 0, complianceRate: null },
        isSuccess: true,
      }) as never,
    );
    mockedUseCsatSummaryQuery.mockReturnValue(
      queryResult({ data: { responseCount: 0, averageRating: null }, isSuccess: true }) as never,
    );
    mockedUseAgentPerformanceQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseTicketAgingQuery.mockReturnValue(
      queryResult({
        data: [
          { bucket: "0-1d", count: 0 },
          { bucket: "1-3d", count: 0 },
          { bucket: "3-7d", count: 0 },
          { bucket: "7d+", count: 0 },
        ],
        isSuccess: true,
      }) as never,
    );
    mockedUseResolutionTimeQuery.mockReturnValue(
      queryResult({ data: { resolvedCount: 0, averageResolutionMs: null }, isSuccess: true }) as never,
    );
    mockedUseAiUsageQuery.mockReturnValue(
      queryResult({
        data: {
          totalCalls: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostUsd: null,
          unpricedCallCount: 0,
          byFeature: [],
        },
        isSuccess: true,
      }) as never,
    );
    mockedUseTicketVolumeByCategoryQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseDashboardsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseCreateDashboardMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "new-dashboard" }),
      isPending: false,
    } as never);
    mockedUseUpdateDashboardMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    mockedUseDeleteDashboardMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "deleted" }),
      isPending: false,
    } as never);
    mockedDownloadReportCsv.mockResolvedValue({
      blob: new Blob(["Status,Count\r\n"], { type: "text/csv" }),
      filename: "ticket-volume-all.csv",
    });
  });

  it("renders each card's empty state when there is no data yet", () => {
    render(<ReportsView />);

    expect(screen.getByText("ticketVolume.empty")).toBeInTheDocument();
    expect(screen.getByText("slaCompliance.empty")).toBeInTheDocument();
    expect(screen.getByText("csat.empty")).toBeInTheDocument();
    expect(screen.getByText("agentPerformance.empty")).toBeInTheDocument();
    expect(screen.getByText("resolutionTime.empty")).toBeInTheDocument();
    expect(screen.getByText("ticketVolumeByCategory.empty")).toBeInTheDocument();
  });

  it("renders a null categoryId row using the localized 'Uncategorized' label, not a blank/null value", () => {
    mockedUseTicketVolumeByCategoryQuery.mockReturnValue(
      queryResult({
        data: [
          { categoryId: "category-1", categoryName: "Billing", count: 3 },
          { categoryId: null, categoryName: null, count: 5 },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("ticketVolumeByCategory.uncategorized")).toBeInTheDocument();
  });

  it("renders the ticket-aging card's four buckets, even when all are zero", () => {
    render(<ReportsView />);

    expect(screen.getByText("0-1d")).toBeInTheDocument();
    expect(screen.getByText("1-3d")).toBeInTheDocument();
    expect(screen.getByText("3-7d")).toBeInTheDocument();
    expect(screen.getByText("7d+")).toBeInTheDocument();
  });

  it("renders the ticket-aging card's populated counts", () => {
    mockedUseTicketAgingQuery.mockReturnValue(
      queryResult({
        data: [
          { bucket: "0-1d", count: 3 },
          { bucket: "1-3d", count: 1 },
          { bucket: "3-7d", count: 0 },
          { bucket: "7d+", count: 2 },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders the ticket-volume card's populated rows", () => {
    mockedUseTicketVolumeQuery.mockReturnValue(
      queryResult({
        data: [
          { status: "OPEN", count: 3 },
          { status: "RESOLVED", count: 5 },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("RESOLVED")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders the SLA compliance card's populated rate", () => {
    mockedUseSlaComplianceQuery.mockReturnValue(
      queryResult({
        data: { totalWithTarget: 10, breachedCount: 2, compliantCount: 8, complianceRate: 0.8 },
        isSuccess: true,
      }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("renders the CSAT card's populated average", () => {
    mockedUseCsatSummaryQuery.mockReturnValue(
      queryResult({
        data: { responseCount: 4, averageRating: 4.5 },
        isSuccess: true,
      }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("4.5/5")).toBeInTheDocument();
  });

  it("renders the agent-performance card's populated rows", () => {
    mockedUseAgentPerformanceQuery.mockReturnValue(
      queryResult({
        data: [{ userId: "user-1", fullName: "Jane Agent", openCount: 2, resolvedCount: 5 }],
        isSuccess: true,
      }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("Jane Agent")).toBeInTheDocument();
    expect(
      screen.getByText(`agentPerformance.detail:${JSON.stringify({ open: 2, resolved: 5 })}`),
    ).toBeInTheDocument();
  });

  it("shows a forbidden message on a card whose query 403s, independent of the others", () => {
    mockedUseTicketVolumeQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("forbidden")).toBeInTheDocument();
    // The other cards still render their own (unaffected) state.
    expect(screen.getByText("slaCompliance.empty")).toBeInTheDocument();
    expect(screen.getByText("csat.empty")).toBeInTheDocument();
    expect(screen.getByText("agentPerformance.empty")).toBeInTheDocument();
  });

  it("shows a generic error with a retry action for a non-403 failure", () => {
    const refetch = vi.fn();
    mockedUseSlaComplianceQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500), refetch }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the invalid-range message, with no retry action, for a 400 failure", () => {
    mockedUseTicketVolumeQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("from must not be after to", 400) }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("dateRange.invalidRange")).toBeInTheDocument();
    expect(screen.queryByText("retry")).not.toBeInTheDocument();
  });

  // Story 93 — date-range filtering.
  describe("date-range control", () => {
    it("calls every hook with an empty range ({}) on initial render (preserves all-time default)", () => {
      render(<ReportsView />);

      expect(mockedUseTicketVolumeQuery).toHaveBeenCalledWith({});
      expect(mockedUseSlaComplianceQuery).toHaveBeenCalledWith({});
      expect(mockedUseCsatSummaryQuery).toHaveBeenCalledWith({});
      expect(mockedUseAgentPerformanceQuery).toHaveBeenCalledWith({});
      expect(mockedUseTicketAgingQuery).toHaveBeenCalledWith({});
    });

    it("re-invokes every hook with the selected range once both from and to are set", () => {
      render(<ReportsView />);

      fireEvent.change(screen.getByLabelText("dateRange.fromLabel"), {
        target: { value: "2026-01-01" },
      });
      fireEvent.change(screen.getByLabelText("dateRange.toLabel"), {
        target: { value: "2026-01-31" },
      });

      expect(mockedUseTicketVolumeQuery).toHaveBeenLastCalledWith({
        from: "2026-01-01",
        to: "2026-01-31",
      });
      expect(mockedUseTicketAgingQuery).toHaveBeenLastCalledWith({
        from: "2026-01-01",
        to: "2026-01-31",
      });
    });

    it("resets every hook back to an empty range when Clear is clicked", () => {
      render(<ReportsView />);

      fireEvent.change(screen.getByLabelText("dateRange.fromLabel"), {
        target: { value: "2026-01-01" },
      });
      expect(mockedUseTicketVolumeQuery).toHaveBeenLastCalledWith({ from: "2026-01-01" });

      fireEvent.click(screen.getByText("dateRange.clear"));

      expect(mockedUseTicketVolumeQuery).toHaveBeenLastCalledWith({});
      expect(screen.getByLabelText("dateRange.fromLabel")).toHaveValue("");
    });

    it("disables Clear when no range is selected", () => {
      render(<ReportsView />);

      expect(screen.getByText("dateRange.clear")).toBeDisabled();
    });
  });

  // Story 97 — Loading & Skeleton UX.
  describe("per-card skeleton shape (Story 97)", () => {
    it("renders a compact stat-shaped skeleton for the stat cards (SLA Compliance, CSAT)", () => {
      mockedUseSlaComplianceQuery.mockReturnValue(queryResult({ isLoading: true }) as never);
      mockedUseCsatSummaryQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<ReportsView />);

      const slaHeading = screen.getByText("slaCompliance.heading");
      const slaCard = slaHeading.closest("div")!;
      // A stat skeleton is exactly two blocks (a big-number placeholder plus
      // a caption line) — not the three-row list shape used elsewhere.
      expect(slaCard.querySelectorAll(".animate-pulse")).toHaveLength(2);
    });

    it("renders a multi-row list-shaped skeleton for the list cards (Ticket Volume, Agent Performance, Ticket Aging)", () => {
      mockedUseTicketVolumeQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<ReportsView />);

      const heading = screen.getByText("ticketVolume.heading");
      const card = heading.closest("div")!;
      expect(card.querySelectorAll(".animate-pulse")).toHaveLength(3);
    });
  });

  // Story 99 — Ticket Resolution-Time Metrics.
  describe("resolution-time card (Story 99)", () => {
    it("renders the average resolution time formatted as a duration, plus the resolved-ticket count", () => {
      mockedUseResolutionTimeQuery.mockReturnValue(
        queryResult({
          data: { resolvedCount: 4, averageResolutionMs: 2 * 60 * 60 * 1000 + 15 * 60 * 1000 },
          isSuccess: true,
        }) as never,
      );

      render(<ReportsView />);

      expect(screen.getByText("2h 15m")).toBeInTheDocument();
      expect(screen.getByText('resolutionTime.detail:{"count":4}')).toBeInTheDocument();
    });

    it("renders the empty state, not a duration, when no ticket has resolved yet", () => {
      render(<ReportsView />);

      expect(screen.getByText("resolutionTime.empty")).toBeInTheDocument();
    });

    it("uses the stat skeleton shape (two blocks), not the list shape, while loading", () => {
      mockedUseResolutionTimeQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<ReportsView />);

      const heading = screen.getByText("resolutionTime.heading");
      const card = heading.closest("div")!;
      expect(card.querySelectorAll(".animate-pulse")).toHaveLength(2);
    });

    it("shares the same date-range state as the other cards", () => {
      render(<ReportsView />);

      fireEvent.change(screen.getByLabelText("dateRange.fromLabel"), {
        target: { value: "2026-01-01" },
      });

      expect(mockedUseResolutionTimeQuery).toHaveBeenLastCalledWith({ from: "2026-01-01" });
    });
  });

  // Story 121 — AI Usage/Cost Reporting.
  describe("ai-usage card (Story 121)", () => {
    it("renders the empty state when there is no AI usage yet", () => {
      render(<ReportsView />);

      expect(screen.getByText("aiUsage.empty")).toBeInTheDocument();
    });

    it("renders total cost, the usage detail line, and a per-feature cost breakdown", () => {
      mockedUseAiUsageQuery.mockReturnValue(
        queryResult({
          data: {
            totalCalls: 5,
            totalInputTokens: 1000,
            totalOutputTokens: 500,
            totalCostUsd: 0.0045,
            unpricedCallCount: 0,
            byFeature: [
              {
                feature: "SUMMARIZE",
                callCount: 5,
                successCount: 5,
                errorCount: 0,
                totalInputTokens: 1000,
                totalOutputTokens: 500,
                totalCostUsd: 0.0045,
              },
            ],
          },
          isSuccess: true,
        }) as never,
      );

      render(<ReportsView />);

      // Appears twice: the card's own overall total, and the per-feature
      // breakdown row (this fixture has only one feature, with the same
      // cost as the overall total).
      expect(screen.getAllByText("$0.0045")).toHaveLength(2);
      expect(
        screen.getByText('aiUsage.detail:{"calls":5,"inputTokens":1000,"outputTokens":500}'),
      ).toBeInTheDocument();
      expect(screen.getByText("SUMMARIZE")).toBeInTheDocument();
      expect(screen.queryByText("aiUsage.unpricedWarning:{\"count\":0}")).not.toBeInTheDocument();
    });

    it("shows 'cost unknown' (not $0) for a feature whose calls are all unpriced, plus the unpriced-count caveat", () => {
      mockedUseAiUsageQuery.mockReturnValue(
        queryResult({
          data: {
            totalCalls: 2,
            totalInputTokens: 400,
            totalOutputTokens: 200,
            totalCostUsd: null,
            unpricedCallCount: 2,
            byFeature: [
              {
                feature: "CHAT",
                callCount: 2,
                successCount: 2,
                errorCount: 0,
                totalInputTokens: 400,
                totalOutputTokens: 200,
                totalCostUsd: null,
              },
            ],
          },
          isSuccess: true,
        }) as never,
      );

      render(<ReportsView />);

      expect(screen.getAllByText("aiUsage.costUnknown").length).toBeGreaterThan(0);
      expect(screen.getByText('aiUsage.unpricedWarning:{"count":2}')).toBeInTheDocument();
    });

    it("uses the list skeleton shape while loading", () => {
      mockedUseAiUsageQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<ReportsView />);

      const heading = screen.getByText("aiUsage.heading");
      const card = heading.closest("div")!;
      expect(card.querySelectorAll(".animate-pulse")).toHaveLength(3);
    });

    it("shares the same date-range state as the other cards", () => {
      render(<ReportsView />);

      fireEvent.change(screen.getByLabelText("dateRange.fromLabel"), {
        target: { value: "2026-01-01" },
      });

      expect(mockedUseAiUsageQuery).toHaveBeenLastCalledWith({ from: "2026-01-01" });
    });
  });

  // Story 110 — Saved Dashboards.
  describe("saved dashboards (Story 110)", () => {
    it("renders all seven report cards under the 'All reports' default, unaffected by an empty dashboard list", () => {
      render(<ReportsView />);

      expect(screen.getByText("ticketVolume.heading")).toBeInTheDocument();
      expect(screen.getByText("slaCompliance.heading")).toBeInTheDocument();
      expect(screen.getByText("csat.heading")).toBeInTheDocument();
      expect(screen.getByText("agentPerformance.heading")).toBeInTheDocument();
      expect(screen.getByText("ticketAging.heading")).toBeInTheDocument();
      expect(screen.getByText("resolutionTime.heading")).toBeInTheDocument();
      expect(screen.getByText("aiUsage.heading")).toBeInTheDocument();
      // No owner-only actions are shown for the default, dashboard-less view.
      expect(screen.queryByText("dashboards.share")).not.toBeInTheDocument();
      expect(screen.queryByText("dashboards.delete")).not.toBeInTheDocument();
    });

    it("lists the caller's own and shared dashboards in the picker", () => {
      mockedUseDashboardsQuery.mockReturnValue(
        queryResult({
          data: [
            { id: "dash-1", name: "My Dashboard", isShared: false, isOwner: true, widgets: [] },
            { id: "dash-2", name: "Team Dashboard", isShared: true, isOwner: false, widgets: [] },
          ],
          isSuccess: true,
        }) as never,
      );

      render(<ReportsView />);

      expect(screen.getByText("My Dashboard")).toBeInTheDocument();
      expect(screen.getByText('dashboards.sharedOptionLabel:{"name":"Team Dashboard"}')).toBeInTheDocument();
    });

    it("renders only a selected dashboard's saved widgets, in saved order", () => {
      mockedUseDashboardsQuery.mockReturnValue(
        queryResult({
          data: [
            {
              id: "dash-1",
              name: "Subset Dashboard",
              isShared: false,
              isOwner: true,
              widgets: [
                { widgetType: "CSAT", position: 0 },
                { widgetType: "TICKET_VOLUME", position: 1 },
              ],
            },
          ],
          isSuccess: true,
        }) as never,
      );

      render(<ReportsView />);
      fireEvent.change(screen.getByLabelText("dashboards.pickerLabel"), {
        target: { value: "dash-1" },
      });

      expect(screen.getByText("csat.heading")).toBeInTheDocument();
      expect(screen.getByText("ticketVolume.heading")).toBeInTheDocument();
      expect(screen.queryByText("slaCompliance.heading")).not.toBeInTheDocument();
      expect(screen.queryByText("agentPerformance.heading")).not.toBeInTheDocument();
      expect(screen.queryByText("ticketAging.heading")).not.toBeInTheDocument();
      expect(screen.queryByText("resolutionTime.heading")).not.toBeInTheDocument();
      expect(screen.queryByText("aiUsage.heading")).not.toBeInTheDocument();
    });

    it("shows owner-only share/delete actions only for a dashboard the caller owns", () => {
      mockedUseDashboardsQuery.mockReturnValue(
        queryResult({
          data: [
            { id: "dash-1", name: "Owned", isShared: false, isOwner: true, widgets: [] },
            { id: "dash-2", name: "Not owned", isShared: true, isOwner: false, widgets: [] },
          ],
          isSuccess: true,
        }) as never,
      );

      render(<ReportsView />);
      const picker = screen.getByLabelText("dashboards.pickerLabel");

      fireEvent.change(picker, { target: { value: "dash-2" } });
      expect(screen.queryByText("dashboards.share")).not.toBeInTheDocument();
      expect(screen.queryByText("dashboards.delete")).not.toBeInTheDocument();

      fireEvent.change(picker, { target: { value: "dash-1" } });
      expect(screen.getByText("dashboards.share")).toBeInTheDocument();
      expect(screen.getByText("dashboards.delete")).toBeInTheDocument();
    });

    it("creates a dashboard with every widget type, in this screen's default order, when saving the current view", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "new-dashboard" });
      mockedUseCreateDashboardMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      render(<ReportsView />);
      fireEvent.click(screen.getByText("dashboards.saveCurrentView"));
      fireEvent.change(screen.getByLabelText("dashboards.nameLabel"), {
        target: { value: "New dashboard" },
      });
      fireEvent.click(screen.getByText("dashboards.save"));

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
      expect(mutateAsync).toHaveBeenCalledWith({
        name: "New dashboard",
        isShared: false,
        widgetTypes: [
          "TICKET_VOLUME",
          "SLA_COMPLIANCE",
          "CSAT",
          "AGENT_PERFORMANCE",
          "TICKET_AGING",
          "RESOLUTION_TIME",
          "AI_USAGE",
          "TICKET_VOLUME_BY_CATEGORY",
        ],
      });
    });

    it("toggles isShared for the owned, selected dashboard", () => {
      const mutate = vi.fn();
      mockedUseUpdateDashboardMutation.mockReturnValue({ mutate, isPending: false } as never);
      mockedUseDashboardsQuery.mockReturnValue(
        queryResult({
          data: [{ id: "dash-1", name: "Owned", isShared: false, isOwner: true, widgets: [] }],
          isSuccess: true,
        }) as never,
      );

      render(<ReportsView />);
      fireEvent.change(screen.getByLabelText("dashboards.pickerLabel"), {
        target: { value: "dash-1" },
      });
      fireEvent.click(screen.getByText("dashboards.share"));

      expect(mutate).toHaveBeenCalledWith({ isShared: true });
    });

    it("does not delete immediately — clicking delete opens a confirmation dialog first", () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "dash-1" });
      mockedUseDeleteDashboardMutation.mockReturnValue({ mutateAsync, isPending: false } as never);
      mockedUseDashboardsQuery.mockReturnValue(
        queryResult({
          data: [{ id: "dash-1", name: "Owned", isShared: false, isOwner: true, widgets: [] }],
          isSuccess: true,
        }) as never,
      );

      render(<ReportsView />);
      fireEvent.change(screen.getByLabelText("dashboards.pickerLabel"), {
        target: { value: "dash-1" },
      });
      fireEvent.click(screen.getByRole("button", { name: "dashboards.delete" }));

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("deletes the owned, selected dashboard via the confirmation dialog and resets to 'All reports'", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "dash-1" });
      mockedUseDeleteDashboardMutation.mockReturnValue({ mutateAsync, isPending: false } as never);
      mockedUseDashboardsQuery.mockReturnValue(
        queryResult({
          data: [{ id: "dash-1", name: "Owned", isShared: false, isOwner: true, widgets: [] }],
          isSuccess: true,
        }) as never,
      );

      render(<ReportsView />);
      fireEvent.change(screen.getByLabelText("dashboards.pickerLabel"), {
        target: { value: "dash-1" },
      });
      fireEvent.click(screen.getByRole("button", { name: "dashboards.delete" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "dashboards.delete" }));

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith("dash-1"));
      expect(screen.getByLabelText("dashboards.pickerLabel")).toHaveValue("");
    });
  });

  // Story 125 — Reporting Export.
  describe("export CSV button (Story 125)", () => {
    it("renders one export button per report card", () => {
      render(<ReportsView />);

      expect(screen.getAllByText("export.button")).toHaveLength(8);
    });

    it("does not render an export button for a card whose query has not succeeded yet", () => {
      mockedUseTicketVolumeQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<ReportsView />);

      expect(screen.getAllByText("export.button")).toHaveLength(7);
    });

    it("clicking a card's export button downloads that report with the correct path and current range", async () => {
      render(<ReportsView />);

      fireEvent.click(screen.getAllByText("export.button")[0]!);

      await waitFor(() =>
        expect(mockedDownloadReportCsv).toHaveBeenCalledWith("ticket-volume", {}),
      );
    });

    it("shows an inline error when the export fails, without disturbing the card's already-loaded content", async () => {
      mockedDownloadReportCsv.mockRejectedValue(new ApiError("Server error", 500));

      render(<ReportsView />);
      fireEvent.click(screen.getAllByText("export.button")[0]!);

      expect(await screen.findByText("export.error")).toBeInTheDocument();
      // The card's own (empty-state) content is still there.
      expect(screen.getByText("ticketVolume.empty")).toBeInTheDocument();
    });
  });
});
