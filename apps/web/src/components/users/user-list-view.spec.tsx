import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { UserListView } from "./user-list-view";
import {
  useDepartmentsQuery,
  useResetPasswordMutation,
  useUnlockUserMutation,
  useUpdateUserAssignmentMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useRolesQuery } from "@/hooks/use-roles";
import { io } from "socket.io-client";
import { ApiError, getAccessToken } from "@/lib/api";
import enMessages from "../../../messages/en.json";

// Story 108 — Agent Presence UI. `UserListView` now also renders through
// `useAgentPresence` (a real socket.io connection); mocked here the exact
// same way `use-agent-presence.spec.ts`/`use-branch-notifications.spec.ts`
// mock it, so this file's own tests can simulate a live presence event
// without an actual network connection.
vi.mock("socket.io-client", () => ({ io: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getAccessToken: vi.fn(() => "test-token"),
    getSocketBaseUrl: () => "http://localhost:3001",
  };
});

function buildSocketMock() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
  };
}

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
 *
 * Story 48 — the previously plain-text email `TableCell` is now a
 * blur-commit `Input`, so every assertion that used to target
 * `screen.getByText(user.email)` now uses `getByDisplayValue(user.email)`
 * instead (the established convention for a "text became an input"
 * transition in this codebase, e.g. `branch-departments-view.spec.tsx`'s own
 * rename-input assertions). The email field reuses the *same* `mutation`
 * (`useUpdateUserMutation`) as `fullName`, but its own error block is a
 * 3-way 403/other-`ApiError`-verbatim/generic split — a strictly richer
 * split than `fullName`'s existing 2-way (403/generic) block, which is left
 * unchanged. Because both blocks render off the *same* shared `mutation`
 * object, a 403 rejection now renders the forbidden copy in *both* the email
 * and fullName cells simultaneously — the pre-existing
 * "3-way error handling on the rename/activate mutation" 403 test is scoped
 * to the fullName cell (via `getAllByRole("cell")`) to keep asserting its
 * original, narrower intent instead of tripping over the new duplicate
 * text node. A new "3-way error handling on the email field" block asserts
 * the email cell's own, richer behavior (including the verbatim
 * duplicate-email 409 case) scoped to the email cell the same way. A new
 * password-reset `Input` + `Button`, wired to the new
 * `useResetPasswordMutation(user.id)`, is covered by its own describe
 * blocks below, plus a small cross-independence check confirming the three
 * per-row mutations (rename/activate, assignment, password-reset) never
 * affect one another's mock call assertions.
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
  useResetPasswordMutation: vi.fn(),
  useUnlockUserMutation: vi.fn(),
}));

vi.mock("@/hooks/use-roles", () => ({
  useRolesQuery: vi.fn(),
}));

const mockedUseUsersQuery = vi.mocked(useUsersQuery);
const mockedUseUpdateUserMutation = vi.mocked(useUpdateUserMutation);
const mockedUseDepartmentsQuery = vi.mocked(useDepartmentsQuery);
const mockedUseUpdateUserAssignmentMutation = vi.mocked(useUpdateUserAssignmentMutation);
const mockedUseResetPasswordMutation = vi.mocked(useResetPasswordMutation);
const mockedUseUnlockUserMutation = vi.mocked(useUnlockUserMutation);
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
  isLocked: false,
  lockedUntil: null,
};

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UserListView />
    </NextIntlClientProvider>,
  );
}

describe("UserListView", () => {
  let socket: ReturnType<typeof buildSocketMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);
    vi.mocked(getAccessToken).mockReturnValue("test-token");
    mockedUseUpdateUserMutation.mockReturnValue(mutationResult() as never);
    mockedUseUpdateUserAssignmentMutation.mockReturnValue(mutationResult() as never);
    mockedUseResetPasswordMutation.mockReturnValue(mutationResult() as never);
    mockedUseUnlockUserMutation.mockReturnValue(mutationResult() as never);
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

  it("renders a row per user once the query succeeds, with an editable email, an editable full name, and a status badge", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );

    renderView();

    expect(screen.getByDisplayValue("agent@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Deactivate")).toBeInTheDocument();
    // Story 108 — before any agent.presence.changed event has arrived,
    // presence is unknown and renders as the safe default, Offline.
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  // Story 108 — Agent Presence UI.
  describe("presence", () => {
    it("joins agent:{id}:presence for every listed user", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );

      renderView();
      act(() => {
        socket._trigger("connect");
      });

      expect(socket.emit).toHaveBeenCalledWith("join", { room: "agent:user-1:presence" });
    });

    it("shows Online once the socket relays an online transition for that user", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );

      renderView();
      act(() => {
        socket._trigger("agent.presence.changed", { userId: "user-1", status: "online" });
      });

      expect(screen.getByText("Online")).toBeInTheDocument();
      expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    it("keeps each user's presence independent", () => {
      const secondUser = { ...baseUser, id: "user-2", email: "second@example.com" };
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser, secondUser] }) as never,
      );

      renderView();
      act(() => {
        socket._trigger("agent.presence.changed", { userId: "user-1", status: "online" });
      });

      const [, firstUserRow, secondUserRow] = screen.getAllByRole("row");
      expect(within(firstUserRow!).getByText("Online")).toBeInTheDocument();
      expect(within(secondUserRow!).getByText("Offline")).toBeInTheDocument();
    });
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

  describe("email blur-commit", () => {
    it("commits an email change on blur when the email changed", () => {
      const mutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate }) as never);

      renderView();

      const input = screen.getByDisplayValue("agent@example.com");
      fireEvent.change(input, { target: { value: "new@example.com" } });
      fireEvent.blur(input);

      expect(mutate).toHaveBeenCalledWith(
        { email: "new@example.com" },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it("does not fire the update mutation on blur when the email is unchanged", () => {
      const mutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate }) as never);

      renderView();

      const input = screen.getByDisplayValue("agent@example.com");
      fireEvent.blur(input);

      expect(mutate).not.toHaveBeenCalled();
    });
  });

  // Story 94 — deactivating a user now requires confirmation: the trigger
  // button opens a dialog rather than mutating immediately, and the
  // mutation only fires once the dialog's own "Deactivate" button (a
  // second, distinct element with the same accessible name) is clicked.
  it("does not deactivate immediately — clicking 'Deactivate' opens a confirmation dialog first", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );
    const renameMutate = vi.fn();
    mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate: renameMutate }) as never);

    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(renameMutate).not.toHaveBeenCalled();
  });

  it("toggles active state via the activate/deactivate button's confirmation dialog, without affecting the assignment mutation", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    expect(renameMutate).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(assignmentMutate).not.toHaveBeenCalled();
  });

  it("activating an inactive user does not require confirmation", () => {
    const renameMutate = vi.fn();
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [{ ...baseUser, isActive: false }] }) as never,
    );
    mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate: renameMutate }) as never);

    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    expect(renameMutate).toHaveBeenCalledWith({ isActive: true });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
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

  // Story 97 — Loading & Skeleton UX.
  it("disables the Role and Department pickers, and shows a loading indicator, while their own options queries are loading", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseUser] }) as never,
    );
    mockedUseRolesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);
    mockedUseDepartmentsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    renderView();

    const roleCombobox = screen.getAllByRole("combobox")[0] as HTMLElement;
    const departmentCombobox = screen.getAllByRole("combobox")[1] as HTMLElement;
    expect(roleCombobox).toBeDisabled();
    expect(departmentCombobox).toBeDisabled();
    expect(screen.getAllByText("Loading…")).toHaveLength(2);
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

      // The email cell shares this same `mutation` and now also renders on
      // 403 (its own, richer 3-way block — see "3-way error handling on the
      // email field" below), so this assertion is scoped to the fullName
      // cell to keep testing this describe block's original, narrower
      // intent (the fullName field's own 2-way block) rather than tripping
      // over the duplicate text node the email cell also renders.
      const fullNameCell = screen.getAllByRole("cell")[1]!;
      expect(
        within(fullNameCell).getByText("You don't have permission to perform that action."),
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

      const fullNameCell = screen.getAllByRole("cell")[1]!;
      expect(
        within(fullNameCell).getByText("That change couldn't be saved. Please try again."),
      ).toBeInTheDocument();
    });
  });

  describe("3-way error handling on the email field", () => {
    it("renders the forbidden message when the update mutation is rejected with 403", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      renderView();

      const emailCell = screen.getAllByRole("cell")[0]!;
      expect(
        within(emailCell).getByText("You don't have permission to perform that action."),
      ).toBeInTheDocument();
    });

    it("renders the backend's own message verbatim when rejected with 409 (duplicate email)", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(
        mutationResult({
          isError: true,
          error: new ApiError("A user with this email already exists", 409),
        }) as never,
      );

      renderView();

      const emailCell = screen.getAllByRole("cell")[0]!;
      expect(
        within(emailCell).getByText("A user with this email already exists"),
      ).toBeInTheDocument();
    });

    // Story 94 — a non-ApiError rejection (the update mutation's promise
    // rejecting with something that isn't a real HTTP response, e.g. a
    // dropped connection) is now classified as a network failure, not the
    // feature's generic "couldn't be saved" copy — see `error-message.ts`.
    it("renders the shared network-failure message when the rejection is not an ApiError", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(
        mutationResult({ isError: true, error: new Error("network down") }) as never,
      );

      renderView();

      const emailCell = screen.getAllByRole("cell")[0]!;
      expect(
        within(emailCell).getByText("Couldn't reach the server. Check your connection and try again."),
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

    it("renders the shared network-failure message when the assignment rejection is not an ApiError", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ isError: true, error: new Error("network down") }) as never,
      );

      renderView();

      expect(
        screen.getByText("Couldn't reach the server. Check your connection and try again."),
      ).toBeInTheDocument();
    });
  });

  describe("password reset", () => {
    // Story 98 — Design System & Visual Polish. This action is irreversible
    // and its own ConfirmDialog already renders a destructive confirm
    // button; the trigger must agree rather than looking like a routine
    // secondary action.
    it("styles the reset-password trigger as destructive, matching its own confirmation dialog", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );

      renderView();

      expect(screen.getByRole("button", { name: "Reset password" })).toHaveClass("bg-red-600");
    });

    it("keeps the reset-password button disabled until the draft is at least 8 characters", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );

      renderView();

      const passwordInput = screen.getByPlaceholderText("New password (min. 8 characters)");
      const submitButton = screen.getByRole("button", { name: "Reset password" });
      expect(submitButton).toBeDisabled();

      fireEvent.change(passwordInput, { target: { value: "short1" } });
      expect(submitButton).toBeDisabled();

      fireEvent.change(passwordInput, { target: { value: "longenough1" } });
      expect(submitButton).toBeEnabled();
    });

    it("does not commit on blur, and clicking 'Reset password' opens a confirmation dialog rather than committing immediately", () => {
      const mutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(mutationResult({ mutate }) as never);

      renderView();

      const passwordInput = screen.getByPlaceholderText("New password (min. 8 characters)");
      fireEvent.change(passwordInput, { target: { value: "newpassword1" } });
      fireEvent.blur(passwordInput);
      expect(mutate).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(mutate).not.toHaveBeenCalled();
    });

    it("commits with the exact { newPassword } payload only once the confirmation dialog's own Reset password button is clicked", () => {
      const mutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(mutationResult({ mutate }) as never);

      renderView();

      const passwordInput = screen.getByPlaceholderText("New password (min. 8 characters)");
      fireEvent.change(passwordInput, { target: { value: "newpassword1" } });
      fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Reset password" }));

      expect(mutate).toHaveBeenCalledWith(
        { newPassword: "newpassword1" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("preserves the entered password when the reset mutation does not succeed", () => {
      // A bare `vi.fn()` mock never invokes the `onSuccess` callback passed
      // to `mutate` — exactly mirroring a real, still-pending/rejected
      // mutation, under which the component's local draft state is left
      // untouched (there is no `onError` handler on this control at all).
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(mutationResult() as never);

      renderView();

      const passwordInput = screen.getByPlaceholderText("New password (min. 8 characters)");
      fireEvent.change(passwordInput, { target: { value: "newpassword1" } });
      fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Reset password" }));

      expect(screen.getByDisplayValue("newpassword1")).toBeInTheDocument();
    });

    it("clears the password field and shows a success message when the reset mutation succeeds", () => {
      let capturedOnSuccess: (() => void) | undefined;
      const mutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => {
        capturedOnSuccess = options?.onSuccess;
      });
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(mutationResult({ mutate }) as never);

      renderView();

      const passwordInput = screen.getByPlaceholderText("New password (min. 8 characters)");
      fireEvent.change(passwordInput, { target: { value: "newpassword1" } });
      fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Reset password" }));

      // Simulate the real mutation resolving successfully by invoking the
      // callback the component actually passed to `mutate`.
      act(() => {
        capturedOnSuccess?.();
      });

      expect(passwordInput).toHaveValue("");
      expect(screen.getByText("Password reset.")).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  describe("3-way error handling on the reset-password mutation", () => {
    it("renders the forbidden message when rejected with 403", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      renderView();

      expect(
        screen.getByText("You don't have permission to perform that action."),
      ).toBeInTheDocument();
    });

    it("renders the backend's own message verbatim for a non-403 ApiError", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(
        mutationResult({
          isError: true,
          error: new ApiError("Password must be at least 8 characters", 400),
        }) as never,
      );

      renderView();

      expect(
        screen.getByText("Password must be at least 8 characters"),
      ).toBeInTheDocument();
    });

    it("renders the shared network-failure message when the rejection is not an ApiError", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(
        mutationResult({ isError: true, error: new Error("network down") }) as never,
      );

      renderView();

      expect(
        screen.getByText("Couldn't reach the server. Check your connection and try again."),
      ).toBeInTheDocument();
    });
  });

  describe("mutation independence", () => {
    it("committing an email change only calls the update mutation, not the assignment or reset-password mutations", () => {
      const renameMutate = vi.fn();
      const assignmentMutate = vi.fn();
      const resetPasswordMutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate: renameMutate }) as never);
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ mutate: assignmentMutate }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(
        mutationResult({ mutate: resetPasswordMutate }) as never,
      );

      renderView();

      const input = screen.getByDisplayValue("agent@example.com");
      fireEvent.change(input, { target: { value: "new@example.com" } });
      fireEvent.blur(input);

      expect(renameMutate).toHaveBeenCalledWith(
        { email: "new@example.com" },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
      expect(assignmentMutate).not.toHaveBeenCalled();
      expect(resetPasswordMutate).not.toHaveBeenCalled();
    });

    it("clicking 'Reset password' only calls the reset-password mutation, not the rename/activate or assignment mutations", () => {
      const renameMutate = vi.fn();
      const assignmentMutate = vi.fn();
      const resetPasswordMutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate: renameMutate }) as never);
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ mutate: assignmentMutate }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(
        mutationResult({ mutate: resetPasswordMutate }) as never,
      );

      renderView();

      const passwordInput = screen.getByPlaceholderText("New password (min. 8 characters)");
      fireEvent.change(passwordInput, { target: { value: "newpassword1" } });
      fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Reset password" }));

      expect(resetPasswordMutate).toHaveBeenCalledWith(
        { newPassword: "newpassword1" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      expect(renameMutate).not.toHaveBeenCalled();
      expect(assignmentMutate).not.toHaveBeenCalled();
    });
  });

  // Story 122 — Account Lockout.
  describe("account lockout", () => {
    it("does not render a Locked badge or Unlock button for an unlocked user", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseUser] }) as never,
      );

      renderView();

      expect(screen.queryByText("Locked")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Unlock" })).not.toBeInTheDocument();
    });

    it("renders a Locked badge and an Unlock button for a locked user", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ ...baseUser, isLocked: true, lockedUntil: "2026-01-01T00:15:00.000Z" }],
        }) as never,
      );

      renderView();

      expect(screen.getByText("Locked")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
    });

    it("clicking Unlock immediately calls the unlock mutation, with no confirmation dialog", () => {
      const unlockMutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ ...baseUser, isLocked: true, lockedUntil: "2026-01-01T00:15:00.000Z" }],
        }) as never,
      );
      mockedUseUnlockUserMutation.mockReturnValue(mutationResult({ mutate: unlockMutate }) as never);

      renderView();
      fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

      expect(unlockMutate).toHaveBeenCalledWith();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("disables the Unlock button while the unlock mutation is pending", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ ...baseUser, isLocked: true, lockedUntil: "2026-01-01T00:15:00.000Z" }],
        }) as never,
      );
      mockedUseUnlockUserMutation.mockReturnValue(mutationResult({ isPending: true }) as never);

      renderView();

      expect(screen.getByRole("button", { name: "Unlock" })).toBeDisabled();
    });

    it("renders a forbidden message when the unlock mutation is rejected with 403", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ ...baseUser, isLocked: true, lockedUntil: "2026-01-01T00:15:00.000Z" }],
        }) as never,
      );
      mockedUseUnlockUserMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      renderView();

      expect(
        screen.getByText("You don't have permission to perform that action."),
      ).toBeInTheDocument();
    });

    it("does not call the rename/activate, assignment, or reset-password mutations when unlocking", () => {
      const renameMutate = vi.fn();
      const assignmentMutate = vi.fn();
      const resetPasswordMutate = vi.fn();
      const unlockMutate = vi.fn();
      mockedUseUsersQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ ...baseUser, isLocked: true, lockedUntil: "2026-01-01T00:15:00.000Z" }],
        }) as never,
      );
      mockedUseUpdateUserMutation.mockReturnValue(mutationResult({ mutate: renameMutate }) as never);
      mockedUseUpdateUserAssignmentMutation.mockReturnValue(
        mutationResult({ mutate: assignmentMutate }) as never,
      );
      mockedUseResetPasswordMutation.mockReturnValue(
        mutationResult({ mutate: resetPasswordMutate }) as never,
      );
      mockedUseUnlockUserMutation.mockReturnValue(mutationResult({ mutate: unlockMutate }) as never);

      renderView();
      fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

      expect(unlockMutate).toHaveBeenCalledOnce();
      expect(renameMutate).not.toHaveBeenCalled();
      expect(assignmentMutate).not.toHaveBeenCalled();
      expect(resetPasswordMutate).not.toHaveBeenCalled();
    });
  });
});
