import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReportsView } from "./reports-view";
import {
  useAgentPerformanceQuery,
  useCsatSummaryQuery,
  useSlaComplianceQuery,
  useTicketAgingQuery,
  useTicketVolumeQuery,
} from "@/hooks/use-reporting";
import { ApiError } from "@/lib/api";

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
}));

const mockedUseTicketVolumeQuery = vi.mocked(useTicketVolumeQuery);
const mockedUseSlaComplianceQuery = vi.mocked(useSlaComplianceQuery);
const mockedUseCsatSummaryQuery = vi.mocked(useCsatSummaryQuery);
const mockedUseAgentPerformanceQuery = vi.mocked(useAgentPerformanceQuery);
const mockedUseTicketAgingQuery = vi.mocked(useTicketAgingQuery);

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
  });

  it("renders each card's empty state when there is no data yet", () => {
    render(<ReportsView />);

    expect(screen.getByText("ticketVolume.empty")).toBeInTheDocument();
    expect(screen.getByText("slaCompliance.empty")).toBeInTheDocument();
    expect(screen.getByText("csat.empty")).toBeInTheDocument();
    expect(screen.getByText("agentPerformance.empty")).toBeInTheDocument();
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
});
