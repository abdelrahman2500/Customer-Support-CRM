import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustomerDetailView } from "./customer-detail-view";
import { useCustomerQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-tickets", () => ({
  useCustomerQuery: vi.fn(),
}));

const mockedUseCustomerQuery = vi.mocked(useCustomerQuery);

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
});
