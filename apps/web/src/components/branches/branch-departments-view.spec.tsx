import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { BranchDepartmentsView } from "./branch-departments-view";
import {
  useCreateDepartmentMutation,
  useManagedBranchQuery,
  useManagedDepartmentsQuery,
  useUpdateBranchMutation,
  useUpdateDepartmentMutation,
} from "@/hooks/use-branches";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

/**
 * Story 45 — Branch & Department Management view. Mirrors
 * `dashboard-view.spec.tsx`'s convention exactly: no `next-intl` mock at
 * all — every test renders through a real `NextIntlClientProvider` with the
 * actual `en.json`/`ar.json` messages, so assertions use the real English
 * (or Arabic) copy rather than mocked translation keys. This also gives the
 * bilingual-rendering coverage "for free" across every test, not just the
 * dedicated ones at the bottom of this file.
 */
vi.mock("@/hooks/use-branches", () => ({
  useManagedBranchQuery: vi.fn(),
  useManagedDepartmentsQuery: vi.fn(),
  useUpdateBranchMutation: vi.fn(),
  useCreateDepartmentMutation: vi.fn(),
  useUpdateDepartmentMutation: vi.fn(),
}));

const mockedUseManagedBranchQuery = vi.mocked(useManagedBranchQuery);
const mockedUseManagedDepartmentsQuery = vi.mocked(useManagedDepartmentsQuery);
const mockedUseUpdateBranchMutation = vi.mocked(useUpdateBranchMutation);
const mockedUseCreateDepartmentMutation = vi.mocked(useCreateDepartmentMutation);
const mockedUseUpdateDepartmentMutation = vi.mocked(useUpdateDepartmentMutation);

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

const baseBranch = { id: "branch-1", name: "Main Branch", isActive: true };
const baseDepartment = { id: "dept-1", branchId: "branch-1", name: "Support", isActive: true };

function renderView(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <BranchDepartmentsView />
    </NextIntlClientProvider>,
  );
}

describe("BranchDepartmentsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseManagedBranchQuery.mockReturnValue(
      queryResult({ data: baseBranch, isSuccess: true }) as never,
    );
    mockedUseManagedDepartmentsQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseUpdateBranchMutation.mockReturnValue(mutationResult() as never);
    mockedUseCreateDepartmentMutation.mockReturnValue(
      { mutateAsync: vi.fn(), isPending: false } as never,
    );
    mockedUseUpdateDepartmentMutation.mockReturnValue(mutationResult() as never);
  });

  describe("loading states", () => {
    it("shows a loading state for the branch section while the branch query is pending", () => {
      mockedUseManagedBranchQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      renderView();

      // MyBranchSection returns only skeletons while loading — the heading
      // (rendered only once branch data/error is known) must be absent.
      expect(screen.queryByText("My Branch")).not.toBeInTheDocument();
      expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
    });

    it("shows a loading state for the departments section while the departments query is pending", () => {
      mockedUseManagedDepartmentsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      renderView();

      // The section heading always renders; only the body is a skeleton.
      expect(screen.getByText("Departments")).toBeInTheDocument();
      expect(screen.queryByText("No departments yet.")).not.toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("error + retry", () => {
    it("shows an error state with a retry action for the branch section", () => {
      const refetch = vi.fn();
      mockedUseManagedBranchQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

      renderView();

      expect(screen.getByText("Couldn't load your branch.")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Retry"));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it("shows an error state with a retry action for the departments section", () => {
      const refetch = vi.fn();
      mockedUseManagedDepartmentsQuery.mockReturnValue(
        queryResult({ isError: true, refetch }) as never,
      );

      renderView();

      expect(screen.getByText("Couldn't load departments.")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Retry"));
      expect(refetch).toHaveBeenCalledOnce();
    });
  });

  it("shows the empty state when there are zero departments", () => {
    renderView();

    expect(screen.getByText("No departments yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the branch's name and active badge, and the departments table with each row's name and badge", () => {
    mockedUseManagedDepartmentsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [baseDepartment, { id: "dept-2", branchId: "branch-1", name: "Billing", isActive: false }],
      }) as never,
    );

    renderView();

    expect(screen.getByDisplayValue("Main Branch")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByDisplayValue("Support")).toBeInTheDocument();
    expect(within(table).getByDisplayValue("Billing")).toBeInTheDocument();
    // One "Active" badge for the branch + one for the active department;
    // one "Inactive" badge for the inactive department.
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getAllByText("Inactive")).toHaveLength(1);
  });

  it("commits a branch rename on blur when the name changed", () => {
    const mutate = vi.fn();
    mockedUseUpdateBranchMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    const input = screen.getByDisplayValue("Main Branch");
    fireEvent.change(input, { target: { value: "Downtown Branch" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith(
      { name: "Downtown Branch" },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("does not fire the rename mutation on blur when the branch name is unchanged", () => {
    const mutate = vi.fn();
    mockedUseUpdateBranchMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    const input = screen.getByDisplayValue("Main Branch");
    fireEvent.blur(input);

    expect(mutate).not.toHaveBeenCalled();
  });

  it("does not deactivate the branch immediately — clicking 'Deactivate' opens a confirmation dialog first", () => {
    const mutate = vi.fn();
    mockedUseUpdateBranchMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("toggles the branch's active state via the activate/deactivate button's confirmation dialog", () => {
    const mutate = vi.fn();
    mockedUseUpdateBranchMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    expect(mutate).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("commits a department rename on blur when the name changed", () => {
    const mutate = vi.fn();
    mockedUseManagedDepartmentsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseDepartment] }) as never,
    );
    mockedUseUpdateDepartmentMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    const input = screen.getByDisplayValue("Support");
    fireEvent.change(input, { target: { value: "Customer Support" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith(
      { name: "Customer Support" },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("does not fire the rename mutation on blur when the department name is unchanged", () => {
    const mutate = vi.fn();
    mockedUseManagedDepartmentsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseDepartment] }) as never,
    );
    mockedUseUpdateDepartmentMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    const input = screen.getByDisplayValue("Support");
    fireEvent.blur(input);

    expect(mutate).not.toHaveBeenCalled();
  });

  it("toggles a department's active state via its row's button and confirmation dialog", () => {
    const mutate = vi.fn();
    mockedUseManagedDepartmentsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseDepartment] }) as never,
    );
    mockedUseUpdateDepartmentMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    // Both the branch section and the department row render a "Deactivate"
    // button (both default to active) — scope to the departments table so
    // this click targets the row's button, not the branch's.
    const table = screen.getByRole("table");
    fireEvent.click(within(table).getByRole("button", { name: "Deactivate" }));
    expect(mutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    expect(mutate).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  describe("inline mutation errors", () => {
    it("renders a 403-specific message when the branch-update mutation is rejected with 403", () => {
      mockedUseUpdateBranchMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      renderView();

      expect(
        screen.getByText("You don't have permission to perform that action."),
      ).toBeInTheDocument();
    });

    it("renders a generic message when the branch-update mutation is rejected with a non-403 status", () => {
      mockedUseUpdateBranchMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      renderView();

      expect(screen.getByText("That change couldn't be saved. Please try again.")).toBeInTheDocument();
    });

    it("renders a 403-specific message when a department-update mutation is rejected with 403", () => {
      mockedUseManagedDepartmentsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseDepartment] }) as never,
      );
      mockedUseUpdateDepartmentMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      renderView();

      expect(
        screen.getByText("You don't have permission to perform that action."),
      ).toBeInTheDocument();
    });

    it("renders a generic message when a department-update mutation is rejected with a non-403 status", () => {
      mockedUseManagedDepartmentsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseDepartment] }) as never,
      );
      mockedUseUpdateDepartmentMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      renderView();

      expect(screen.getByText("That change couldn't be saved. Please try again.")).toBeInTheDocument();
    });
  });

  describe("create-department form", () => {
    it("keeps the submit button disabled until the name field has content", () => {
      renderView();

      expect(screen.getByRole("button", { name: "Add department" })).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText("Department name"), {
        target: { value: "Support" },
      });

      expect(screen.getByRole("button", { name: "Add department" })).toBeEnabled();
    });

    it("submits exactly { name } on the create-department form", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "dept-99" });
      mockedUseCreateDepartmentMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      renderView();

      fireEvent.change(screen.getByPlaceholderText("Department name"), {
        target: { value: "Logistics" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add department" }));

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ name: "Logistics" }));
    });

    it("shows the backend's own message inline on a rejected submission and preserves the entered value", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Department name already exists", 409));
      mockedUseCreateDepartmentMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      renderView();

      fireEvent.change(screen.getByPlaceholderText("Department name"), {
        target: { value: "Support" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add department" }));

      expect(await screen.findByText("Department name already exists")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Support")).toBeInTheDocument();
    });

    it("falls back to the shared network-failure message when the create-department rejection is not an ApiError", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
      mockedUseCreateDepartmentMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      renderView();

      fireEvent.change(screen.getByPlaceholderText("Department name"), {
        target: { value: "Support" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add department" }));

      expect(
        await screen.findByText("Couldn't reach the server. Check your connection and try again."),
      ).toBeInTheDocument();
    });

    it("shows a pending/disabled state while the create-department mutation is in flight", () => {
      mockedUseCreateDepartmentMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: true } as never);

      renderView();

      expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();
    });
  });

  describe("bilingual rendering", () => {
    it("renders the branch and departments headings in English", () => {
      renderView("en");

      expect(screen.getByText("My Branch")).toBeInTheDocument();
      expect(screen.getByText("Departments")).toBeInTheDocument();
    });

    it("renders the branch and departments headings in Arabic", () => {
      renderView("ar");

      expect(screen.getByText("فرعي")).toBeInTheDocument();
      expect(screen.getByText("الأقسام")).toBeInTheDocument();
    });
  });
});
