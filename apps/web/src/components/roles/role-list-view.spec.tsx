import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoleListView } from "./role-list-view";
import { usePermissionsQuery, useRolesQuery } from "@/hooks/use-roles";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-roles", () => ({
  useRolesQuery: vi.fn(),
  usePermissionsQuery: vi.fn(),
}));

const mockedUseRolesQuery = vi.mocked(useRolesQuery);
const mockedUsePermissionsQuery = vi.mocked(usePermissionsQuery);

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

describe("RoleListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUsePermissionsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [] }) as never,
    );
  });

  it("shows a loading state while the roles query is pending", () => {
    mockedUseRolesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<RoleListView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows an error state with a retry action when the roles query fails", () => {
    const refetch = vi.fn();
    mockedUseRolesQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<RoleListView />);

    expect(screen.getByText("list.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("list.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are no roles", () => {
    mockedUseRolesQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);

    render(<RoleListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("renders a row per role with its permission count, collapsed by default", () => {
    mockedUseRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "role-1", name: "Agent", permissions: ["ticket:read", "ticket:update"] }],
      }) as never,
    );

    render(<RoleListView />);

    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("ticket:read")).not.toBeInTheDocument();
    expect(screen.getByText("list.expand")).toBeInTheDocument();
  });

  it("expands a role to show its real permission keys, then collapses again", () => {
    mockedUseRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "role-1", name: "Agent", permissions: ["ticket:read", "ticket:update"] }],
      }) as never,
    );

    render(<RoleListView />);
    fireEvent.click(screen.getByText("list.expand"));

    expect(screen.getByText("ticket:read")).toBeInTheDocument();
    expect(screen.getByText("ticket:update")).toBeInTheDocument();
    expect(screen.getByText("list.collapse")).toBeInTheDocument();

    fireEvent.click(screen.getByText("list.collapse"));

    expect(screen.queryByText("ticket:read")).not.toBeInTheDocument();
  });

  it("shows a no-permissions message for a role with an empty permission list", () => {
    mockedUseRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "role-1", name: "Viewer", permissions: [] }],
      }) as never,
    );

    render(<RoleListView />);
    fireEvent.click(screen.getByText("list.expand"));

    expect(screen.getByText("list.noPermissions")).toBeInTheDocument();
  });

  it("renders the all-permissions reference list independently of the roles section", () => {
    mockedUseRolesQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);
    mockedUsePermissionsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          { id: "perm-1", key: "ticket:read" },
          { id: "perm-2", key: "customer:update" },
        ],
      }) as never,
    );

    render(<RoleListView />);

    expect(screen.getByText("ticket:read")).toBeInTheDocument();
    expect(screen.getByText("customer:update")).toBeInTheDocument();
  });

  it("shows an independent error state for the permissions reference list", () => {
    mockedUseRolesQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);
    const refetch = vi.fn();
    mockedUsePermissionsQuery.mockReturnValue(
      queryResult({ isError: true, refetch }) as never,
    );

    render(<RoleListView />);

    expect(screen.getByText("list.permissionsError")).toBeInTheDocument();
    fireEvent.click(screen.getByText("list.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
