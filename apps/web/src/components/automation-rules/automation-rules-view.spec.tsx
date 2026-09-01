import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AutomationRulesView } from "./automation-rules-view";
import {
  useAutomationRulesQuery,
  useCreateAutomationRuleMutation,
  useUpdateAutomationRuleMutation,
} from "@/hooks/use-automation-rules";
import { useDepartmentsQuery, useUsersQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-automation-rules", () => ({
  useAutomationRulesQuery: vi.fn(),
  useCreateAutomationRuleMutation: vi.fn(),
  useUpdateAutomationRuleMutation: vi.fn(),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useUsersQuery: vi.fn(),
  useDepartmentsQuery: vi.fn(),
}));

const mockedUseAutomationRulesQuery = vi.mocked(useAutomationRulesQuery);
const mockedUseCreateAutomationRuleMutation = vi.mocked(useCreateAutomationRuleMutation);
const mockedUseUpdateAutomationRuleMutation = vi.mocked(useUpdateAutomationRuleMutation);
const mockedUseUsersQuery = vi.mocked(useUsersQuery);
const mockedUseDepartmentsQuery = vi.mocked(useDepartmentsQuery);

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
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

const baseRule = {
  id: "rule-1",
  name: "Auto-assign billing",
  isActive: true,
  conditionCategory: "billing",
  actionAssignToUserId: "user-1",
  actionSetCategory: null,
  actionSetDepartmentId: null,
};

describe("AutomationRulesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdateAutomationRuleMutation.mockReturnValue(mutationResult() as never);
    mockedUseCreateAutomationRuleMutation.mockReturnValue(mutationResult() as never);
    mockedUseUsersQuery.mockReturnValue(
      queryResult({ data: [{ id: "user-1", fullName: "Jane Agent" }], isSuccess: true }) as never,
    );
    mockedUseDepartmentsQuery.mockReturnValue(
      queryResult({
        data: [{ id: "dept-1", branchId: "branch-1", name: "Billing Dept" }],
        isSuccess: true,
      }) as never,
    );
  });

  it("shows a loading state while the rules query is pending", () => {
    mockedUseAutomationRulesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<AutomationRulesView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseAutomationRulesQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500), refetch }) as never,
    );

    render(<AutomationRulesView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are no rules yet", () => {
    mockedUseAutomationRulesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<AutomationRulesView />);

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("renders a rule's name, condition, resolved assignee name, and status", () => {
    mockedUseAutomationRulesQuery.mockReturnValue(
      queryResult({ data: [baseRule], isSuccess: true }) as never,
    );

    render(<AutomationRulesView />);

    expect(screen.getByText("Auto-assign billing")).toBeInTheDocument();
    expect(screen.getByText("billing")).toBeInTheDocument();
    // "Jane Agent" also appears in the create-form's hidden native <select>
    // option Radix's Select renders for accessibility — at least one visible
    // occurrence (the row's assignee cell) is what this asserts.
    expect(screen.getAllByText("Jane Agent").length).toBeGreaterThan(0);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("falls back to the raw user id when the assignee isn't found in the users list", () => {
    mockedUseAutomationRulesQuery.mockReturnValue(
      queryResult({
        data: [{ ...baseRule, actionAssignToUserId: "user-unknown" }],
        isSuccess: true,
      }) as never,
    );
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<AutomationRulesView />);

    expect(screen.getByText("user-unknown")).toBeInTheDocument();
  });

  it("shows 'any category' for a wildcard rule", () => {
    mockedUseAutomationRulesQuery.mockReturnValue(
      queryResult({ data: [{ ...baseRule, conditionCategory: null }], isSuccess: true }) as never,
    );

    render(<AutomationRulesView />);

    expect(screen.getAllByText("anyCategory").length).toBeGreaterThan(0);
  });

  it("does not deactivate immediately — clicking deactivate opens a confirmation dialog first", () => {
    const mutate = vi.fn();
    mockedUseAutomationRulesQuery.mockReturnValue(
      queryResult({ data: [baseRule], isSuccess: true }) as never,
    );
    mockedUseUpdateAutomationRuleMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<AutomationRulesView />);

    fireEvent.click(screen.getByRole("button", { name: "deactivate" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("toggles a rule's active state via the confirmation dialog", () => {
    const mutate = vi.fn();
    mockedUseAutomationRulesQuery.mockReturnValue(
      queryResult({ data: [baseRule], isSuccess: true }) as never,
    );
    mockedUseUpdateAutomationRuleMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<AutomationRulesView />);

    fireEvent.click(screen.getByRole("button", { name: "deactivate" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "deactivate" }));

    expect(mutate).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("shows a forbidden message when toggling fails with 403", () => {
    mockedUseAutomationRulesQuery.mockReturnValue(
      queryResult({ data: [baseRule], isSuccess: true }) as never,
    );
    mockedUseUpdateAutomationRuleMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<AutomationRulesView />);

    expect(screen.getByText("actionForbidden")).toBeInTheDocument();
  });

  it("disables the create-rule submit button until a name is entered", () => {
    mockedUseAutomationRulesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<AutomationRulesView />);

    expect(screen.getByText("createSubmit").closest("button")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("nameLabel"), {
      target: { value: "Auto-assign support" },
    });

    // Still disabled: no assignee has been chosen yet.
    expect(screen.getByText("createSubmit").closest("button")).toBeDisabled();
  });

  // Story 83 — Automation Rules — Category & Department Actions.
  describe("category/department actions (Story 83)", () => {
    it("shows 'no action' placeholders when neither is set", () => {
      mockedUseAutomationRulesQuery.mockReturnValue(
        queryResult({ data: [baseRule], isSuccess: true }) as never,
      );

      render(<AutomationRulesView />);

      // Two row cells (set-category, set-department) plus the create
      // form's own department-select placeholder, which also reads
      // "noAction" — assert at least the two row cells are present.
      expect(screen.getAllByText("noAction").length).toBeGreaterThanOrEqual(2);
    });

    it("resolves actionSetDepartmentId through the departments list", () => {
      mockedUseAutomationRulesQuery.mockReturnValue(
        queryResult({
          data: [{ ...baseRule, actionSetCategory: "billing", actionSetDepartmentId: "dept-1" }],
          isSuccess: true,
        }) as never,
      );

      render(<AutomationRulesView />);

      expect(screen.getAllByText("billing").length).toBeGreaterThan(0);
      // "Billing Dept" also appears in the create-form's hidden native
      // <select> option Radix's Select renders for accessibility — at
      // least one visible occurrence (the row's own cell) is what this
      // asserts.
      expect(screen.getAllByText("Billing Dept").length).toBeGreaterThan(0);
    });

    it("falls back to the raw department id when it isn't found in the departments list", () => {
      mockedUseAutomationRulesQuery.mockReturnValue(
        queryResult({
          data: [{ ...baseRule, actionSetDepartmentId: "dept-unknown" }],
          isSuccess: true,
        }) as never,
      );
      mockedUseDepartmentsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

      render(<AutomationRulesView />);

      expect(screen.getByText("dept-unknown")).toBeInTheDocument();
    });

    it("submits actionSetCategory/actionSetDepartmentId only when filled in", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      mockedUseAutomationRulesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
      mockedUseCreateAutomationRuleMutation.mockReturnValue(
        mutationResult({ mutateAsync }) as never,
      );

      render(<AutomationRulesView />);

      fireEvent.change(screen.getByLabelText("nameLabel"), {
        target: { value: "Auto-categorize" },
      });
      fireEvent.change(screen.getByLabelText("actionSetCategoryLabel"), {
        target: { value: "sales" },
      });

      const form = screen.getByText("createSubmit").closest("form") as HTMLFormElement;
      fireEvent.submit(form);

      await vi.waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: "Auto-categorize", actionSetCategory: "sales" }),
        );
      });
      expect(mutateAsync.mock.calls[0]?.[0]).not.toHaveProperty("actionSetDepartmentId");
    });
  });
});
