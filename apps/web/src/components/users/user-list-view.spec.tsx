import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserListView } from "./user-list-view";
import { useUpdateUserMutation, useUsersQuery } from "@/hooks/use-tickets";
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
  useUsersQuery: vi.fn(),
  useUpdateUserMutation: vi.fn(),
}));

const mockedUseUsersQuery = vi.mocked(useUsersQuery);
const mockedUseUpdateUserMutation = vi.mocked(useUpdateUserMutation);

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

function mutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

const baseUser = {
  id: "user-1",
  email: "agent@example.com",
  fullName: "Ada Lovelace",
  isActive: true,
  roles: ["Agent"],
};

describe("UserListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdateUserMutation.mockReturnValue(mutationResult() as never);
  });

  it("navigates to /users/new when 'New user' is clicked", () => {
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<UserListView />);
    fireEvent.click(screen.getByText("list.createButton"));

    expect(push).toHaveBeenCalledWith("/en/users/new");
  });

  it("shows a loading state while the users query is pending", () => {
    mockedUseUsersQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<UserListView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows the empty state when the query succeeds with zero users", () => {
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<UserListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("shows an error state with a retry action when the query fails", () => {
    const refetch = vi.fn();
    mockedUseUsersQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<UserListView />);

    expect(screen.getByText("list.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("list.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders a row per user once the query succeeds, with roles and status", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );

    render(<UserListView />);

    expect(screen.getByText("agent@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("list.active")).toBeInTheDocument();
    expect(screen.getByText("list.deactivate")).toBeInTheDocument();
  });

  it("commits a rename on blur when the name changed", () => {
    const mutate = vi.fn();
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );
    mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<UserListView />);

    const input = screen.getByDisplayValue("Ada Lovelace");
    fireEvent.change(input, { target: { value: "Ada L." } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith(
      { fullName: "Ada L." },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("toggles active state via the activate/deactivate button", () => {
    const mutate = vi.fn();
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );
    mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<UserListView />);

    fireEvent.click(screen.getByText("list.deactivate"));

    expect(mutate).toHaveBeenCalledWith({ isActive: false });
  });

  it("renders an inline permission error when a mutation is rejected with 403", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );
    mockedUseUpdateUserMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<UserListView />);

    expect(screen.getByText("list.actionForbidden")).toBeInTheDocument();
  });

  it("renders a generic action-failed message for a non-403 mutation error", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );
    mockedUseUpdateUserMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<UserListView />);

    expect(screen.getByText("list.actionFailed")).toBeInTheDocument();
  });
});
