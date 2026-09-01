import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickRepliesView } from "./quick-replies-view";
import {
  useCreateQuickReplyMutation,
  useQuickRepliesQuery,
  useUpdateQuickReplyMutation,
} from "@/hooks/use-quick-replies";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-quick-replies", () => ({
  useQuickRepliesQuery: vi.fn(),
  useCreateQuickReplyMutation: vi.fn(),
  useUpdateQuickReplyMutation: vi.fn(),
}));

const mockedUseQuickRepliesQuery = vi.mocked(useQuickRepliesQuery);
const mockedUseCreateQuickReplyMutation = vi.mocked(useCreateQuickReplyMutation);
const mockedUseUpdateQuickReplyMutation = vi.mocked(useUpdateQuickReplyMutation);

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

const baseQuickReply = {
  id: "quick-reply-1",
  title: "Password reset",
  body: "You can reset your password from the login page.",
  isActive: true,
};

describe("QuickRepliesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateQuickReplyMutation.mockReturnValue(mutationResult() as never);
    mockedUseUpdateQuickReplyMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the quick-replies query is pending", () => {
    mockedUseQuickRepliesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<QuickRepliesView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseQuickRepliesQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500), refetch }) as never,
    );

    render(<QuickRepliesView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are no quick replies yet", () => {
    mockedUseQuickRepliesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<QuickRepliesView />);

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("renders a quick reply's title, body, and status", () => {
    mockedUseQuickRepliesQuery.mockReturnValue(
      queryResult({ data: [baseQuickReply], isSuccess: true }) as never,
    );

    render(<QuickRepliesView />);

    expect(screen.getByText("Password reset")).toBeInTheDocument();
    expect(screen.getByText(baseQuickReply.body)).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("toggles a quick reply's active state", () => {
    const mutate = vi.fn();
    mockedUseQuickRepliesQuery.mockReturnValue(
      queryResult({ data: [baseQuickReply], isSuccess: true }) as never,
    );
    mockedUseUpdateQuickReplyMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<QuickRepliesView />);

    fireEvent.click(screen.getByText("deactivate"));

    expect(mutate).toHaveBeenCalledWith({ isActive: false });
  });

  it("shows a forbidden message when toggling fails with 403", () => {
    mockedUseQuickRepliesQuery.mockReturnValue(
      queryResult({ data: [baseQuickReply], isSuccess: true }) as never,
    );
    mockedUseUpdateQuickReplyMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<QuickRepliesView />);

    expect(screen.getByText("actionForbidden")).toBeInTheDocument();
  });

  it("disables the create submit button until both title and body are filled in", () => {
    mockedUseQuickRepliesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<QuickRepliesView />);

    expect(screen.getByText("createSubmit").closest("button")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("titleLabel"), {
      target: { value: "Password reset" },
    });
    expect(screen.getByText("createSubmit").closest("button")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("bodyLabel"), {
      target: { value: "You can reset your password from the login page." },
    });
    expect(screen.getByText("createSubmit").closest("button")).not.toBeDisabled();
  });

  it("submits a new quick reply and clears the form on success", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(baseQuickReply);
    mockedUseQuickRepliesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseCreateQuickReplyMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<QuickRepliesView />);

    fireEvent.change(screen.getByLabelText("titleLabel"), {
      target: { value: "Password reset" },
    });
    fireEvent.change(screen.getByLabelText("bodyLabel"), {
      target: { value: "You can reset your password from the login page." },
    });
    fireEvent.submit(screen.getByText("createSubmit").closest("form") as HTMLFormElement);

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        title: "Password reset",
        body: "You can reset your password from the login page.",
      });
    });
    await vi.waitFor(() => {
      expect(screen.getByLabelText("titleLabel")).toHaveValue("");
    });
  });

  it("shows an inline error when creating fails", async () => {
    mockedUseQuickRepliesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseCreateQuickReplyMutation.mockReturnValue(
      mutationResult({ mutateAsync: vi.fn().mockRejectedValue(new ApiError("Bad request", 400)) }) as never,
    );

    render(<QuickRepliesView />);

    fireEvent.change(screen.getByLabelText("titleLabel"), {
      target: { value: "Password reset" },
    });
    fireEvent.change(screen.getByLabelText("bodyLabel"), {
      target: { value: "You can reset your password from the login page." },
    });
    fireEvent.submit(screen.getByText("createSubmit").closest("form") as HTMLFormElement);

    await screen.findByText("Bad request");
  });
});
