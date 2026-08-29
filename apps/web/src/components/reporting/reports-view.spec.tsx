import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReportsView } from "./reports-view";
import {
  useCsatSummaryQuery,
  useSlaComplianceQuery,
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
}));

const mockedUseTicketVolumeQuery = vi.mocked(useTicketVolumeQuery);
const mockedUseSlaComplianceQuery = vi.mocked(useSlaComplianceQuery);
const mockedUseCsatSummaryQuery = vi.mocked(useCsatSummaryQuery);

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
  });

  it("renders each card's empty state when there is no data yet", () => {
    render(<ReportsView />);

    expect(screen.getByText("ticketVolume.empty")).toBeInTheDocument();
    expect(screen.getByText("slaCompliance.empty")).toBeInTheDocument();
    expect(screen.getByText("csat.empty")).toBeInTheDocument();
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

  it("shows a forbidden message on a card whose query 403s, independent of the others", () => {
    mockedUseTicketVolumeQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<ReportsView />);

    expect(screen.getByText("forbidden")).toBeInTheDocument();
    // The other two cards still render their own (unaffected) state.
    expect(screen.getByText("slaCompliance.empty")).toBeInTheDocument();
    expect(screen.getByText("csat.empty")).toBeInTheDocument();
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
});
