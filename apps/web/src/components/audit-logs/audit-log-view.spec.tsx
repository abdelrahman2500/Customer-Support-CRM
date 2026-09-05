import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuditLogView } from "./audit-log-view";
import { useAuditLogsQuery } from "@/hooks/use-audit-logs";
import { useUsersQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-audit-logs", () => ({
  useAuditLogsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useUsersQuery: vi.fn(),
}));

const mockedUseAuditLogsQuery = vi.mocked(useAuditLogsQuery);
const mockedUseUsersQuery = vi.mocked(useUsersQuery);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    // Story S-8a — `isPending` is what the view branches on now, and
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
 * Story S-8a — `GET /audit-logs` returns a `Paginated<AuditLogSummary>`
 * envelope, so the audit-log query's `data` is no longer a bare array.
 * This builds one, defaulting to a single full page so the existing tests
 * read as they did before.
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

const baseLog = {
  id: "log-1",
  actorId: "user-1",
  action: "ticket.update",
  entityType: "Ticket",
  entityId: "ticket-1",
  branchId: "branch-1",
  diff: { status: { from: "OPEN", to: "RESOLVED" } },
  ipAddress: "203.0.113.10",
  createdAt: "2024-01-01T12:00:00.000Z",
};

describe("AuditLogView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
  });

  it("shows a skeleton on the initial load, before any page exists", () => {
    mockedUseAuditLogsQuery.mockReturnValue(queryResult({ isPending: true }) as never);

    const { container } = render(<AuditLogView />);

    // Previously asserted `getAllByRole("generic").length > 0`, which any
    // `div` satisfies - it passed whether or not a skeleton rendered.
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the empty state when the query succeeds with zero entries", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action for a non-403 failure", () => {
    const refetch = vi.fn();
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500), refetch }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows a forbidden message with no retry action for a 403 failure", () => {
    const refetch = vi.fn();
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Forbidden", 403), refetch }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("forbidden")).toBeInTheDocument();
    expect(screen.queryByText("retry")).not.toBeInTheDocument();
  });

  it("renders a row per audit log entry with its action/entity information", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseLog]) }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("ticket.update")).toBeInTheDocument();
    expect(screen.getByText("Ticket")).toBeInTheDocument();
    expect(screen.getByText("ticket-1")).toBeInTheDocument();
    expect(screen.getByText("branch-1")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.10")).toBeInTheDocument();
  });

  it("resolves the actor's name from the existing users query", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          {
            id: "user-1",
            email: "a@example.com",
            fullName: "Ada Lovelace",
            isActive: true,
            roles: [],
          },
        ],
      }) as never,
    );
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseLog]) }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("falls back to the raw actor id when the user isn't in the resolved list", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseLog]) }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("user-1")).toBeInTheDocument();
  });

  it("renders the system-actor label for a null actorId", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([{ ...baseLog, actorId: null }]) }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("systemActor")).toBeInTheDocument();
  });

  it("renders a formatted diff for an entry that has one", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseLog]) }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText(/"status"/)).toBeInTheDocument();
    expect(screen.getByText(/"RESOLVED"/)).toBeInTheDocument();
  });

  it("renders the no-diff placeholder for an entry with a null diff", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([{ ...baseLog, diff: null }]) }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("noDiff")).toBeInTheDocument();
  });

  it("renders placeholders for null entityId/branchId/ipAddress", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: page([{ ...baseLog, entityId: null, branchId: null, ipAddress: null }]),
      }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("noEntityId")).toBeInTheDocument();
    expect(screen.getByText("noBranch")).toBeInTheDocument();
    expect(screen.getByText("noIpAddress")).toBeInTheDocument();
  });

  // Story 104 — Audit Log Search, Filtering & a Bounded Result Cap.
  describe("filter bar (Story 104)", () => {
    beforeEach(() => {
      mockedUseAuditLogsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([]) }) as never,
      );
    });

    it("defaults to no filters", () => {
      render(<AuditLogView />);

      expect(mockedUseAuditLogsQuery).toHaveBeenCalledWith({});
    });

    it("commits an action filter on blur", () => {
      render(<AuditLogView />);

      const input = screen.getByPlaceholderText("filterActionPlaceholder");
      fireEvent.change(input, { target: { value: "POST /api/v1/tickets" } });
      fireEvent.blur(input);

      expect(mockedUseAuditLogsQuery).toHaveBeenLastCalledWith({
        action: "POST /api/v1/tickets",
      });
    });

    it("commits an entityType filter on blur", () => {
      render(<AuditLogView />);

      const input = screen.getByPlaceholderText("filterEntityTypePlaceholder");
      fireEvent.change(input, { target: { value: "ticket" } });
      fireEvent.blur(input);

      expect(mockedUseAuditLogsQuery).toHaveBeenLastCalledWith({ entityType: "ticket" });
    });

    it("updates the date range immediately on change (no blur-commit)", () => {
      render(<AuditLogView />);

      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0]!, { target: { value: "2026-06-01" } });

      expect(mockedUseAuditLogsQuery).toHaveBeenLastCalledWith({ from: "2026-06-01" });

      fireEvent.change(dateInputs[1]!, { target: { value: "2026-06-30" } });

      expect(mockedUseAuditLogsQuery).toHaveBeenLastCalledWith({
        from: "2026-06-01",
        to: "2026-06-30",
      });
    });

    it("the Clear button resets every filter and starts disabled", () => {
      render(<AuditLogView />);

      const clearButton = screen.getByText("filterClear");
      expect(clearButton).toBeDisabled();

      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0]!, { target: { value: "2026-06-01" } });
      expect(clearButton).not.toBeDisabled();

      fireEvent.click(clearButton);

      expect(mockedUseAuditLogsQuery).toHaveBeenLastCalledWith({});
    });
  });

  /**
   * Story S-8a — paging behaviour. `page` lives inside the same filters
   * object as everything else, so a page change is a new query key and
   * inherits Story S-7's row preservation for free.
   */
  describe("pagination (Story S-8a)", () => {
    const middlePage = { total: 60, page: 2, pageSize: 25, totalPages: 3 };

    beforeEach(() => {
      mockedUseAuditLogsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([baseLog], middlePage) }) as never,
      );
    });

    it("renders no pager when everything fits on one page", () => {
      mockedUseAuditLogsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([baseLog]) }) as never,
      );

      render(<AuditLogView />);

      // A single-page trail should look exactly as it did before S-8a.
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("renders the pager and the current page indicator once there is more than one page", () => {
      render(<AuditLogView />);

      expect(screen.getByRole("navigation", { name: "pagination.label" })).toBeInTheDocument();
      expect(
        screen.getByText('pagination.indicator:{"page":2,"totalPages":3}'),
      ).toBeInTheDocument();
    });

    it("requests the next page without touching the filters", () => {
      render(<AuditLogView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));

      expect(mockedUseAuditLogsQuery).toHaveBeenLastCalledWith({ page: 3 });
    });

    it("requests the previous page", () => {
      render(<AuditLogView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.previous" }));

      expect(mockedUseAuditLogsQuery).toHaveBeenLastCalledWith({ page: 1 });
    });

    it("disables previous on the first page", () => {
      mockedUseAuditLogsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([baseLog], { ...middlePage, page: 1 }),
        }) as never,
      );

      render(<AuditLogView />);

      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.next" })).toBeEnabled();
    });

    it("disables next on the last page", () => {
      mockedUseAuditLogsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([baseLog], { ...middlePage, page: 3 }),
        }) as never,
      );

      render(<AuditLogView />);

      expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeEnabled();
    });

    it("keeps the previous page's rows on screen while the next one loads", () => {
      mockedUseAuditLogsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([baseLog], middlePage),
        }) as never,
      );

      const { container } = render(<AuditLogView />);

      // The whole point: no skeleton swap between pages.
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByText("ticket.update")).toBeInTheDocument();
      expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    });

    it("shows a polite fetch indicator while a page change is in flight", () => {
      mockedUseAuditLogsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([baseLog], middlePage),
        }) as never,
      );

      render(<AuditLogView />);

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("updating");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("blocks both controls while a page change is in flight", () => {
      mockedUseAuditLogsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([baseLog], middlePage),
        }) as never,
      );

      render(<AuditLogView />);

      // Stops a rapid double-click queueing a second jump.
      expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    });

    it("shows no fetch indicator once the page has landed", () => {
      render(<AuditLogView />);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("resets to page 1 when a filter changes, in the same update", () => {
      render(<AuditLogView />);

      const input = screen.getByPlaceholderText("filterActionPlaceholder");
      fireEvent.change(input, { target: { value: "ticket.update" } });
      fireEvent.blur(input);

      // `page` is cleared rather than set to 1: the same request, and it
      // keeps the query key identical to a first visit.
      expect(mockedUseAuditLogsQuery).toHaveBeenLastCalledWith({
        action: "ticket.update",
        page: undefined,
      });
    });

    it("resets to page 1 when the filters are cleared", () => {
      render(<AuditLogView />);

      const input = screen.getByPlaceholderText("filterActionPlaceholder");
      fireEvent.change(input, { target: { value: "ticket.update" } });
      fireEvent.blur(input);
      fireEvent.click(screen.getByText("filterClear"));

      expect(mockedUseAuditLogsQuery).toHaveBeenLastCalledWith({});
    });

    it("still shows the empty state for a genuinely empty page", () => {
      mockedUseAuditLogsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([], { total: 0, totalPages: 1 }) }) as never,
      );

      render(<AuditLogView />);

      expect(screen.getByText("empty")).toBeInTheDocument();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });
  });
});
