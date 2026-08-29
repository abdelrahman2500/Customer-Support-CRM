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
    isLoading: false,
    isError: false,
    isSuccess: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function idleMutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, ...overrides };
}

const baseTicket = {
  id: "ticket-1",
  subject: "Cannot log in",
  category: "account",
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
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

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
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<TicketListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("renders a row per ticket and navigates to its detail on click", () => {
    mockedUseMyTicketsQuery.mockReturnValue(
      queryResult({ data: [baseTicket], isSuccess: true }) as never,
    );

    render(<TicketListView />);
    fireEvent.click(screen.getByText("Cannot log in"));

    expect(push).toHaveBeenCalledWith("/en/tickets/ticket-1");
  });

  it("disables the create-ticket submit button until a subject is entered", () => {
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<TicketListView />);

    const submit = screen.getByText("list.createSubmit");
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("list.createSubjectLabel"), {
      target: { value: "Billing question" },
    });
    expect(submit).not.toBeDisabled();
  });

  it("submits the exact payload (with optional category) and clears the form on success", async () => {
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
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
      expect(mutateAsync).toHaveBeenCalledWith({ subject: "Billing question", category: "billing" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("list.createSubjectLabel")).toHaveValue(""),
    );
  });

  it("submits without a category when left blank", async () => {
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    const mutateAsync = vi.fn().mockResolvedValue({ id: "ticket-2" });
    mockedUseCreateMyTicketMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

    render(<TicketListView />);
    fireEvent.change(screen.getByLabelText("list.createSubjectLabel"), {
      target: { value: "Billing question" },
    });
    fireEvent.click(screen.getByText("list.createSubmit"));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ subject: "Billing question" }),
    );
  });

  it("renders the backend's own message inline when the submission fails", async () => {
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Subject is required", 400));
    mockedUseCreateMyTicketMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

    render(<TicketListView />);
    fireEvent.change(screen.getByLabelText("list.createSubjectLabel"), {
      target: { value: "Billing question" },
    });
    fireEvent.click(screen.getByText("list.createSubmit"));

    expect(await screen.findByText("Subject is required")).toBeInTheDocument();
  });
});
