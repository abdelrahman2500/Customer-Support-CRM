import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TicketListView } from "./ticket-list-view";
import { useCreateMyTicketMutation, useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import { ApiError } from "@/lib/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-tickets", () => ({
  useMyTicketsQuery: vi.fn(),
  useCreateMyTicketMutation: vi.fn(),
}));

const mockedUseMyTicketsQuery = vi.mocked(useMyTicketsQuery);
const mockedUseCreateMyTicketMutation = vi.mocked(useCreateMyTicketMutation);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    isSuccess: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

/** PORTAL-1 — `useMyTicketsQuery` now resolves a `Paginated<T>` envelope,
 * not a flat array. Mirrors `article-list-view.spec.tsx`'s own `page()`
 * helper exactly. */
function ticketPage(items: unknown[], overrides: Record<string, unknown> = {}) {
  return { items, total: items.length, page: 1, pageSize: 25, totalPages: 1, ...overrides };
}

function idleMutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, ...overrides };
}

const baseTicket = {
  id: "ticket-1",
  subject: "Cannot log in",
  categoryId: "category-1",
  categoryName: "account",
  priority: "MEDIUM",
  status: "OPEN",
  customerId: "customer-1",
  contactId: "contact-1",
  departmentId: null,
  assignedToUserId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("TicketListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateMyTicketMutation.mockReturnValue(idleMutation() as never);
  });

  it("shows a loading state while the tickets query is pending", () => {
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ isPending: true }) as never);

    const { container } = render(<TicketListView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows an error state with a retry action when the query fails", () => {
    const refetch = vi.fn();
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<TicketListView />);

    expect(screen.getByText("list.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("list.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are no tickets", () => {
    mockedUseMyTicketsQuery.mockReturnValue(
      queryResult({ data: ticketPage([]), isSuccess: true }) as never,
    );

    render(<TicketListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("renders a row per ticket linking to its locale-correct detail route", () => {
    mockedUseMyTicketsQuery.mockReturnValue(
      queryResult({ data: ticketPage([baseTicket]), isSuccess: true }) as never,
    );

    render(<TicketListView />);

    const link = screen.getByRole("link", { name: "Cannot log in" });
    expect(link).toHaveAttribute("href", "/en/tickets/ticket-1");
  });

  it("disables the create-ticket submit button until a subject is entered", () => {
    mockedUseMyTicketsQuery.mockReturnValue(
      queryResult({ data: ticketPage([]), isSuccess: true }) as never,
    );

    render(<TicketListView />);

    const submit = screen.getByText("list.createSubmit");
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("list.createSubjectLabel"), {
      target: { value: "Billing question" },
    });
    expect(submit).not.toBeDisabled();
  });

  it("submits the exact payload (with optional category) and clears the form on success", async () => {
    mockedUseMyTicketsQuery.mockReturnValue(
      queryResult({ data: ticketPage([]), isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue({ id: "ticket-2" });
    mockedUseCreateMyTicketMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

    render(<TicketListView />);
    fireEvent.change(screen.getByLabelText("list.createSubjectLabel"), {
      target: { value: "Billing question" },
    });
    fireEvent.change(screen.getByLabelText("list.createCategoryLabel"), {
      target: { value: "billing" },
    });
    fireEvent.click(screen.getByText("list.createSubmit"));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        subject: "Billing question",
        category: "billing",
      }),
    );
    await waitFor(() => expect(screen.getByLabelText("list.createSubjectLabel")).toHaveValue(""));
  });

  it("submits without a category when left blank", async () => {
    mockedUseMyTicketsQuery.mockReturnValue(
      queryResult({ data: ticketPage([]), isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue({ id: "ticket-2" });
    mockedUseCreateMyTicketMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

    render(<TicketListView />);
    fireEvent.change(screen.getByLabelText("list.createSubjectLabel"), {
      target: { value: "Billing question" },
    });
    fireEvent.click(screen.getByText("list.createSubmit"));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ subject: "Billing question" }));
  });

  it("renders the backend's own message inline when the submission fails", async () => {
    mockedUseMyTicketsQuery.mockReturnValue(
      queryResult({ data: ticketPage([]), isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Subject is required", 400));
    mockedUseCreateMyTicketMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

    render(<TicketListView />);
    fireEvent.change(screen.getByLabelText("list.createSubjectLabel"), {
      target: { value: "Billing question" },
    });
    fireEvent.click(screen.getByText("list.createSubmit"));

    expect(await screen.findByText("Subject is required")).toBeInTheDocument();
  });

  /**
   * PORTAL-1 — Portal My Tickets Pagination. Mirrors
   * `article-list-view.spec.tsx`'s own "pagination (Story S-8c)" describe
   * block exactly — same primitive, same fetch semantics.
   */
  describe("pagination (PORTAL-1)", () => {
    const middlePage = { total: 60, page: 2, pageSize: 25, totalPages: 3 };

    beforeEach(() => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: ticketPage([baseTicket], middlePage) }) as never,
      );
    });

    it("renders no pager when the tickets fit on one page", () => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: ticketPage([baseTicket]) }) as never,
      );

      render(<TicketListView />);

      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("renders the pager and page indicator once there is more than one page", () => {
      render(<TicketListView />);

      expect(screen.getByRole("navigation", { name: "pagination.label" })).toBeInTheDocument();
      expect(screen.getByText("pagination.indicator")).toBeInTheDocument();
    });

    it("requests the next page", () => {
      render(<TicketListView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));

      expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith({ page: 3 });
    });

    it("requests the previous page", () => {
      render(<TicketListView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.previous" }));

      expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith({ page: 1 });
    });

    it("disables previous on the first page", () => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: ticketPage([baseTicket], { ...middlePage, page: 1 }),
        }) as never,
      );

      render(<TicketListView />);

      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.next" })).toBeEnabled();
    });

    it("disables next on the last page", () => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: ticketPage([baseTicket], { ...middlePage, page: 3 }),
        }) as never,
      );

      render(<TicketListView />);

      expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeEnabled();
    });

    it("keeps the previous page's rows on screen while the next one loads", () => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: ticketPage([baseTicket], middlePage),
        }) as never,
      );

      const { container } = render(<TicketListView />);

      expect(screen.getByText("Cannot log in")).toBeInTheDocument();
      expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    });

    it("shows a polite fetch indicator while a page change is in flight", () => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: ticketPage([baseTicket], middlePage),
        }) as never,
      );

      render(<TicketListView />);

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("updating");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("blocks both controls while a page change is in flight", () => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: ticketPage([baseTicket], middlePage),
        }) as never,
      );

      render(<TicketListView />);

      expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    });
  });

  /**
   * Story 148 — Portal Ticket Search & Filtering.
   *
   * These assert what the screen ASKS FOR, not what comes back: the query
   * hook is mocked, so the meaningful observable is the argument object
   * `useMyTicketsQuery` is called with. The server's side of the same
   * behaviour is covered end-to-end in `portal-tickets.e2e-spec.ts`.
   */
  describe("search and status filtering", () => {
    beforeEach(() => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: ticketPage([baseTicket]) }) as never,
      );
    });

    it("asks for nothing but the page until a filter is touched", () => {
      render(<TicketListView />);

      // The byte-identical request the list made before this story.
      expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith({ page: undefined });
    });

    it("sends the typed text as a search term", async () => {
      render(<TicketListView />);

      fireEvent.change(screen.getByLabelText("list.searchLabel"), {
        target: { value: "printer" },
      });

      await waitFor(() =>
        expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith({
          page: undefined,
          search: "printer",
        }),
      );
    });

    it("omits an emptied search term rather than sending a blank one", async () => {
      render(<TicketListView />);
      const input = screen.getByLabelText("list.searchLabel");

      fireEvent.change(input, { target: { value: "printer" } });
      fireEvent.change(input, { target: { value: "" } });

      await waitFor(() =>
        expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith({ page: undefined }),
      );
    });

    it("resets to page 1 when the search changes, so it cannot ask for page 3 of a new search", async () => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: ticketPage([baseTicket], { total: 60, page: 2, pageSize: 25, totalPages: 3 }),
        }) as never,
      );
      render(<TicketListView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));
      expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith({ page: 3 });

      fireEvent.change(screen.getByLabelText("list.searchLabel"), {
        target: { value: "printer" },
      });

      await waitFor(() =>
        expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith({
          page: undefined,
          search: "printer",
        }),
      );
    });

    it("shows the match count and a clear control only once a filter is active", async () => {
      render(<TicketListView />);

      expect(screen.queryByRole("button", { name: "list.clearFilters" })).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("list.searchLabel"), {
        target: { value: "printer" },
      });

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "list.clearFilters" })).toBeInTheDocument(),
      );
      expect(screen.getByText("list.resultCount")).toBeInTheDocument();
    });

    it("clearing the filters restores the unfiltered request and hides the clear control", async () => {
      render(<TicketListView />);

      fireEvent.change(screen.getByLabelText("list.searchLabel"), {
        target: { value: "printer" },
      });
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "list.clearFilters" })).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: "list.clearFilters" }));

      await waitFor(() =>
        expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith({ page: undefined }),
      );
      expect(screen.queryByRole("button", { name: "list.clearFilters" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("list.searchLabel")).toHaveValue("");
    });

    it("distinguishes an empty account from a search that matched nothing", async () => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: ticketPage([]) }) as never,
      );
      render(<TicketListView />);

      // Nothing filtered: this customer genuinely has no tickets.
      expect(screen.getByText("list.empty")).toBeInTheDocument();
      expect(screen.queryByText("list.noResults")).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("list.searchLabel"), {
        target: { value: "printer" },
      });

      // Filtered: they may have plenty, just none matching.
      await waitFor(() => expect(screen.getByText("list.noResults")).toBeInTheDocument());
      expect(screen.queryByText("list.empty")).not.toBeInTheDocument();
      // Exactly one clear control, even though the active-filter row and
      // the no-results message are both on screen at once.
      expect(screen.getAllByRole("button", { name: "list.clearFilters" })).toHaveLength(1);
    });

    it("offers every real TicketStatus, plus an any-status option", async () => {
      render(<TicketListView />);

      fireEvent.click(screen.getByRole("combobox", { name: "list.filterStatus" }));

      await waitFor(() =>
        expect(screen.getByRole("option", { name: "list.filterAll" })).toBeInTheDocument(),
      );
      for (const status of ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) {
        expect(screen.getByRole("option", { name: `status.${status}` })).toBeInTheDocument();
      }
    });
  });

  // Story 98 — Design System & Visual Polish.
  it("gives each status a visually distinct pill, mirroring apps/web's own status color semantics", () => {
    mockedUseMyTicketsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: ticketPage([
          { ...baseTicket, id: "t-open", status: "OPEN" },
          { ...baseTicket, id: "t-resolved", status: "RESOLVED" },
        ]),
      }) as never,
    );

    render(<TicketListView />);

    // Story 148 — the badge renders the translated label rather than the
    // raw enum; this file stubs `useTranslations` to echo the key, so the
    // key is what appears here. `fetch-state-messages.spec.ts` is where
    // the real copy is asserted to exist in both locales. Same two
    // statuses, same two variants as before.
    expect(screen.getByText("status.OPEN")).toHaveClass("bg-warning-surface");
    expect(screen.getByText("status.RESOLVED")).toHaveClass("bg-success-surface");
  });
});
