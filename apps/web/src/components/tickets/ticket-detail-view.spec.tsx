import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketDetailView } from "./ticket-detail-view";
import {
  useCustomersQuery,
  useTicketHistoryQuery,
  useTicketQuery,
  useTicketSlaTargetQuery,
  useUpdateTicketMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-ticket-realtime", () => ({ useTicketRealtime: vi.fn() }));

vi.mock("@/hooks/use-tickets", () => ({
  useTicketQuery: vi.fn(),
  useTicketHistoryQuery: vi.fn(),
  useTicketSlaTargetQuery: vi.fn(),
  useCustomersQuery: vi.fn(),
  useUsersQuery: vi.fn(),
  useUpdateTicketMutation: vi.fn(),
}));

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    ...overrides,
  };
}

const baseTicket = {
  id: "ticket-1",
  subject: "Cannot log in",
  category: "billing",
  priority: "HIGH",
  status: "OPEN",
  customerId: "customer-1",
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
};

describe("TicketDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCustomersQuery).mockReturnValue(
      queryResult({ data: [{ id: "customer-1", displayName: "Acme Inc." }], isSuccess: true }) as never,
    );
    vi.mocked(useUsersQuery).mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    vi.mocked(useTicketHistoryQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
      queryResult({ data: null, isSuccess: true }) as never,
    );
    vi.mocked(useUpdateTicketMutation).mockReturnValue({
      mutate: vi.fn(),
      isError: false,
      error: null,
    } as never);
  });

  it("renders the ticket subject and resolved customer name", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("Cannot log in")).toBeInTheDocument();
    expect(screen.getByText(/Acme Inc\./)).toBeInTheDocument();
  });

  it("renders a not-found message when the ticket lookup 404s", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<TicketDetailView ticketId="missing" />);

    expect(screen.getByText("detail.notFound")).toBeInTheDocument();
  });

  it("renders a generic load error for a non-404 failure", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.loadError")).toBeInTheDocument();
  });

  it("renders an inline permission error when a mutation is rejected with 403", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );
    vi.mocked(useUpdateTicketMutation).mockReturnValue({
      mutate: vi.fn(),
      isError: true,
      error: new ApiError("Forbidden", 403),
    } as never);

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.actionForbidden")).toBeInTheDocument();
  });

  it("renders a generic action-failed message for a non-403 mutation error", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );
    vi.mocked(useUpdateTicketMutation).mockReturnValue({
      mutate: vi.fn(),
      isError: true,
      error: new ApiError("Server error", 500),
    } as never);

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.actionFailed")).toBeInTheDocument();
  });
});
