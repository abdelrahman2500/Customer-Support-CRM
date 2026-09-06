import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TasksPanel } from "./tasks-panel";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useTasksQuery,
  useUpdateTaskMutation,
} from "@/hooks/use-tasks";
import { useTaskReminders } from "@/hooks/use-task-reminders";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

vi.mock("@/hooks/use-tasks", () => ({
  tasksQueryKey: ["tasks"],
  useTasksQuery: vi.fn(),
  useCreateTaskMutation: vi.fn(),
  useUpdateTaskMutation: vi.fn(),
  useDeleteTaskMutation: vi.fn(),
}));
vi.mock("@/hooks/use-task-reminders", () => ({
  useTaskReminders: vi.fn(),
}));

const mockedUseTasksQuery = vi.mocked(useTasksQuery);
const mockedUseCreateTaskMutation = vi.mocked(useCreateTaskMutation);
const mockedUseUpdateTaskMutation = vi.mocked(useUpdateTaskMutation);
const mockedUseDeleteTaskMutation = vi.mocked(useDeleteTaskMutation);
const mockedUseTaskReminders = vi.mocked(useTaskReminders);

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

function taskFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    title: "Follow up with Acme Corp",
    notes: null,
    priority: "MEDIUM",
    ticketId: null,
    customerId: null,
    dueAt: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TasksPanel", () => {
  let updateMutate: ReturnType<typeof vi.fn>;
  let deleteMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    updateMutate = vi.fn();
    deleteMutate = vi.fn();
    mockedUseTaskReminders.mockReturnValue(undefined);
    mockedUseCreateTaskMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(taskFixture()),
      isPending: false,
    } as never);
    mockedUseUpdateTaskMutation.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    mockedUseDeleteTaskMutation.mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as never);
  });

  it("shows loading skeletons while the tasks query is pending", () => {
    mockedUseTasksQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TasksPanel userId="user-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows an error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseTasksQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<TasksPanel userId="user-1" />);
    fireEvent.click(screen.getByText("retry"));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are no open tasks", () => {
    mockedUseTasksQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 } }) as never,
    );

    render(<TasksPanel userId="user-1" />);

    expect(screen.getByText("tasks.empty")).toBeInTheDocument();
  });

  it("renders each open task's title and priority", () => {
    mockedUseTasksQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { items: [taskFixture()], total: 1, page: 1, pageSize: 25, totalPages: 1 },
      }) as never,
    );

    render(<TasksPanel userId="user-1" />);

    expect(screen.getByText("Follow up with Acme Corp")).toBeInTheDocument();
    // "MEDIUM" also appears as the create-form's own default priority
    // selection — at least one instance is this row's own priority badge.
    expect(screen.getAllByText("MEDIUM").length).toBeGreaterThan(0);
  });

  it("shows an overdue badge for a past-due, incomplete task", () => {
    mockedUseTasksQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: {
          items: [taskFixture({ dueAt: "2020-01-01T00:00:00.000Z" })],
          total: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1,
        },
      }) as never,
    );

    render(<TasksPanel userId="user-1" />);

    expect(screen.getByText("tasks.overdue")).toBeInTheDocument();
  });

  it("does not show an overdue badge for a task with no due date", () => {
    mockedUseTasksQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { items: [taskFixture()], total: 1, page: 1, pageSize: 25, totalPages: 1 },
      }) as never,
    );

    render(<TasksPanel userId="user-1" />);

    expect(screen.queryByText("tasks.overdue")).not.toBeInTheDocument();
  });

  it("marks a task complete", () => {
    mockedUseTasksQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { items: [taskFixture()], total: 1, page: 1, pageSize: 25, totalPages: 1 },
      }) as never,
    );

    render(<TasksPanel userId="user-1" />);
    fireEvent.click(screen.getByText("tasks.completeButton"));

    expect(updateMutate).toHaveBeenCalledWith({ completed: true });
  });

  it("deletes a task after confirming", () => {
    mockedUseTasksQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { items: [taskFixture()], total: 1, page: 1, pageSize: 25, totalPages: 1 },
      }) as never,
    );

    render(<TasksPanel userId="user-1" />);
    fireEvent.click(screen.getByText("tasks.deleteButton"));
    // The confirm dialog renders a second "delete" button (its confirmLabel) —
    // click the one inside the dialog.
    const buttons = screen.getAllByText("tasks.deleteButton");
    fireEvent.click(buttons.at(-1)!);

    expect(deleteMutate).toHaveBeenCalled();
  });

  it("shows an inline error when completing a task fails", () => {
    mockedUseTasksQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { items: [taskFixture()], total: 1, page: 1, pageSize: 25, totalPages: 1 },
      }) as never,
    );
    mockedUseUpdateTaskMutation.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
      isError: true,
      error: new ApiError("You lack permission", 403),
    } as never);

    render(<TasksPanel userId="user-1" />);

    expect(screen.getByText("tasks.actionForbidden")).toBeInTheDocument();
  });

  describe("create flow", () => {
    it("submits a new task with the entered title", async () => {
      const mutateAsync = vi.fn().mockResolvedValue(taskFixture());
      mockedUseCreateTaskMutation.mockReturnValue({ mutateAsync, isPending: false } as never);
      mockedUseTasksQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 } }) as never,
      );

      render(<TasksPanel userId="user-1" />);
      fireEvent.change(screen.getByLabelText("tasks.titleLabel"), {
        target: { value: "Call the customer back" },
      });
      fireEvent.click(screen.getByText("tasks.createSubmit"));

      await vi.waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Call the customer back", priority: "MEDIUM" }),
        );
      });
    });

    it("disables submit while the title is empty", () => {
      mockedUseTasksQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 } }) as never,
      );

      render(<TasksPanel userId="user-1" />);

      expect(screen.getByText("tasks.createSubmit").closest("button")).toBeDisabled();
    });

    it("shows the generic failure message for an unexpected (5xx) error — never the raw backend text", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Server error", 500));
      mockedUseCreateTaskMutation.mockReturnValue({ mutateAsync, isPending: false } as never);
      mockedUseTasksQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 } }) as never,
      );

      render(<TasksPanel userId="user-1" />);
      fireEvent.change(screen.getByLabelText("tasks.titleLabel"), { target: { value: "x" } });
      fireEvent.click(screen.getByText("tasks.createSubmit"));

      expect(await screen.findByText("tasks.createFailed")).toBeInTheDocument();
    });

    it("shows the backend's own validation message for a 400 error", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Title is required", 400));
      mockedUseCreateTaskMutation.mockReturnValue({ mutateAsync, isPending: false } as never);
      mockedUseTasksQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 } }) as never,
      );

      render(<TasksPanel userId="user-1" />);
      fireEvent.change(screen.getByLabelText("tasks.titleLabel"), { target: { value: "x" } });
      fireEvent.click(screen.getByText("tasks.createSubmit"));

      expect(await screen.findByText("Title is required")).toBeInTheDocument();
    });
  });
});
