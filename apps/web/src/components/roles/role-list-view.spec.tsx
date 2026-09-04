import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { RoleListView } from "./role-list-view";
import {
  useCreateRoleMutation,
  useManagedRolesQuery,
  usePermissionsQuery,
  useSetRolePermissionsMutation,
  useUpdateRoleMutation,
} from "@/hooks/use-roles";
import { ApiError } from "@/lib/api";
import { showSuccessToast } from "@crm/ui";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

// Story S-2 — `showSuccessToast` now lives in `@crm/ui`, which also exports
// every primitive these components render. A whole-module factory would
// replace those too, so this spreads the real module and overrides only
// the one function under assertion.
vi.mock("@crm/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@crm/ui")>()),
  showSuccessToast: vi.fn(),
}));

const mockedShowSuccessToast = vi.mocked(showSuccessToast);

/**
 * Story 46 — Role & Permission Management. Mirrors
 * `branch-departments-view.spec.tsx`'s convention exactly: no `next-intl`
 * mock at all — every test renders through a real `NextIntlClientProvider`
 * with the actual `en.json`/`ar.json` messages, so assertions use the real
 * English (or Arabic) copy rather than mocked translation keys. This also
 * gives the bilingual-rendering coverage "for free" across every test, not
 * just the dedicated ones at the bottom of this file.
 *
 * `useUpdateRoleMutation`/`useSetRolePermissionsMutation` are bound to a
 * role's id at hook-call time (one call per `RoleRow` instance, per Rules of
 * Hooks) — mocked as plain `vi.fn()`s that return the same `mutationResult`
 * regardless of the id argument, matching how `useUpdateBranchMutation`/
 * `useUpdateDepartmentMutation` are mocked in the branches spec.
 */
vi.mock("@/hooks/use-roles", () => ({
  useManagedRolesQuery: vi.fn(),
  usePermissionsQuery: vi.fn(),
  useCreateRoleMutation: vi.fn(),
  useUpdateRoleMutation: vi.fn(),
  useSetRolePermissionsMutation: vi.fn(),
}));

const mockedUseManagedRolesQuery = vi.mocked(useManagedRolesQuery);
const mockedUsePermissionsQuery = vi.mocked(usePermissionsQuery);
const mockedUseCreateRoleMutation = vi.mocked(useCreateRoleMutation);
const mockedUseUpdateRoleMutation = vi.mocked(useUpdateRoleMutation);
const mockedUseSetRolePermissionsMutation = vi.mocked(useSetRolePermissionsMutation);

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

function renderView(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RoleListView />
    </NextIntlClientProvider>,
  );
}

describe("RoleListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseManagedRolesQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);
    mockedUsePermissionsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);
    mockedUseCreateRoleMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUpdateRoleMutation.mockReturnValue(mutationResult() as never);
    mockedUseSetRolePermissionsMutation.mockReturnValue(mutationResult() as never);
  });

  describe("loading states", () => {
    it("shows a loading state while the roles query is pending", () => {
      mockedUseManagedRolesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      renderView();

      // The section heading always renders; only the body is a skeleton.
      expect(screen.getByText("Roles")).toBeInTheDocument();
      expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
    });

    it("shows a loading state for the permissions reference section while its query is pending", () => {
      mockedUsePermissionsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      renderView();

      expect(screen.getByText("All permissions")).toBeInTheDocument();
      expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
    });
  });

  describe("error + retry", () => {
    it("shows an error state with a retry action when the roles query fails", () => {
      const refetch = vi.fn();
      mockedUseManagedRolesQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

      renderView();

      expect(screen.getByText("Couldn't load roles.")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Retry"));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it("shows an independent error state for the permissions reference list", () => {
      const refetch = vi.fn();
      mockedUsePermissionsQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

      renderView();

      expect(screen.getByText("Couldn't load permissions.")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Retry"));
      expect(refetch).toHaveBeenCalledOnce();
    });
  });

  it("shows the empty state when there are no roles", () => {
    renderView();

    expect(screen.getByText("No roles found.")).toBeInTheDocument();
  });

  it("renders a row per role with its permission count, collapsed by default", () => {
    mockedUseManagedRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          {
            id: "role-1",
            name: "Viewer",
            permissions: ["ticket:read", "ticket:update"],
            isActive: true,
          },
        ],
      }) as never,
    );

    renderView();

    expect(screen.getByDisplayValue("Viewer")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("ticket:read")).not.toBeInTheDocument();
    expect(screen.getByText("Show permissions")).toBeInTheDocument();
  });

  it("expands a role to show its real permission keys (against the full catalog), then collapses again", () => {
    mockedUseManagedRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          {
            id: "role-1",
            name: "Viewer",
            permissions: ["ticket:read", "ticket:update"],
            isActive: true,
          },
        ],
      }) as never,
    );
    mockedUsePermissionsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          { id: "perm-1", key: "ticket:read" },
          { id: "perm-2", key: "ticket:update" },
        ],
      }) as never,
    );

    renderView();
    fireEvent.click(screen.getByText("Show permissions"));

    // "ticket:read"/"ticket:update" also render in the independent
    // all-permissions reference section below (same shared catalog query),
    // so scope these assertions to the roles table.
    const table = screen.getByRole("table");
    expect(within(table).getByText("ticket:read")).toBeInTheDocument();
    expect(within(table).getByText("ticket:update")).toBeInTheDocument();
    expect(screen.getByText("Hide permissions")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Hide permissions"));

    expect(within(table).queryByText("ticket:read")).not.toBeInTheDocument();
  });

  it("shows a no-permissions message when the permission catalog itself is empty", () => {
    mockedUseManagedRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "role-1", name: "Viewer", permissions: [], isActive: true }],
      }) as never,
    );
    // usePermissionsQuery defaults to an empty catalog per beforeEach.

    renderView();
    fireEvent.click(screen.getByText("Show permissions"));

    expect(screen.getByText("This role has no permissions.")).toBeInTheDocument();
  });

  it("renders the all-permissions reference list independently of the roles section", () => {
    mockedUsePermissionsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          { id: "perm-1", key: "ticket:read" },
          { id: "perm-2", key: "customer:update" },
        ],
      }) as never,
    );

    renderView();

    expect(screen.getByText("ticket:read")).toBeInTheDocument();
    expect(screen.getByText("customer:update")).toBeInTheDocument();
  });

  describe("rename on blur", () => {
    it("commits a role rename on blur when the name changed, for a custom role", () => {
      const mutate = vi.fn();
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ id: "role-1", name: "Viewer", permissions: [], isActive: true }],
        }) as never,
      );
      mockedUseUpdateRoleMutation.mockReturnValue(mutationResult({ mutate }) as never);

      renderView();

      const input = screen.getByDisplayValue("Viewer");
      fireEvent.change(input, { target: { value: "Support Team" } });
      fireEvent.blur(input);

      expect(mutate).toHaveBeenCalledWith(
        { name: "Support Team" },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it("does not fire the rename mutation on blur when the role name is unchanged", () => {
      const mutate = vi.fn();
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ id: "role-1", name: "Viewer", permissions: [], isActive: true }],
        }) as never,
      );
      mockedUseUpdateRoleMutation.mockReturnValue(mutationResult({ mutate }) as never);

      renderView();

      const input = screen.getByDisplayValue("Viewer");
      fireEvent.blur(input);

      expect(mutate).not.toHaveBeenCalled();
    });
  });

  it("does not deactivate immediately — clicking 'Deactivate' opens a confirmation dialog first", () => {
    const mutate = vi.fn();
    mockedUseManagedRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "role-1", name: "Viewer", permissions: [], isActive: true }],
      }) as never,
    );
    mockedUseUpdateRoleMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("toggles a custom role's active state via the activate/deactivate button's confirmation dialog", () => {
    const mutate = vi.fn();
    mockedUseManagedRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "role-1", name: "Viewer", permissions: [], isActive: true }],
      }) as never,
    );
    mockedUseUpdateRoleMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    expect(mutate).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("toggles an inactive custom role back to active", () => {
    const mutate = vi.fn();
    mockedUseManagedRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "role-1", name: "Viewer", permissions: [], isActive: false }],
      }) as never,
    );
    mockedUseUpdateRoleMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    fireEvent.click(screen.getByText("Activate"));

    expect(mutate).toHaveBeenCalledWith({ isActive: true });
  });

  it("renders protected roles (SuperAdmin, Agent) without an editable name field or activate/deactivate button, showing a System role badge instead", () => {
    mockedUseManagedRolesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          { id: "role-super", name: "SuperAdmin", permissions: ["role:create"], isActive: true },
          { id: "role-agent", name: "Agent", permissions: [], isActive: true },
        ],
      }) as never,
    );

    renderView();

    expect(screen.getByText("SuperAdmin")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("SuperAdmin")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Agent")).not.toBeInTheDocument();
    expect(screen.getAllByText("System role")).toHaveLength(2);
    expect(screen.queryByText("Activate")).not.toBeInTheDocument();
    expect(screen.queryByText("Deactivate")).not.toBeInTheDocument();
    // Both rows still expose the expand/collapse control — permission
    // assignment remains allowed on protected roles.
    expect(screen.getAllByText("Show permissions")).toHaveLength(2);
  });

  describe("permission-checkbox assignment", () => {
    const catalog = [
      { id: "perm-1", key: "ticket:read" },
      { id: "perm-2", key: "ticket:update" },
      { id: "perm-3", key: "customer:update" },
    ];

    function renderExpandedRole(mutate = vi.fn()) {
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ id: "role-1", name: "Support", permissions: ["ticket:read"], isActive: true }],
        }) as never,
      );
      mockedUsePermissionsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: catalog }) as never,
      );
      mockedUseSetRolePermissionsMutation.mockReturnValue(mutationResult({ mutate }) as never);

      renderView();
      fireEvent.click(screen.getByText("Show permissions"));

      return mutate;
    }

    it("checks only the permissions already assigned to the role, against the full catalog", () => {
      renderExpandedRole();

      expect(screen.getByRole("checkbox", { name: "ticket:read" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "ticket:update" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "customer:update" })).not.toBeChecked();
    });

    it("checking an unchecked permission sends the full updated permissionKeys array, including the new key", () => {
      const mutate = renderExpandedRole();

      fireEvent.click(screen.getByRole("checkbox", { name: "ticket:update" }));

      expect(mutate).toHaveBeenCalledOnce();
      const payload = mutate.mock.calls[0]![0] as { permissionKeys: string[] };
      expect([...payload.permissionKeys].sort()).toEqual(["ticket:read", "ticket:update"]);
    });

    it("unchecking a checked permission sends the full updated permissionKeys array, with that key removed", () => {
      const mutate = renderExpandedRole();

      fireEvent.click(screen.getByRole("checkbox", { name: "ticket:read" }));

      expect(mutate).toHaveBeenCalledWith({ permissionKeys: [] });
    });
  });

  describe("3-way error handling on row mutations", () => {
    const roleData = [{ id: "role-1", name: "Ops", permissions: [], isActive: true }];

    it("renders the forbidden message when a role-update mutation is rejected with 403", () => {
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: roleData }) as never,
      );
      mockedUseUpdateRoleMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      renderView();

      expect(
        screen.getByText("You don't have permission to perform that action."),
      ).toBeInTheDocument();
    });

    it("renders the backend's own message verbatim when a role-update mutation is rejected with a 409 duplicate-name conflict", () => {
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: roleData }) as never,
      );
      mockedUseUpdateRoleMutation.mockReturnValue(
        mutationResult({
          isError: true,
          error: new ApiError("A role with this name already exists", 409),
        }) as never,
      );

      renderView();

      expect(screen.getByText("A role with this name already exists")).toBeInTheDocument();
    });

    it("renders the shared network-failure message when a role-update mutation is rejected with a non-ApiError", () => {
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: roleData }) as never,
      );
      mockedUseUpdateRoleMutation.mockReturnValue(
        mutationResult({ isError: true, error: new Error("network down") }) as never,
      );

      renderView();

      expect(
        screen.getByText("Couldn't reach the server. Check your connection and try again."),
      ).toBeInTheDocument();
    });
  });

  describe("create-role form", () => {
    it("keeps the submit button disabled until the name field has content", () => {
      renderView();

      expect(screen.getByRole("button", { name: "Add role" })).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText("Role name"), {
        target: { value: "Ops" },
      });

      expect(screen.getByRole("button", { name: "Add role" })).toBeEnabled();
    });

    it("submits exactly { name } on the create-role form", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "role-99" });
      mockedUseCreateRoleMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      renderView();

      fireEvent.change(screen.getByPlaceholderText("Role name"), {
        target: { value: "Ops" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add role" }));

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ name: "Ops" }));
    });

    // Story 94 — success feedback.
    it("shows a translated success toast only after the create-role mutation resolves", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "role-99" });
      mockedUseCreateRoleMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      renderView();

      fireEvent.change(screen.getByPlaceholderText("Role name"), {
        target: { value: "Ops" },
      });
      expect(mockedShowSuccessToast).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Add role" }));

      await waitFor(() =>
        expect(mockedShowSuccessToast).toHaveBeenCalledWith('Role "Ops" created.'),
      );
    });

    it("shows the backend's own message inline on a rejected submission (duplicate name) and preserves the entered value", async () => {
      const mutateAsync = vi
        .fn()
        .mockRejectedValue(new ApiError("A role with this name already exists", 409));
      mockedUseCreateRoleMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      renderView();

      fireEvent.change(screen.getByPlaceholderText("Role name"), {
        target: { value: "Ops" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add role" }));

      expect(await screen.findByText("A role with this name already exists")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Ops")).toBeInTheDocument();
    });

    it("falls back to the shared network-failure message when the create-role rejection is not an ApiError", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
      mockedUseCreateRoleMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      renderView();

      fireEvent.change(screen.getByPlaceholderText("Role name"), {
        target: { value: "Ops" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add role" }));

      expect(
        await screen.findByText("Couldn't reach the server. Check your connection and try again."),
      ).toBeInTheDocument();
    });

    it("shows a pending/disabled state while the create-role mutation is in flight", () => {
      mockedUseCreateRoleMutation.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: true,
      } as never);

      renderView();

      expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();
    });
  });

  // Story 68 — Ticket Department-Scoped Visibility.
  describe("ticket visibility scope (Story 68)", () => {
    it("renders the role's current visibility scope", () => {
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [
            {
              id: "role-1",
              name: "Viewer",
              permissions: [],
              isActive: true,
              ticketVisibilityScope: "DEPARTMENT",
            },
          ],
        }) as never,
      );

      renderView();

      expect(screen.getByText("Own department only")).toBeInTheDocument();
    });

    it("commits a visibility scope change when a different option is selected", async () => {
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [
            {
              id: "role-1",
              name: "Viewer",
              permissions: [],
              isActive: true,
              ticketVisibilityScope: "BRANCH",
            },
          ],
        }) as never,
      );
      const mutate = vi.fn();
      mockedUseUpdateRoleMutation.mockReturnValue(mutationResult({ mutate }) as never);

      renderView();
      fireEvent.click(screen.getByText("Whole branch"));
      fireEvent.click(await screen.findByRole("option", { name: "Own department only" }));

      expect(mutate).toHaveBeenCalledWith({ ticketVisibilityScope: "DEPARTMENT" });
    });
  });

  describe("bilingual rendering", () => {
    it("renders the roles heading, create-role form, and system-role text in English", () => {
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ id: "role-super", name: "SuperAdmin", permissions: [], isActive: true }],
        }) as never,
      );

      renderView("en");

      expect(screen.getByText("Roles & Permissions")).toBeInTheDocument();
      expect(screen.getByText("Create role")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add role" })).toBeInTheDocument();
      expect(screen.getByText("System role")).toBeInTheDocument();
    });

    it("renders the roles heading, create-role form, and system-role text in Arabic", () => {
      mockedUseManagedRolesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [{ id: "role-super", name: "SuperAdmin", permissions: [], isActive: true }],
        }) as never,
      );

      renderView("ar");

      expect(screen.getByText("الأدوار والصلاحيات")).toBeInTheDocument();
      expect(screen.getByText("إنشاء دور")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "إضافة دور" })).toBeInTheDocument();
      expect(screen.getByText("دور نظامي")).toBeInTheDocument();
    });
  });
});
