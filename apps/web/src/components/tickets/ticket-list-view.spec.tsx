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
});
