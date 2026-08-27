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
          { id: "customer-1", displayName: "Acme Inc.", isActive: true },
          { id: "customer-2", displayName: "Retired Co.", isActive: false },
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
});
