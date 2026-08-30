import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationHistoryView } from "./notification-history-view";
import { useNotificationsQuery } from "@/hooks/use-notifications";
import { useCustomersQuery, useTicketsQuery } from "@/hooks/use-tickets";
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} from "@/hooks/use-notification-preferences";
import { ApiError } from "@/lib/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-notifications", () => ({
  useNotificationsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useTicketsQuery: vi.fn(),
  useCustomersQuery: vi.fn(),
}));

vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferencesQuery: vi.fn(),
  useUpdateNotificationPreferenceMutation: vi.fn(),
}));

const mockedUseNotificationsQuery = vi.mocked(useNotificationsQuery);
const mockedUseTicketsQuery = vi.mocked(useTicketsQuery);
const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);
const mockedUseNotificationPreferencesQuery = vi.mocked(useNotificationPreferencesQuery);
const mockedUseUpdateNotificationPreferenceMutation = vi.mocked(
  useUpdateNotificationPreferenceMutation,
);

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

const atRiskNotification = {
  id: "notif-1",
  eventType: "sla.at_risk",
  ticketId: "ticket-1",
  branchId: "branch-1",
  targetType: "response",
  targetAt: "2024-01-01T13:00:00.000Z",
  loggedAt: "2024-01-01T12:30:00.000Z",
};

const escalatedNotification = {
  id: "notif-2",
  eventType: "ticket.escalated",
  ticketId: "ticket-2",
  branchId: "branch-1",
  targetType: null,
  targetAt: null,
  loggedAt: "2024-01-01T09:00:00.000Z",
};

describe("NotificationHistoryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseCustomersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseNotificationPreferencesQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseUpdateNotificationPreferenceMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it("shows a loading state while the notifications query is pending", () => {
    mockedUseNotificationsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<NotificationHistoryView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows the empty state when the query succeeds with zero notifications", () => {
    mockedUseNotificationsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<NotificationHistoryView />);

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action for a non-403 failure", () => {
    const refetch = vi.fn();
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500), refetch }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows a forbidden message with no retry action for a 403 failure", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("forbidden")).toBeInTheDocument();
    expect(screen.queryByText("retry")).not.toBeInTheDocument();
  });

  it("renders a row per notification, newest-first order preserved from the query", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [atRiskNotification, escalatedNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    const rows = screen.getAllByRole("row");
    // rows[0] is the header row; data rows follow in the order the query returned them.
    expect(rows[1]).toHaveTextContent("ticket-1");
    expect(rows[2]).toHaveTextContent("ticket-2");
  });

  it("resolves the ticket subject and customer name from the existing tickets/customers queries", () => {
    mockedUseTicketsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "ticket-1", subject: "Cannot log in", customerId: "customer-1" }],
      }) as never,
    );
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [{ id: "customer-1", displayName: "Acme Inc.", isActive: true }] }) as never,
    );
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [atRiskNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("Cannot log in")).toBeInTheDocument();
    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
  });

  it("falls back to the raw ticketId and an unknown-customer label when resolution data is unavailable", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [atRiskNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("ticket-1")).toBeInTheDocument();
    expect(screen.getByText("unknownCustomer")).toBeInTheDocument();
  });

  it("navigates to the ticket detail page when a notification's ticket link is clicked", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [atRiskNotification] }) as never,
    );

    render(<NotificationHistoryView />);
    fireEvent.click(screen.getByText("ticket-1"));

    expect(push).toHaveBeenCalledWith("/en/tickets/ticket-1");
  });

  it("renders the resolved target type and target time for an sla.at_risk notification", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [atRiskNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("eventLabel.slaAtRisk")).toBeInTheDocument();
    expect(screen.getByText(/targetType.response/)).toBeInTheDocument();
  });

  it("renders a no-target placeholder for a ticket.escalated notification (which carries no target)", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [escalatedNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("eventLabel.ticketEscalated")).toBeInTheDocument();
    expect(screen.getByText("noTarget")).toBeInTheDocument();
  });
});
