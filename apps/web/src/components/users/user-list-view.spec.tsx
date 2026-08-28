import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { UserListView } from "./user-list-view";
import {
  useDepartmentsQuery,
  useUpdateUserAssignmentMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useRolesQuery } from "@/hooks/use-roles";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";

/**
 * Story 47 — the previously read-only `roles: string[]` badge is replaced by
 * two inline `Select`s (role, department) committing immediately via the
 * new, separate `useUpdateUserAssignmentMutation(user.id)`. This spec is
 * rewritten (not just extended) since it previously asserted on the old
 * read-only role-badge rendering and mocked `next-intl` to echo raw
 * translation keys; it now renders through a real `NextIntlClientProvider`
 * with the actual `en.json` messages — mirroring `role-list-view.spec.tsx`'s
 * and `create-user-view.spec.tsx`'s convention — so the 3-way error-message
 * assertions (403/400/409/generic) can check the real, human-readable copy
 * rather than a mocked translation key.
 *
 * Select interactions mirror `create-user-view.spec.tsx`'s established
 * pattern exactly: open a `Select` by clicking its trigger via
 * `screen.getAllByRole("combobox")[N]` (index-based, not
 * `getByRole("combobox", { name })`, since the trigger has no accessible
 * name), then `await screen.findByRole("option", { name })` to pick an item.
 * Radix mirrors every `SelectItem` into a visually-hidden native `<option>`
 * as well, so asserting a *currently-selected* value's label must be scoped
 * with `within(combobox).getByText(...)` rather than an unscoped
 * `screen.getByText(...)`, which would be ambiguous.
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useUsersQuery: vi.fn(),
  useUpdateUserMutation: vi.fn(),
  useDepartmentsQuery: vi.fn(),
  useUpdateUserAssignmentMutation: vi.fn(),
}));

vi.mock("@/hooks/use-roles", () => ({
  useRolesQuery: vi.fn(),
}));

const mockedUseUsersQuery = vi.mocked(useUsersQuery);
const mockedUseUpdateUserMutation = vi.mocked(useUpdateUserMutation);
const mockedUseDepartmentsQuery = vi.mocked(useDepartmentsQuery);
const mockedUseUpdateUserAssignmentMutation = vi.mocked(useUpdateUserAssignmentMutation);
const mockedUseRolesQuery = vi.mocked(useRolesQuery);

function queryResult(overrides: Record<string, unknown> = {}) {
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

const oneRole = [
  { id: "role-1", name: "Agent" },
  { id: "role-2", name: "Supervisor" },
];

const oneDepartment = [
  { id: "dept-1", branchId: "branch-1", name: "Support" },
  { id: "dept-2", branchId: "branch-1", name: "Billing" },
];

const baseUser = {
  id: "user-1",
  email: "agent@example.com",
  fullName: "Ada Lovelace",
  isActive: true,
  roles: ["Agent"],
  roleId: "role-1",
  departmentId: "dept-1",
};

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserListView />
    </NextIntlClientProvider>,
  );
}

describe("UserListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdateUserMutation.mockReturnValue(mutationResult() as never);
    mockedUseUpdateUserAssignmentMutation.mockReturnValue(mutationResult() as never);
    mockedUseRolesQuery.mockReturnValue(queryResult({ data: oneRole, isSuccess: true }) as never);
    mockedUseDepartmentsQuery.mockReturnValue(
      queryResult({ data: oneDepartment, isSuccess: true }) as never,
    );
  });

  it("navigates to /users/new when 'New user' is clicked", () => {
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    renderView();
    fireEvent.click(screen.getByText("New user"));

    expect(push).toHaveBeenCalledWith("/en/users/new");
  });

  it("shows a loading state while the users query is pending", () => {
    mockedUseUsersQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    renderView();

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows the empty state when the query succeeds with zero users", () => {
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    renderView();

    expect(screen.getByText("No users found.")).toBeInTheDocument();
  });

  it("shows an error state with a retry action when the query fails", () => {
    const refetch = vi.fn();
    mockedUseUsersQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    renderView();

    expect(screen.getByText("Couldn't load users.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders a row per user once the query succeeds, with email, an editable full name, and a status badge", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );

    renderView();

    expect(screen.getByText("agent@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Deactivate")).toBeInTheDocument();
  });

  it("renders the Role select pre-populated with the user's current role", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );

    renderView();

    const roleCombobox = screen.getAllByRole("combobox")[0] as HTMLElement;
    expect(within(roleCombobox).getByText("Agent")).toBeInTheDocument();
  });

  it("renders the Department select pre-populated with the user's current department", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );

    renderView();

    const departmentCombobox = screen.getAllByRole("combobox")[1] as HTMLElement;
    expect(within(departmentCombobox).getByText("Support")).toBeInTheDocument();
  });

  it("renders 'No department' in the Department select when the user's departmentId is null", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ ...baseUser, departmentId: null }],
      }) as never,
    );

    renderView();

    const departmentCombobox = screen.getAllByRole("combobox")[1] as HTMLElement;
    expect(within(departmentCombobox).getByText("No department")).toBeInTheDocument();
  });

  describe("rename on blur", () => {
    it("commits a rename on blur when the name changed, without affecting the assignment mutation", () => {
      const renameMutate = vi.fn();
      const assignmentMutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate: renameMutate }) as never);
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ mutate: assignmentMutate }) as never,
      );

      renderView();

      const input = screen.getByDisplayValue("Ada Lovelace");
      fireEvent.change(input, { target: { value: "Ada L." } });
      fireEvent.blur(input);

      expect(renameMutate).toHaveBeenCalledWith(
        { fullName: "Ada L." },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
      expect(assignmentMutate).not.toHaveBeenCalled();
    });
  });

  it("toggles active state via the activate/deactivate button, without affecting the assignment mutation", () => {
    const renameMutate = vi.fn();
    const assignmentMutate = vi.fn();
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );
    mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate: renameMutate }) as never);
    mockedUseUpdateUserAssignmentMutation.mockReturnValue(
      mutationResult({ mutate: assignmentMutate }) as never,
    );

    renderView();

    fireEvent.click(screen.getByText("Deactivate"));

    expect(renameMutate).toHaveBeenCalledWith({ isActive: false });
    expect(assignmentMutate).not.toHaveBeenCalled();
  });

  describe("reassigning role/department", () => {
    it("changing the Role select immediately commits { roleId } via the assignment mutation, without affecting the rename mutation", async () => {
      const renameMutate = vi.fn();
      const assignmentMutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate: renameMutate }) as never);
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ mutate: assignmentMutate }) as never,
      );

      renderView();

      const roleCombobox = screen.getAllByRole("combobox")[0] as HTMLElement;
      fireEvent.click(roleCombobox);
      fireEvent.click(await screen.findByRole("option", { name: "Supervisor" }));

      expect(assignmentMutate).toHaveBeenCalledWith({ roleId: "role-2" });
      expect(renameMutate).not.toHaveBeenCalled();
    });

    it("changing the Department select to a different department commits { departmentId }", async () => {
      const assignmentMutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ mutate: assignmentMutate }) as never,
      );

      renderView();

      const departmentCombobox = screen.getAllByRole("combobox")[1] as HTMLElement;
      fireEvent.click(departmentCombobox);
      fireEvent.click(await screen.findByRole("option", { name: "Billing" }));

      expect(assignmentMutate).toHaveBeenCalledWith({ departmentId: "dept-2" });
    });

    it("changing the Department select to 'No department' commits { departmentId: null }", async () => {
      const assignmentMutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ mutate: assignmentMutate }) as never,
      );

      renderView();

      const departmentCombobox = screen.getAllByRole("combobox")[1] as HTMLElement;
      fireEvent.click(departmentCombobox);
      fireEvent.click(await screen.findByRole("option", { name: "No department" }));

      expect(assignmentMutate).toHaveBeenCalledWith({ departmentId: null });
    });
  });

  it("shows independent load-error messages for the Role and Department pickers", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );
    mockedUseRolesQuery.mockReturnValue(queryResult({ isError: true }) as never);
    mockedUseDepartmentsQuery.mockReturnValue(queryResult({ isError: true }) as never);

    renderView();

    expect(screen.getByText("Couldn't load roles.")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load departments.")).toBeInTheDocument();
  });

  describe("3-way error handling on the rename/activate mutation", () => {
    it("renders the forbidden message when rejected with 403", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      renderView();

      expect(
        screen.getByText("You don't have permission to perform that action."),
      ).toBeInTheDocument();
    });

    it("renders a generic action-failed message for a non-403 mutation error", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      renderView();

      expect(
        screen.getByText("That change couldn't be saved. Please try again."),
      ).toBeInTheDocument();
    });
  });

  describe("3-way error handling on the assignment mutation", () => {
    it("renders the forbidden message when the assignment mutation is rejected with 403", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      renderView();

      expect(
        screen.getByText("You don't have permission to perform that action."),
      ).toBeInTheDocument();
    });

    it("renders the backend's own message verbatim when rejected with 400 (e.g. assigning an inactive role)", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({
          isError: true,
          error: new ApiError("Cannot assign an inactive role", 400),
        }) as never,
      );

      renderView();

      expect(screen.getByText("Cannot assign an inactive role")).toBeInTheDocument();
    });

    it("renders the backend's own message verbatim when rejected with 409 (duplicate exact assignment)", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({
          isError: true,
          error: new ApiError("This user already has this exact assignment", 409),
        }) as never,
      );

      renderView();

      expect(
        screen.getByText("This user already has this exact assignment"),
      ).toBeInTheDocument();
    });

    it("renders a generic action-failed message when the assignment rejection is not an ApiError", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ isError: true, error: new Error("network down") }) as never,
      );

      renderView();

      expect(
        screen.getByText("That change couldn't be saved. Please try again."),
      ).toBeInTheDocument();
    });
  });
});
