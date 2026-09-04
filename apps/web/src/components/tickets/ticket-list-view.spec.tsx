import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketListView } from "./ticket-list-view";
import { useCustomersQuery, useTicketsQuery, useUsersQuery } from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";

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

vi.mock("@/hooks/use-ticket-categories", () => ({
  useTicketCategoriesQuery: vi.fn(),
}));

const mockedUseTicketsQuery = vi.mocked(useTicketsQuery);
const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);
const mockedUseUsersQuery = vi.mocked(useUsersQuery);
const mockedUseTicketCategoriesQuery = vi.mocked(useTicketCategoriesQuery);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    // Story S-7 — `isPending` is what the views branch on now: with
    // `placeholderData: keepPreviousData` a query only reports `pending`
    // when it has no data at all, which is exactly "show the skeleton".
    // `isPlaceholderData` marks rows that are about to be replaced.
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

describe("TicketListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCustomersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseTicketCategoriesQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
  });

  it("shows a skeleton on the initial load, before any data exists", () => {
    mockedUseTicketsQuery.mockReturnValue(queryResult({ isPending: true }) as never);

    const { container } = render(<TicketListView />);

    // Previously this asserted `getAllByRole("generic").length > 0`, which
    // any `div` satisfies - it passed whether or not a skeleton rendered.
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // And the load is announced once, not per bar.
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
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
            categoryId: "category-1",
            categoryName: "billing",
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

  // Story 98 — Design System & Visual Polish.
  describe("status badge color semantics (Story 98)", () => {
    function ticketWith(status: string) {
      return {
        id: `ticket-${status}`,
        subject: `Ticket ${status}`,
        categoryId: null,
        categoryName: null,
        priority: "LOW",
        status,
        customerId: "customer-1",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        slaTarget: null,
      };
    }

    it.each([
      ["OPEN", "bg-warning-surface"],
      ["IN_PROGRESS", "bg-surface-muted"],
      ["RESOLVED", "bg-success-surface"],
      ["CLOSED", "border-rule-strong"],
    ])("gives %s status a distinct visual treatment", (status, expectedClass) => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [ticketWith(status)] }) as never,
      );

      render(<TicketListView />);

      expect(screen.getByText(status)).toHaveClass(expectedClass);
    });

    it("gives OPEN and RESOLVED visually distinct badge classes from one another", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [ticketWith("OPEN"), ticketWith("RESOLVED")],
        }) as never,
      );

      render(<TicketListView />);

      expect(screen.getByText("OPEN").className).not.toBe(screen.getByText("RESOLVED").className);
    });
  });

  /**
   * Story 98 gave each row a `role="button"`/`tabIndex` so it could be
   * reached by keyboard. Story S-6 replaced that with real links on the
   * subject and customer cells, which is better on every axis the fake
   * button approximated: natively in the tab order, announced as a link,
   * and middle-clickable. The row keeps its click for the mouse only.
   */
  it("gives each ticket row natively focusable links for its ticket and its customer", () => {
    mockedUseTicketsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          {
            id: "ticket-1",
            subject: "Cannot log in",
            categoryId: null,
            categoryName: null,
            priority: "LOW",
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

    const subject = screen.getByRole("link", { name: "Cannot log in" });
    expect(subject).toHaveAttribute("href", "/en/tickets/ticket-1");
    expect(subject).not.toHaveAttribute("tabIndex");
    subject.focus();
    expect(subject).toHaveFocus();

    // The customer cell is a sibling link, no longer a button nested inside
    // a role="button" row.
    expect(screen.getByRole("link", { name: "customer-1" })).toHaveAttribute(
      "href",
      "/en/customers/customer-1",
    );
  });

  /**
   * Story S-7 — the refetch state machine.
   *
   * The filters are part of the query key, so changing one is a brand new
   * query. Before this story that put the query back into `pending`, which
   * replaced the whole table with a skeleton on every filter change, search
   * blur and sort toggle. `placeholderData: keepPreviousData` now serves the
   * previous key's rows while the new key resolves, and these tests pin the
   * four states that distinction creates.
   */
  describe("refetch UX (Story S-7)", () => {
    const ticket = (overrides: Record<string, unknown> = {}) => ({
      id: "ticket-1",
      subject: "Cannot log in",
      categoryId: "category-1",
      categoryName: "billing",
      priority: "HIGH",
      status: "OPEN",
      customerId: "customer-1",
      contactId: null,
      departmentId: null,
      assignedToUserId: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      slaTarget: null,
      ...overrides,
    });

    it("keeps the previous rows on screen while a new filter resolves", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          data: [ticket()],
          isSuccess: true,
          // The shape TanStack reports for a new key backed by the previous
          // key's data: content, not pending.
          isPlaceholderData: true,
          isFetching: true,
        }) as never,
      );

      const { container } = render(<TicketListView />);

      expect(screen.getByRole("link", { name: "Cannot log in" })).toBeInTheDocument();
      // The whole point: no skeleton swap.
      expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("shows a polite background-fetch indicator over the surviving rows", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ data: [ticket()], isSuccess: true, isPlaceholderData: true }) as never,
      );

      render(<TicketListView />);

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("updating");
      expect(status).toHaveAttribute("aria-live", "polite");
      // Never an interruption.
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows no indicator once the new results have landed", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ data: [ticket()], isSuccess: true }) as never,
      );

      render(<TicketListView />);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("replaces the previous rows when the new results arrive", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ data: [ticket()], isSuccess: true, isPlaceholderData: true }) as never,
      );
      const { rerender } = render(<TicketListView />);
      expect(screen.getByRole("link", { name: "Cannot log in" })).toBeInTheDocument();

      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          data: [ticket({ id: "ticket-2", subject: "Refund not received" })],
          isSuccess: true,
        }) as never,
      );
      rerender(<TicketListView />);

      expect(screen.getByRole("link", { name: "Refund not received" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Cannot log in" })).not.toBeInTheDocument();
    });

    it("keeps the rows when a background refetch fails, with a non-destructive notice", () => {
      const refetch = vi.fn();
      mockedUseTicketsQuery.mockReturnValue(
        // v5 keeps `data` from the last success through an error.
        queryResult({ data: [ticket()], isError: true, refetch }) as never,
      );

      render(<TicketListView />);

      // The rows the user was reading are still there.
      expect(screen.getByRole("link", { name: "Cannot log in" })).toBeInTheDocument();
      expect(screen.getByRole("table")).toBeInTheDocument();
      // And the failure is a status, not an assertive alert that wipes the
      // screen - but retry is still offered.
      expect(screen.getByRole("status")).toHaveTextContent("list.error");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "list.retry" }));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it("still shows the destructive error state when there is no data to fall back on", () => {
      const refetch = vi.fn();
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ data: undefined, isError: true, refetch }) as never,
      );

      render(<TicketListView />);

      expect(screen.getByRole("alert")).toHaveTextContent("list.error");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "list.retry" }));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it("shows the empty state only when the resolved query really has no rows", () => {
      mockedUseTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
      const { rerender, container } = render(<TicketListView />);
      expect(screen.getByText("list.empty")).toBeInTheDocument();

      // A refetch in progress over previous rows must NOT read as empty.
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ data: [ticket()], isSuccess: true, isPlaceholderData: true }) as never,
      );
      rerender(<TicketListView />);
      expect(screen.queryByText("list.empty")).not.toBeInTheDocument();
      expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    });
  });
});
