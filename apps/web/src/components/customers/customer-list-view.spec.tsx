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

/**
 * Story S-8e — `GET /tickets` and `GET /customers` return a
 * `Paginated<T>` envelope, so these queries' `data` is no longer a bare
 * array. Builds one, defaulting to a single full page so the existing
 * tests read exactly as they did before. Mirrors
 * `audit-log-view.spec.tsx`'s own helper.
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

describe("CustomerListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a skeleton on the initial load, before any data exists", () => {
    mockedUseCustomersQuery.mockReturnValue(queryResult({ isPending: true }) as never);

    const { container } = render(<CustomerListView />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
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
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );

    render(<CustomerListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("renders a row per customer with an active/inactive badge", () => {
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: page([
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
        ]),
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
        data: page([{ id: "customer-1", displayName: "Acme Inc.", isActive: true }]),
      }) as never,
    );

    render(<CustomerListView />);

    expect(screen.getByRole("link", { name: "Acme Inc." })).toHaveAttribute(
      "href",
      "/en/customers/customer-1",
    );
  });

  it("links the create button to the create-customer route", () => {
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );

    render(<CustomerListView />);

    expect(screen.getByRole("link", { name: "list.createButton" })).toHaveAttribute(
      "href",
      "/en/customers/new",
    );
  });

  /**
   * Story 98 gave each row a `role="button"`/`tabIndex` so it could be
   * reached by keyboard. Story S-6 replaced that with a real link on the
   * name cell, which is better on every axis the fake button was trying to
   * approximate: it is in the tab order natively, announces itself as a
   * link, and can be middle-clicked or opened in a new tab. The row keeps
   * its click as a mouse convenience, so what this now asserts is that
   * keyboard users have a genuine, focusable link to the same destination.
   */
  it("gives each customer row a natively focusable link to its detail route", () => {
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: page([{ id: "customer-1", displayName: "Acme Inc.", isActive: true }]),
      }) as never,
    );

    render(<CustomerListView />);

    const link = screen.getByRole("link", { name: "Acme Inc." });
    expect(link).toHaveAttribute("href", "/en/customers/customer-1");
    // A real anchor with an href is focusable without any tabIndex of its own.
    expect(link).not.toHaveAttribute("tabIndex");
    link.focus();
    expect(link).toHaveFocus();
  });

  // Story 101 — Customer Management: List Search/Filter.
  describe("filter bar (Story 101)", () => {
    it("defaults to sorting by createdAt ascending, and commits a search on blur", () => {
      mockedUseCustomersQuery.mockReturnValue(
        queryResult({ data: page([]), isSuccess: true }) as never,
      );

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
      mockedUseCustomersQuery.mockReturnValue(
        queryResult({ data: page([]), isSuccess: true }) as never,
      );

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
      mockedUseCustomersQuery.mockReturnValue(
        queryResult({ data: page([]), isSuccess: true }) as never,
      );

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
          data: page([
            {
              id: "customer-1",
              displayName: "Acme Inc.",
              isActive: true,
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
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

    // A11Y-2 — `aria-sort`, the semantic counterpart to `SortIndicator`'s
    // visual arrow. Previously absent on every sortable header in the app.
    it('reflects the active sort column and direction via aria-sort on the <th>, and "none" on the rest', () => {
      mockedUseCustomersQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([{ id: "customer-1", displayName: "Acme Inc.", isActive: true }]),
        }) as never,
      );

      render(<CustomerListView />);
      const nameHeader = screen.getByRole("columnheader", { name: /list\.columns\.name/ });
      const createdAtHeader = screen.getByRole("columnheader", {
        name: /list\.columns\.createdAt/,
      });
      // Default sort is createdAt asc (asserted above in this same describe block).
      expect(nameHeader).toHaveAttribute("aria-sort", "none");
      expect(createdAtHeader).toHaveAttribute("aria-sort", "ascending");

      fireEvent.click(screen.getByRole("button", { name: /list\.columns\.name/ }));

      expect(screen.getByRole("columnheader", { name: /list\.columns\.name/ })).toHaveAttribute(
        "aria-sort",
        "ascending",
      );
      expect(
        screen.getByRole("columnheader", { name: /list\.columns\.createdAt/ }),
      ).toHaveAttribute("aria-sort", "none");
    });

    // A11Y-2 — this Select previously had no `aria-label`, `aria-labelledby`
    // or associated `<label>`, relying only on implicit wrapping.
    it("gives the status filter combobox an accessible name", () => {
      mockedUseCustomersQuery.mockReturnValue(
        queryResult({ data: page([]), isSuccess: true }) as never,
      );

      render(<CustomerListView />);

      expect(screen.getByRole("combobox", { name: "list.filterStatus" })).toBeInTheDocument();
    });
  });
  /** Story S-8e — `GET /customers` is paginated, replacing the Story 106
   * 500-row cap. Mirrors `TicketListView`'s own pager tests. */
  describe("pagination (Story S-8e)", () => {
    const middlePage = { total: 60, page: 2, pageSize: 25, totalPages: 3 };
    const row = { id: "customer-1", displayName: "Acme Inc.", isActive: true };

    beforeEach(() => {
      mockedUseCustomersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([row], middlePage) }) as never,
      );
    });

    it("renders no pager when everything fits on one page", () => {
      mockedUseCustomersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([row]) }) as never,
      );

      render(<CustomerListView />);

      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("renders the pager and the current page indicator once there is more than one page", () => {
      render(<CustomerListView />);

      expect(screen.getByRole("navigation", { name: "pagination.label" })).toBeInTheDocument();
      expect(
        screen.getByText('pagination.indicator:{"page":2,"totalPages":3}'),
      ).toBeInTheDocument();
    });

    it("requests the next page without touching the filters", () => {
      render(<CustomerListView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));

      expect(mockedUseCustomersQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3, sortBy: "createdAt", sortDir: "asc" }),
      );
    });

    it("disables both controls while the previous page is still on screen", () => {
      mockedUseCustomersQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([row], middlePage),
        }) as never,
      );

      render(<CustomerListView />);

      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
    });
  });
});
