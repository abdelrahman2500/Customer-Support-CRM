import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SlaPolicyListView } from "./sla-policy-list-view";
import { useSlaPoliciesQuery, useUpdateSlaPolicyMutation } from "@/hooks/use-sla-policies";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import { ApiError } from "@/lib/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-sla-policies", () => ({
  useSlaPoliciesQuery: vi.fn(),
  useUpdateSlaPolicyMutation: vi.fn(),
}));

vi.mock("@/hooks/use-ticket-categories", () => ({
  useTicketCategoriesQuery: vi.fn(),
}));

const mockedUseSlaPoliciesQuery = vi.mocked(useSlaPoliciesQuery);
const mockedUseUpdateSlaPolicyMutation = vi.mocked(useUpdateSlaPolicyMutation);
const mockedUseTicketCategoriesQuery = vi.mocked(useTicketCategoriesQuery);

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

const basePolicy = {
  id: "policy-1",
  departmentId: "dept-1",
  categoryId: "category-1",
  priority: "HIGH",
  responseTargetMinutes: 30,
  resolutionTargetMinutes: 240,
  isActive: true,
};

describe("SlaPolicyListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdateSlaPolicyMutation.mockReturnValue(mutationResult() as never);
    mockedUseTicketCategoriesQuery.mockReturnValue(
      queryResult({
        data: [{ id: "category-1", branchId: "branch-1", name: "billing", isActive: true }],
        isSuccess: true,
      }) as never,
    );
  });

  it("shows a loading state while the policies query is pending", () => {
    mockedUseSlaPoliciesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<SlaPolicyListView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows an error state with a retry action when the query fails", () => {
    const refetch = vi.fn();
    mockedUseSlaPoliciesQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<SlaPolicyListView />);

    expect(screen.getByText("list.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("list.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state with a prominent create action when the query succeeds with zero policies", () => {
    mockedUseSlaPoliciesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<SlaPolicyListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
    expect(screen.getAllByText("list.createButton").length).toBeGreaterThan(0);
  });

  it("navigates to the create route when a create button is clicked", () => {
    mockedUseSlaPoliciesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<SlaPolicyListView />);
    fireEvent.click(screen.getAllByText("list.createButton")[0] as HTMLElement);

    expect(push).toHaveBeenCalledWith("/en/sla-policies/new");
  });

  it("renders a row per policy with its read-only scoping once the query succeeds", () => {
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [basePolicy] }) as never,
    );

    render(<SlaPolicyListView />);

    expect(screen.getByText("dept-1")).toBeInTheDocument();
    expect(screen.getByText("billing")).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30")).toBeInTheDocument();
    expect(screen.getByDisplayValue("240")).toBeInTheDocument();
    expect(screen.getByText("list.active")).toBeInTheDocument();
  });

  it("falls back to the placeholder labels for unscoped fields", () => {
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ ...basePolicy, departmentId: null, categoryId: null, priority: null }],
      }) as never,
    );

    render(<SlaPolicyListView />);

    expect(screen.getByText("list.noDepartment")).toBeInTheDocument();
    expect(screen.getByText("list.noCategory")).toBeInTheDocument();
    expect(screen.getByText("list.noPriority")).toBeInTheDocument();
  });

  it("commits a response-target edit on blur when the value changed", () => {
    const mutate = vi.fn();
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [basePolicy] }) as never,
    );
    mockedUseUpdateSlaPolicyMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<SlaPolicyListView />);

    const input = screen.getByDisplayValue("30");
    fireEvent.change(input, { target: { value: "45" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith(
      { responseTargetMinutes: 45 },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("commits a resolution-target edit on blur when the value changed", () => {
    const mutate = vi.fn();
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [basePolicy] }) as never,
    );
    mockedUseUpdateSlaPolicyMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<SlaPolicyListView />);

    const input = screen.getByDisplayValue("240");
    fireEvent.change(input, { target: { value: "480" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith(
      { resolutionTargetMinutes: 480 },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("does not commit and reverts the draft when an invalid value is entered", () => {
    const mutate = vi.fn();
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [basePolicy] }) as never,
    );
    mockedUseUpdateSlaPolicyMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<SlaPolicyListView />);

    const input = screen.getByDisplayValue("30");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("30")).toBeInTheDocument();
  });

  it("does not commit when the field is blurred unchanged", () => {
    const mutate = vi.fn();
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [basePolicy] }) as never,
    );
    mockedUseUpdateSlaPolicyMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<SlaPolicyListView />);

    const input = screen.getByDisplayValue("30");
    fireEvent.blur(input);

    expect(mutate).not.toHaveBeenCalled();
  });

  it("does not deactivate immediately — clicking the deactivate button opens a confirmation dialog first", () => {
    const mutate = vi.fn();
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [basePolicy] }) as never,
    );
    mockedUseUpdateSlaPolicyMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<SlaPolicyListView />);

    fireEvent.click(screen.getByRole("button", { name: "list.deactivate" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("toggles active state via the activate/deactivate button's confirmation dialog", () => {
    const mutate = vi.fn();
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [basePolicy] }) as never,
    );
    mockedUseUpdateSlaPolicyMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<SlaPolicyListView />);

    fireEvent.click(screen.getByRole("button", { name: "list.deactivate" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "list.deactivate" }));

    expect(mutate).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("renders an inline permission error when a mutation is rejected with 403", () => {
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [basePolicy] }) as never,
    );
    mockedUseUpdateSlaPolicyMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<SlaPolicyListView />);

    expect(screen.getByText("list.actionForbidden")).toBeInTheDocument();
  });

  it("renders a generic action-failed message for a non-403 mutation error", () => {
    mockedUseSlaPoliciesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [basePolicy] }) as never,
    );
    mockedUseUpdateSlaPolicyMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<SlaPolicyListView />);

    expect(screen.getByText("list.actionFailed")).toBeInTheDocument();
  });
});
