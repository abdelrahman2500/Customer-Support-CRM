import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketListView } from "./ticket-list-view";
import { useCustomersQuery, useTicketsQuery, useUsersQuery } from "@/hooks/use-tickets";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-tickets", () => ({
  useTicketsQuery: vi.fn(),
  useCustomersQuery: vi.fn(),
  useUsersQuery: vi.fn(),
}));

const mockedUseTicketsQuery = vi.mocked(useTicketsQuery);
const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);
const mockedUseUsersQuery = vi.mocked(useUsersQuery);

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

describe("TicketListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCustomersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
  });

  it("shows a loading state while the tickets query is pending", () => {
    mockedUseTicketsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<TicketListView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows the empty state when the query succeeds with zero tickets", () => {
    mockedUseTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<TicketListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("shows an error state with a retry action when the query fails", () => {
    const refetch = vi.fn();
    mockedUseTicketsQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<TicketListView />);

    expect(screen.getByText("list.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("list.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders a row per ticket once the query succeeds", () => {
    mockedUseTicketsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          {
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
            slaTarget: null,
          },
        ],
      }) as never,
    );

    render(<TicketListView />);

    expect(screen.getByText("Cannot log in")).toBeInTheDocument();
  });

  // Story 70 — Ticket Search Foundation.
  it("commits the search filter on blur, passing it through to useTicketsQuery", () => {
    mockedUseTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<TicketListView />);
    const input = screen.getByPlaceholderText("list.searchPlaceholder");
    fireEvent.change(input, { target: { value: "login" } });
    fireEvent.blur(input);

    expect(mockedUseTicketsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "login" }),
    );
  });

  it("does not commit the search filter when blurred unchanged (empty)", () => {
    mockedUseTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<TicketListView />);
    fireEvent.blur(screen.getByPlaceholderText("list.searchPlaceholder"));

    expect(mockedUseTicketsQuery).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ search: expect.anything() }),
    );
  });
});
