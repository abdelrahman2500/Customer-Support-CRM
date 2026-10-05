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

  // Story 162 -- the result skeleton is a single element, so `asChild` makes
  // the Skeleton itself the hidden placeholder: no wrapper, same classes.
  it("announces the AI result load without adding a wrapper around its skeleton", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSummarize"));

    const status = await screen.findByRole("status", { name: "loading" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status.children).toHaveLength(1);
    expect(status.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(status.firstElementChild).toHaveClass("animate-pulse", "h-16", "w-full");
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

  // Global Navigation Loading (UX audit) — `pendingFeature` tracking.
  it("shows isLoading only on the clicked action's own button while its submit is in flight", async () => {
    let resolveMutate: (value: { id: string; outcome: string }) => void = () => {};
    const mutateAsync = vi.fn(
      () =>
        new Promise<{ id: string; outcome: string }>((resolve) => {
          resolveMutate = resolve;
        }),
    );
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);

    const summarizeButton = screen.getByRole("button", { name: "detail.aiSummarize" });
    const categorizeButton = screen.getByRole("button", { name: "detail.aiCategorize" });
    fireEvent.click(summarizeButton);

    await vi.waitFor(() => {
      expect(summarizeButton).toHaveAttribute("aria-busy", "true");
    });
    // The clicked button's own accessible name survives — Button's isLoading
    // hides the label visually, not from the accessibility tree.
    expect(summarizeButton).toHaveAccessibleName("detail.aiSummarize");
    // The other three actions never claim to be loading too.
    expect(categorizeButton).not.toHaveAttribute("aria-busy");

    resolveMutate({ id: "log-1", outcome: "PENDING" });

    await vi.waitFor(() => {
      expect(summarizeButton).not.toHaveAttribute("aria-busy");
    });
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

  // Story 208 (RD-3.8, recon TW-06) — a suggested reply can go into the draft.
  it("offers 'insert into reply' for a suggested reply and hands over its text", async () => {
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" }),
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({
        data: {
          id: "log-1",
          feature: "SUGGEST_REPLY",
          outcome: "SUCCESS",
          outputText: "Please try resetting your password.",
          errorMessage: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );
    const onInsertReply = vi.fn();

    render(
      <TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} onInsertReply={onInsertReply} />,
    );
    fireEvent.click(screen.getByText("detail.aiSuggestReply"));
    fireEvent.click(await screen.findByRole("button", { name: "detail.aiInsertIntoReply" }));

    expect(onInsertReply).toHaveBeenCalledWith("Please try resetting your password.");
  });

  it("offers no reply insert for any other feature", async () => {
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" }),
      isPending: false,
    } as never);
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({
        data: {
          id: "log-1",
          feature: "SUMMARIZE",
          outcome: "SUCCESS",
          outputText: "A short summary.",
          errorMessage: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );

    render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} onInsertReply={vi.fn()} />);
    fireEvent.click(screen.getByText("detail.aiSummarize"));

    expect(await screen.findByText("A short summary.")).toBeInTheDocument();
    expect(screen.queryByText("detail.aiInsertIntoReply")).not.toBeInTheDocument();
  });

  // Story 209 (RD-3.9, recon TW-06) — announced transitions, pinned summary.
  describe("AI assist panel (Story 209)", () => {
    function submitting() {
      vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" }),
        isPending: false,
      } as never);
    }

    function liveRegion() {
      return screen.getByText(
        (_, element) => element?.getAttribute("aria-live") === "polite" && element.tagName === "P",
      );
    }

    it("has an empty polite live region from the start", () => {
      render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);

      const region = document.querySelector('p[aria-live="polite"]')!;
      expect(region).toHaveAttribute("role", "status");
      expect(region).toBeEmptyDOMElement();
    });

    it("announces working, then ready, in the same region", async () => {
      submitting();
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
      const { rerender } = render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
      const region = document.querySelector('p[aria-live="polite"]')!;

      fireEvent.click(screen.getByText("detail.aiSummarize"));
      await vi.waitFor(() => expect(region).toHaveTextContent("detail.aiStatusPending"));

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
      rerender(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
      expect(region).toHaveTextContent("detail.aiStatusReady");
      expect(liveRegion()).toBe(region);
    });

    it("announces a failure and the turned-off state", async () => {
      submitting();
      vi.mocked(useTicketAiResultQuery).mockReturnValue(
        queryResult({
          data: {
            id: "log-1",
            feature: "SUGGEST_REPLY",
            outcome: "ERROR",
            outputText: null,
            errorMessage: "Model timeout",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          isSuccess: true,
        }) as never,
      );
      const { rerender } = render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
      const region = document.querySelector('p[aria-live="polite"]')!;

      fireEvent.click(screen.getByText("detail.aiSuggestReply"));
      await vi.waitFor(() => expect(region).toHaveTextContent("detail.aiStatusFailed"));

      vi.mocked(useTicketAiResultQuery).mockReturnValue(
        queryResult({
          data: {
            id: "log-1",
            feature: "SUGGEST_REPLY",
            outcome: "DISABLED",
            outputText: null,
            errorMessage: null,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          isSuccess: true,
        }) as never,
      );
      rerender(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);
      expect(region).toHaveTextContent("detail.aiStatusDisabled");
    });

    it("hands a successful summary over once per result, and nothing else", async () => {
      submitting();
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
      const onSummary = vi.fn();
      const { rerender } = render(
        <TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} onSummary={onSummary} />,
      );

      fireEvent.click(screen.getByText("detail.aiSummarize"));
      await vi.waitFor(() =>
        expect(onSummary).toHaveBeenCalledWith({
          id: "log-1",
          text: "Customer cannot log in.",
          at: "2024-01-01T00:00:00.000Z",
        }),
      );
      rerender(
        <TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} onSummary={onSummary} />,
      );
      expect(onSummary).toHaveBeenCalledOnce();
    });

    it("does not pin any other feature's result", async () => {
      submitting();
      vi.mocked(useTicketAiResultQuery).mockReturnValue(
        queryResult({
          data: {
            id: "log-1",
            feature: "SUGGEST_SOLUTIONS",
            outcome: "SUCCESS",
            outputText: "Reset it.",
            errorMessage: null,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          isSuccess: true,
        }) as never,
      );
      const onSummary = vi.fn();
      render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} onSummary={onSummary} />);

      fireEvent.click(screen.getByText("detail.aiSuggestSolutions"));
      expect(await screen.findByText("Reset it.")).toBeInTheDocument();
      expect(onSummary).not.toHaveBeenCalled();
    });

    it("is a collapsible section, open by default", () => {
      render(<TicketAiCard ticketId="ticket-1" onApplyCategory={vi.fn()} />);

      const toggle = screen.getByRole("button", { name: "detail.aiHeading" });
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByText("detail.aiSummarize")).not.toBeVisible();
    });
  });
});
