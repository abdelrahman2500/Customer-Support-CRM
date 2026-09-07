import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketAiCard } from "./ticket-ai-card";
import { useSubmitAiOperationMutation, useTicketAiResultQuery } from "@/hooks/use-ticket-ai";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-ticket-ai", () => ({
  useSubmitAiOperationMutation: vi.fn(),
  useTicketAiResultQuery: vi.fn(),
}));

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    ...overrides,
  };
}

describe("TicketAiCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketAiResultQuery).mockReturnValue(queryResult({}) as never);
  });

  it("renders the four actions with no operation submitted yet", () => {
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);

    expect(screen.getByText("detail.aiSummarize")).toBeInTheDocument();
    expect(screen.getByText("detail.aiSuggestReply")).toBeInTheDocument();
    expect(screen.getByText("detail.aiCategorize")).toBeInTheDocument();
    expect(screen.getByText("detail.aiSuggestSolutions")).toBeInTheDocument();
    expect(screen.queryByText("detail.aiPending")).not.toBeInTheDocument();
  });

  // RM-00 — Suggested Solutions.
  it("submits Suggest Solutions and renders its outputText like any other plain-text feature", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({
        data: {
          id: "log-1",
          feature: "SUGGEST_SOLUTIONS",
          outcome: "SUCCESS",
          outputText: "Try resetting the password via Settings.",
          errorMessage: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSuggestSolutions"));

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith("SUGGEST_SOLUTIONS");
    });
    expect(await screen.findByText("Try resetting the password via Settings.")).toBeInTheDocument();
    // No "use as category" action for this feature.
    expect(screen.queryByText("detail.aiUseAsCategory")).not.toBeInTheDocument();
  });

  it("submits Summarize and shows PENDING once tracked", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({
        data: {
          id: "log-1",
          feature: "SUMMARIZE",
          outcome: "PENDING",
          outputText: null,
          errorMessage: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSummarize"));

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith("SUMMARIZE");
    });
    expect(await screen.findByText("detail.aiPending")).toBeInTheDocument();
  });

  it("renders outputText for a SUCCESS result", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({
        data: {
          id: "log-1",
          feature: "SUMMARIZE",
          outcome: "SUCCESS",
          outputText: "Customer cannot log in.",
          errorMessage: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSummarize"));

    expect(await screen.findByText("Customer cannot log in.")).toBeInTheDocument();
  });

  it("renders errorMessage for an ERROR result", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({
        data: {
          id: "log-1",
          feature: "SUMMARIZE",
          outcome: "ERROR",
          outputText: null,
          errorMessage: "Provider timed out",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSummarize"));

    expect(await screen.findByText("Provider timed out")).toBeInTheDocument();
  });

  it("renders the distinct disabled state for a DISABLED result, not the error one", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({
        data: {
          id: "log-1",
          feature: "SUMMARIZE",
          outcome: "DISABLED",
          outputText: null,
          errorMessage: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );

    const { container } = render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSummarize"));

    expect(await screen.findByText("detail.aiDisabled")).toBeInTheDocument();
    // The distinct disabled state never uses the destructive (ERROR) Alert
    // variant's styling — this is the assertion that it's a different
    // rendering path, not just different text.
    expect(container.querySelector(".border-red-200")).not.toBeInTheDocument();
  });

  it("only shows 'use as category' for CATEGORIZE + SUCCESS, and calls onApplyCategory with outputText", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({
        data: {
          id: "log-1",
          feature: "CATEGORIZE",
          outcome: "SUCCESS",
          outputText: "billing",
          errorMessage: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );
    const onApplyCategory = vi.fn();

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={onApplyCategory} />);
    fireEvent.click(screen.getByText("detail.aiCategorize"));

    const applyButton = await screen.findByText("detail.aiUseAsCategory");
    fireEvent.click(applyButton);

    expect(onApplyCategory).toHaveBeenCalledWith("billing");
  });

  it("does not show 'use as category' for a SUMMARIZE SUCCESS result", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({
        data: {
          id: "log-1",
          feature: "SUMMARIZE",
          outcome: "SUCCESS",
          outputText: "Customer cannot log in.",
          errorMessage: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSummarize"));

    await screen.findByText("Customer cannot log in.");
    expect(screen.queryByText("detail.aiUseAsCategory")).not.toBeInTheDocument();
  });

  it("shows the shared forbidden text, not the raw backend message, for a 403 submit failure", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("You lack permission", 403));
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSummarize"));

    // Batch 1 (UX audit) — 403 is classified as "forbidden", which always
    // renders the feature's own translated copy, never the raw ApiError
    // message (that would leak whatever text the backend happened to send).
    expect(await screen.findByText("detail.actionForbidden")).toBeInTheDocument();
    expect(screen.queryByText("You lack permission")).not.toBeInTheDocument();
  });

  it("shows the generic submit-failed fallback for an unexpected 500 submit failure", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("stack trace-ish internals", 500));
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSummarize"));

    expect(await screen.findByText("detail.aiSubmitFailed")).toBeInTheDocument();
    expect(screen.queryByText("stack trace-ish internals")).not.toBeInTheDocument();
  });
});
