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

      expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith(3);
    });

    it("requests the previous page", () => {
      render(<TicketListView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.previous" }));

      expect(mockedUseMyTicketsQuery).toHaveBeenLastCalledWith(1);
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

    expect(screen.getByText("OPEN")).toHaveClass("bg-warning-surface");
    expect(screen.getByText("RESOLVED")).toHaveClass("bg-success-surface");
  });
});
