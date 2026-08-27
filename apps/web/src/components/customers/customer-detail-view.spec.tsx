import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CustomerDetailView } from "./customer-detail-view";
import { useCustomerQuery, useTicketsQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";

const push = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useCustomerQuery: vi.fn(),
  useTicketsQuery: vi.fn(),
}));

const mockedUseCustomerQuery = vi.mocked(useCustomerQuery);
const mockedUseTicketsQuery = vi.mocked(useTicketsQuery);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    ...overrides,
  };
}

describe("CustomerDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every render path calls `useTicketsQuery({})` (Story 27); default to
    // an empty, successful result so pre-existing tests (which only assert
    // on the customer/contacts sections) are unaffected.
    mockedUseTicketsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [] }) as never,
    );
  });

  it("shows a loading state while the customer query is pending", () => {
    mockedUseCustomerQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("renders a not-found message when the customer lookup 404s", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<CustomerDetailView customerId="missing" />);

    expect(screen.getByText("detail.notFound")).toBeInTheDocument();
  });

  it("renders a generic load error for a non-404 failure", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getByText("detail.loadError")).toBeInTheDocument();
  });

  it("renders the customer's name, status, and contacts", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: {
          id: "customer-1",
          displayName: "Acme Inc.",
          isActive: true,
          contacts: [
            { id: "contact-1", fullName: "Jane Doe", email: "jane@acme.test", phone: null, isPrimary: true },
          ],
        },
      }) as never,
    );

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
    expect(screen.getByText("list.active")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@acme.test")).toBeInTheDocument();
    expect(screen.getByText("detail.primaryContact")).toBeInTheDocument();
  });

  it("renders an empty-contacts message when the customer has no contacts", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { id: "customer-1", displayName: "Acme Inc.", isActive: false, contacts: [] },
      }) as never,
    );

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getByText("detail.contactsEmpty")).toBeInTheDocument();
    expect(screen.getByText("list.inactive")).toBeInTheDocument();
  });

  // Story 27 — Related tickets section + "New ticket" action.
  describe("related tickets (Story 27)", () => {
    beforeEach(() => {
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: { id: "customer-1", displayName: "Acme Inc.", isActive: true, contacts: [] },
        }) as never,
      );
    });

    it("shows a loading state while the tickets query is pending", () => {
      mockedUseTicketsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.ticketsHeading")).toBeInTheDocument();
    });

    it("shows an error state when the tickets query fails", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.ticketsError")).toBeInTheDocument();
    });

    it("shows an empty-state message when the customer has no tickets", () => {
      mockedUseTicketsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.ticketsEmpty")).toBeInTheDocument();
    });

    it("lists only tickets whose customerId matches this customer, filtered client-side", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [
            {
              id: "ticket-1",
              subject: "Cannot log in",
              status: "OPEN",
              priority: "HIGH",
              customerId: "customer-1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "ticket-2",
              subject: "Unrelated ticket",
              status: "OPEN",
              priority: "LOW",
              customerId: "customer-other",
              createdAt: "2026-01-02T00:00:00.000Z",
            },
          ],
        }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("Cannot log in")).toBeInTheDocument();
      expect(screen.queryByText("Unrelated ticket")).not.toBeInTheDocument();
    });

    it("navigates to the ticket detail route when a related ticket row is clicked", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [
            {
              id: "ticket-1",
              subject: "Cannot log in",
              status: "OPEN",
              priority: "HIGH",
              customerId: "customer-1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);
      fireEvent.click(screen.getByText("Cannot log in"));

      expect(push).toHaveBeenCalledWith("/en/tickets/ticket-1");
    });

    it("navigates to tickets/new with the current customerId when 'New ticket' is clicked", () => {
      mockedUseTicketsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      fireEvent.click(screen.getByText("detail.newTicketButton"));

      expect(push).toHaveBeenCalledWith("/en/tickets/new?customerId=customer-1");
    });
  });
});
