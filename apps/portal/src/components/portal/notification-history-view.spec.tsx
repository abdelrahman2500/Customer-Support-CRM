import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationHistoryView } from "./notification-history-view";
import {
  useMarkNotificationsReadMutation,
  useMyNotificationsQuery,
} from "@/hooks/use-portal-notification-history";
import { useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import {
  usePortalNotificationPreferencesQuery,
  useUpdatePortalNotificationPreferenceMutation,
} from "@/hooks/use-portal-notification-preferences";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-notification-history", () => ({
  useMyNotificationsQuery: vi.fn(),
  useMarkNotificationsReadMutation: vi.fn(),
}));

vi.mock("@/hooks/use-portal-tickets", () => ({
  useMyTicketsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-portal-notification-preferences", () => ({
  usePortalNotificationPreferencesQuery: vi.fn(),
  useUpdatePortalNotificationPreferenceMutation: vi.fn(),
}));

const mockedUseMyNotificationsQuery = vi.mocked(useMyNotificationsQuery);
const mockedUseMarkNotificationsReadMutation = vi.mocked(useMarkNotificationsReadMutation);
const mockedUseMyTicketsQuery = vi.mocked(useMyTicketsQuery);
const mockedUsePortalNotificationPreferencesQuery = vi.mocked(
  usePortalNotificationPreferencesQuery,
);
const mockedUseUpdatePortalNotificationPreferenceMutation = vi.mocked(
  useUpdatePortalNotificationPreferenceMutation,
);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

const ticketUpdatedNotification = {
  id: "notif-1",
  eventType: "ticket.updated",
  ticketId: "ticket-1",
  branchId: null,
  targetType: null,
  targetAt: null,
  loggedAt: "2026-01-01T12:30:00.000Z",
};

const newReplyNotification = {
  id: "notif-2",
  eventType: "channel.message.created",
  ticketId: "ticket-2",
  branchId: null,
  targetType: null,
  targetAt: null,
  loggedAt: "2026-01-01T09:00:00.000Z",
};

describe("NotificationHistoryView", () => {
  let markRead: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUsePortalNotificationPreferencesQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseUpdatePortalNotificationPreferenceMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    markRead = vi.fn();
    mockedUseMarkNotificationsReadMutation.mockReturnValue({
      mutate: markRead,
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it("renders the notification preferences section", () => {
    mockedUseMyNotificationsQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("preferences.heading")).toBeInTheDocument();
  });

  it("shows a loading state while the notifications query is pending", () => {
    mockedUseMyNotificationsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<NotificationHistoryView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  // Story 97 — Loading & Skeleton UX.
  it("shapes the loading state as the real 3-column table, not generic row bars", () => {
    mockedUseMyNotificationsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<NotificationHistoryView />);

    // The real headers stay in the accessibility tree (they're the same
    // headers the populated table uses); only the placeholder rows below
    // them are `aria-hidden`, so those are asserted via the DOM directly.
    expect(screen.getByRole("columnheader", { name: "history.columns.event" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "history.columns.ticket" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "history.columns.loggedAt" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(container.querySelectorAll("tbody .animate-pulse")).toHaveLength(15); // 5 rows × 3 cells
  });

  it("shows the empty state when the query succeeds with zero notifications", () => {
    mockedUseMyNotificationsQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("history.empty")).toBeInTheDocument();
  });

  it("shows an error state with a working retry action on failure", () => {
    const refetch = vi.fn();
    mockedUseMyNotificationsQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<NotificationHistoryView />);

    expect(screen.getByText("history.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("history.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders a row per notification, newest-first order preserved from the query", () => {
    mockedUseMyNotificationsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [ticketUpdatedNotification, newReplyNotification],
      }) as never,
    );

    render(<NotificationHistoryView />);

    const rows = screen.getAllByRole("row");
    // rows[0] is the header row; data rows follow in the order the query returned them.
    expect(rows[1]).toHaveTextContent("ticket-1");
    expect(rows[2]).toHaveTextContent("ticket-2");
  });

  it("resolves the ticket subject from the existing tickets query when present", () => {
    mockedUseMyTicketsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "ticket-1", subject: "Cannot log in" }],
      }) as never,
    );
    mockedUseMyNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [ticketUpdatedNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("Cannot log in")).toBeInTheDocument();
  });

  it("falls back to the raw ticketId when the ticket isn't in the resolved list", () => {
    mockedUseMyNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [ticketUpdatedNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("ticket-1")).toBeInTheDocument();
  });

  it("links each notification to its locale-correct ticket detail route", () => {
    mockedUseMyNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [ticketUpdatedNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    const link = screen.getByRole("link", { name: "ticket-1" });
    expect(link).toHaveAttribute("href", "/en/tickets/ticket-1");
  });

  it("maps a ticket.updated eventType to the existing eventLabel.ticketUpdated key", () => {
    mockedUseMyNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [ticketUpdatedNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("eventLabel.ticketUpdated")).toBeInTheDocument();
  });

  it("maps a channel.message.created eventType to the existing eventLabel.newReply key", () => {
    mockedUseMyNotificationsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [newReplyNotification] }) as never,
    );

    render(<NotificationHistoryView />);

    expect(screen.getByText("eventLabel.newReply")).toBeInTheDocument();
  });

  // Story 92 — mark-as-read on mount.
  describe("mark-as-read on mount", () => {
    it("triggers mark-as-read exactly once after the notifications query succeeds", async () => {
      mockedUseMyNotificationsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [ticketUpdatedNotification] }) as never,
      );

      render(<NotificationHistoryView />);

      await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));
    });

    it("never triggers mark-as-read while the query is loading", () => {
      mockedUseMyNotificationsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<NotificationHistoryView />);

      expect(markRead).not.toHaveBeenCalled();
    });

    it("never triggers mark-as-read on failure", () => {
      mockedUseMyNotificationsQuery.mockReturnValue(
        queryResult({ isError: true, refetch: vi.fn() }) as never,
      );

      render(<NotificationHistoryView />);

      expect(markRead).not.toHaveBeenCalled();
    });
  });
});
