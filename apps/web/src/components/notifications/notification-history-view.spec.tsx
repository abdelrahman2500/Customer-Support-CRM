import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationHistoryView } from "./notification-history-view";
import { useMarkNotificationsReadMutation, useNotificationsQuery } from "@/hooks/use-notifications";
import { useCustomersQuery, useTicketsQuery } from "@/hooks/use-tickets";
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} from "@/hooks/use-notification-preferences";
import { useNotificationTemplatesQuery } from "@/hooks/use-notification-templates";
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
  useMarkNotificationsReadMutation: vi.fn(),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useTicketsQuery: vi.fn(),
  useCustomersQuery: vi.fn(),
}));

vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferencesQuery: vi.fn(),
  useUpdateNotificationPreferenceMutation: vi.fn(),
}));

vi.mock("@/hooks/use-notification-templates", () => ({
  useNotificationTemplatesQuery: vi.fn(),
}));

const mockedUseNotificationsQuery = vi.mocked(useNotificationsQuery);
const mockedUseMarkNotificationsReadMutation = vi.mocked(useMarkNotificationsReadMutation);
const mockedUseTicketsQuery = vi.mocked(useTicketsQuery);
const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);
const mockedUseNotificationPreferencesQuery = vi.mocked(useNotificationPreferencesQuery);
const mockedUseUpdateNotificationPreferenceMutation = vi.mocked(
  useUpdateNotificationPreferenceMutation,
);
const mockedUseNotificationTemplatesQuery = vi.mocked(useNotificationTemplatesQuery);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    // Story S-8b — `isPending` is what the view branches on now, and
    // `isPlaceholderData` drives the fetch indicator and the disabled
    // pager. Both are part of the real v5 result, so the fake carries them.
    isPending: false,
    isPlaceholderData: false,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

/**
 * Story S-8b — `GET /notifications` returns a `Paginated<NotificationSummary>`
 * envelope, so the notifications query's `data` is no longer a bare array.
 * Defaults to a single full page so the existing tests read as before.
 *
 * The tickets/customers/templates queries keep returning plain arrays: this
 * story paginates notifications only, and the lookup endpoints those rows
 * resolve names through are explicitly out of scope.
 */
function page(items: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 25,
    totalPages: 1,
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
  let markRead: ReturnType<typeof vi.fn>;

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
    mockedUseNotificationTemplatesQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    markRead = vi.fn();
    mockedUseMarkNotificationsReadMutation.mockReturnValue({
      mutate: markRead,
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it("shows a loading state while the notifications query is pending", () => {
    mockedUseNotificationsQuery.mockReturnValue(queryResult({ isPending: true }) as never);

    render(<NotificationHistoryView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows the empty state when the query succeeds with zero notifications", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );

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
      queryResult({
        isSuccess: true,
        data: page([atRiskNotification, escalatedNotification]),
      }) as never,
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
      queryResult({
        isSuccess: true,
        data: [{ id: "customer-1", displayName: "Acme Inc.", isActive: true }],
      }) as never,
    );
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([atRiskNotification]) }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("Cannot log in")).toBeInTheDocument();
    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
  });

  it("falls back to the raw ticketId and an unknown-customer label when resolution data is unavailable", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([atRiskNotification]) }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("ticket-1")).toBeInTheDocument();
    expect(screen.getByText("unknownCustomer")).toBeInTheDocument();
  });

  it("links each notification to its locale-correct ticket detail route", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([atRiskNotification]) }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByRole("link", { name: "ticket-1" })).toHaveAttribute(
      "href",
      "/en/tickets/ticket-1",
    );
  });

  it("renders the resolved target type and target time for an sla.at_risk notification", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([atRiskNotification]) }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("eventLabel.slaAtRisk")).toBeInTheDocument();
    expect(screen.getByText(/targetType.response/)).toBeInTheDocument();
  });

  it("renders a no-target placeholder for a ticket.escalated notification (which carries no target)", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([escalatedNotification]) }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("eventLabel.ticketEscalated")).toBeInTheDocument();
    expect(screen.getByText("noTarget")).toBeInTheDocument();
  });

  // Story 61 — custom notification templates.
  it("renders a custom template's substituted text in place of the default label, when one exists", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([atRiskNotification]) }) as never,
    );
    mockedUseNotificationTemplatesQuery.mockReturnValue(
      queryResult({
        data: [
          { id: "t-1", eventType: "sla.at_risk", template: "Watch ticket {ticketId} closely" },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("Watch ticket ticket-1 closely")).toBeInTheDocument();
    expect(screen.queryByText("eventLabel.slaAtRisk")).not.toBeInTheDocument();
  });

  it("keeps the exact existing default label when no template exists for that eventType", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([atRiskNotification]) }) as never,
    );
    mockedUseNotificationTemplatesQuery.mockReturnValue(
      queryResult({
        data: [{ id: "t-1", eventType: "ticket.escalated", template: "Should not apply here" }],
        isSuccess: true,
      }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("eventLabel.slaAtRisk")).toBeInTheDocument();
  });

  it("substitutes {targetType} in a custom template", () => {
    mockedUseNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([atRiskNotification]) }) as never,
    );
    mockedUseNotificationTemplatesQuery.mockReturnValue(
      queryResult({
        data: [{ id: "t-1", eventType: "sla.at_risk", template: "{targetType} at risk" }],
        isSuccess: true,
      }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("response at risk")).toBeInTheDocument();
  });

  // Story 92 — mark-as-read on mount.
  describe("mark-as-read on mount", () => {
    it("triggers mark-as-read exactly once after the notifications query succeeds", async () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([atRiskNotification]) }) as never,
      );

      render(<NotificationHistoryView />);

      await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));
    });

    it("never triggers mark-as-read while the query is loading", () => {
      mockedUseNotificationsQuery.mockReturnValue(queryResult({ isPending: true }) as never);

      render(<NotificationHistoryView />);

      expect(markRead).not.toHaveBeenCalled();
    });

    it("never triggers mark-as-read on a 403 (forbidden) failure", () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      render(<NotificationHistoryView />);

      expect(markRead).not.toHaveBeenCalled();
    });

    it("never triggers mark-as-read on a generic (non-403) failure", () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<NotificationHistoryView />);

      expect(markRead).not.toHaveBeenCalled();
    });
  });

  /**
   * Story S-8b — paging behaviour. `page` lives in the query key, so a page
   * change inherits Story S-7's row preservation for free.
   *
   * Note this screen has no filter or search state: `GET /notifications`
   * has never accepted filters, so there is nothing for a page reset to
   * react to. The reset path is exercised on the audit-log screen, which
   * does have filters.
   */
  describe("pagination (Story S-8b)", () => {
    const middlePage = { total: 60, page: 2, pageSize: 25, totalPages: 3 };

    beforeEach(() => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([atRiskNotification], middlePage) }) as never,
      );
    });

    it("renders the paginated rows", () => {
      render(<NotificationHistoryView />);

      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "ticket-1" })).toBeInTheDocument();
    });

    it("renders no pager when everything fits on one page", () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([atRiskNotification]) }) as never,
      );

      render(<NotificationHistoryView />);

      // A short feed should look exactly as it did before S-8b.
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("renders the pager and page indicator once there is more than one page", () => {
      render(<NotificationHistoryView />);

      expect(screen.getByRole("navigation", { name: "pagination.label" })).toBeInTheDocument();
      expect(
        screen.getByText('pagination.indicator:{"page":2,"totalPages":3}'),
      ).toBeInTheDocument();
    });

    it("requests the next page", () => {
      render(<NotificationHistoryView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));

      expect(mockedUseNotificationsQuery).toHaveBeenLastCalledWith({ page: 3 });
    });

    it("requests the previous page", () => {
      render(<NotificationHistoryView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.previous" }));

      expect(mockedUseNotificationsQuery).toHaveBeenLastCalledWith({ page: 1 });
    });

    it("disables previous on the first page", () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([atRiskNotification], { ...middlePage, page: 1 }),
        }) as never,
      );

      render(<NotificationHistoryView />);

      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.next" })).toBeEnabled();
    });

    it("disables next on the last page", () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([atRiskNotification], { ...middlePage, page: 3 }),
        }) as never,
      );

      render(<NotificationHistoryView />);

      expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeEnabled();
    });

    it("keeps the previous page's rows on screen while the next one loads", () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([atRiskNotification], middlePage),
        }) as never,
      );

      const { container } = render(<NotificationHistoryView />);

      // The whole point: no skeleton swap between pages.
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    });

    it("shows a polite fetch indicator while a page change is in flight", () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([atRiskNotification], middlePage),
        }) as never,
      );

      render(<NotificationHistoryView />);

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("updating");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("blocks both controls while a page change is in flight", () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([atRiskNotification], middlePage),
        }) as never,
      );

      render(<NotificationHistoryView />);

      // Stops a rapid double-click queueing a second jump.
      expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    });

    it("shows no fetch indicator once the page has landed", () => {
      render(<NotificationHistoryView />);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("still shows the empty state for a genuinely empty page", () => {
      mockedUseNotificationsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([], { total: 0, totalPages: 1 }) }) as never,
      );

      render(<NotificationHistoryView />);

      expect(screen.getByText("empty")).toBeInTheDocument();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("keeps marking read exactly once, not once per page", async () => {
      // The Story 92 useRef guard must survive paging: an agent who walks
      // five pages should not fire five read-state writes.
      render(<NotificationHistoryView />);
      await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));
      await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));
    });
  });
});
