import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CustomerListView } from "./customer-list-view";
import { useCustomersQuery } from "@/hooks/use-tickets";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-tickets", () => ({
  useCustomersQuery: vi.fn(),
}));

const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);

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

describe("CustomerListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the customers query is pending", () => {
    mockedUseCustomersQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<CustomerListView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows an error state with a retry action when the query fails", () => {
    const refetch = vi.fn();
    mockedUseCustomersQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<CustomerListView />);

    expect(screen.getByText("list.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("list.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when the query succeeds with zero customers", () => {
    mockedUseCustomersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<CustomerListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("renders a row per customer with an active/inactive badge", () => {
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          {
            id: "customer-1",
            displayName: "Acme Inc.",
            isActive: true,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "customer-2",
            displayName: "Retired Co.",
            isActive: false,
            createdAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      }) as never,
    );

    render(<CustomerListView />);

    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
    expect(screen.getByText("Retired Co.")).toBeInTheDocument();
    expect(screen.getByText("list.active")).toBeInTheDocument();
    expect(screen.getByText("list.inactive")).toBeInTheDocument();
  });

  it("navigates to the customer's detail page when a row is clicked", () => {
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "customer-1", displayName: "Acme Inc.", isActive: true }],
      }) as never,
    );

    render(<CustomerListView />);
    fireEvent.click(screen.getByText("Acme Inc."));

    expect(push).toHaveBeenCalledWith("/en/customers/customer-1");
  });

  it("navigates to the create-customer route when the create button is clicked", () => {
    mockedUseCustomersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<CustomerListView />);
    fireEvent.click(screen.getByRole("button", { name: "list.createButton" }));

    expect(push).toHaveBeenCalledWith("/en/customers/new");
  });

  // Story 98 — Design System & Visual Polish.
  it("marks each customer row as a keyboard-accessible button, navigating on Enter", () => {
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "customer-1", displayName: "Acme Inc.", isActive: true }],
      }) as never,
    );

    render(<CustomerListView />);
    const row = screen.getByText("Acme Inc.").closest('[role="button"]');
    expect(row).toHaveAttribute("tabIndex", "0");

    fireEvent.keyDown(row!, { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/en/customers/customer-1");
  });

  // Story 101 — Customer Management: List Search/Filter.
  describe("filter bar (Story 101)", () => {
    it("defaults to sorting by createdAt ascending, and commits a search on blur", () => {
      mockedUseCustomersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

      render(<CustomerListView />);
      expect(mockedUseCustomersQuery).toHaveBeenCalledWith({ sortBy: "createdAt", sortDir: "asc" });

      const input = screen.getByPlaceholderText("list.searchPlaceholder");
      fireEvent.change(input, { target: { value: "acme" } });
      fireEvent.blur(input);

      expect(mockedUseCustomersQuery).toHaveBeenCalledWith({
        sortBy: "createdAt",
        sortDir: "asc",
        search: "acme",
      });
    });

    it("clearing the search field on blur removes the filter rather than sending an empty string", () => {
      mockedUseCustomersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

      render(<CustomerListView />);
      const input = screen.getByPlaceholderText("list.searchPlaceholder");
      fireEvent.change(input, { target: { value: "  " } });
      fireEvent.blur(input);

      expect(mockedUseCustomersQuery).toHaveBeenLastCalledWith({
        sortBy: "createdAt",
        sortDir: "asc",
        search: undefined,
      });
    });

    it("filters by isActive via the status select", async () => {
      mockedUseCustomersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

      render(<CustomerListView />);
      const statusCombobox = screen.getByRole("combobox");
      fireEvent.click(statusCombobox);
      fireEvent.click(await screen.findByRole("option", { name: "list.active" }));

      expect(mockedUseCustomersQuery).toHaveBeenLastCalledWith({
        sortBy: "createdAt",
        sortDir: "asc",
        isActive: "true",
      });
    });

    it("toggles sort direction when the same column header is clicked twice", () => {
      mockedUseCustomersQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [
            {
              id: "customer-1",
              displayName: "Acme Inc.",
              isActive: true,
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }) as never,
      );

      render(<CustomerListView />);
      // A regex name matcher, not `getByText`, because the header's own
      // text content gains a trailing sort-direction arrow once it becomes
      // the active sort column — the plain string would stop matching
      // after the first click.
      const nameHeader = screen.getByRole("button", { name: /list\.columns\.name/ });
      fireEvent.click(nameHeader);

      expect(mockedUseCustomersQuery).toHaveBeenLastCalledWith({
        sortBy: "displayName",
        sortDir: "asc",
      });

      fireEvent.click(screen.getByRole("button", { name: /list\.columns\.name/ }));

      expect(mockedUseCustomersQuery).toHaveBeenLastCalledWith({
        sortBy: "displayName",
        sortDir: "desc",
      });
    });
  });
});
