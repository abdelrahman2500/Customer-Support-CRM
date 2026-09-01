import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatWidget } from "./chat-widget";
import {
  useChatAiResultQuery,
  useChatMessagesQuery,
  useEscalateChatSessionMutation,
  useSendChatMessageMutation,
  useStartChatSessionMutation,
} from "@/hooks/use-chat";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { ApiError } from "@/lib/api";

const mockRouterPush = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("@/hooks/use-chat", () => ({
  useStartChatSessionMutation: vi.fn(),
  useChatMessagesQuery: vi.fn(),
  useChatAiResultQuery: vi.fn(),
  useSendChatMessageMutation: vi.fn(),
  useEscalateChatSessionMutation: vi.fn(),
}));

vi.mock("@/hooks/use-chat-realtime", () => ({
  useChatRealtime: vi.fn(),
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

describe("ChatWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStartChatSessionMutation).mockReturnValue({
      mutate: vi.fn((_arg, opts) => opts.onSuccess({ id: "session-1" })),
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(useChatAiResultQuery).mockReturnValue(queryResult({}) as never);
    vi.mocked(useSendChatMessageMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" }),
      isPending: false,
    } as never);
    vi.mocked(useEscalateChatSessionMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ ticketId: "ticket-1" }),
      isPending: false,
    } as never);
  });

  it("starts a session on mount", () => {
    const mutate = vi.fn((_arg, opts) => opts.onSuccess({ id: "session-1" }));
    vi.mocked(useStartChatSessionMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<ChatWidget />);

    expect(mutate).toHaveBeenCalledOnce();
    expect(useChatRealtime).toHaveBeenCalledWith("session-1");
  });

  it("shows a loading skeleton while messages are loading", () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<ChatWidget />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows the empty message when there are no messages yet", () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<ChatWidget />);

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("renders a customer message and an assistant message distinctly", () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({
        data: [
          { id: "m1", role: "CUSTOMER", body: "Hi, I need help", createdAt: "2024-01-01T00:00:00.000Z" },
          { id: "m2", role: "ASSISTANT", body: "How can I help?", createdAt: "2024-01-01T00:00:01.000Z" },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<ChatWidget />);

    expect(screen.getByText("Hi, I need help")).toBeInTheDocument();
    expect(screen.getByText("How can I help?")).toBeInTheDocument();
    expect(screen.getAllByText("youLabel")).toHaveLength(1);
    expect(screen.getAllByText("assistantLabel")).toHaveLength(1);
  });

  it("sends a message and shows the typing indicator while the result is PENDING", async () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSendChatMessageMutation).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useChatAiResultQuery).mockReturnValue(
      queryResult({
        data: { id: "log-1", outcome: "PENDING", outputText: null, errorMessage: null },
        isSuccess: true,
      }) as never,
    );

    render(<ChatWidget />);
    fireEvent.change(screen.getByLabelText("placeholder"), { target: { value: "Hi there" } });
    fireEvent.click(screen.getByText("send"));

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith("Hi there");
    });
    expect(await screen.findByText("typing")).toBeInTheDocument();
  });

  it("renders errorMessage for an ERROR result", async () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSendChatMessageMutation).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useChatAiResultQuery).mockReturnValue(
      queryResult({
        data: { id: "log-1", outcome: "ERROR", outputText: null, errorMessage: "Provider timed out" },
        isSuccess: true,
      }) as never,
    );

    render(<ChatWidget />);
    fireEvent.change(screen.getByLabelText("placeholder"), { target: { value: "Hi there" } });
    fireEvent.click(screen.getByText("send"));

    expect(await screen.findByText("Provider timed out")).toBeInTheDocument();
  });

  it("renders the distinct disabled state for a DISABLED result, not the error one", async () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue({ id: "log-1", outcome: "PENDING" });
    vi.mocked(useSendChatMessageMutation).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useChatAiResultQuery).mockReturnValue(
      queryResult({
        data: { id: "log-1", outcome: "DISABLED", outputText: null, errorMessage: null },
        isSuccess: true,
      }) as never,
    );

    render(<ChatWidget />);
    fireEvent.change(screen.getByLabelText("placeholder"), { target: { value: "Hi there" } });
    fireEvent.click(screen.getByText("send"));

    expect(await screen.findByText("disabled")).toBeInTheDocument();
    expect(screen.queryByText("typing")).not.toBeInTheDocument();
  });

  it("shows an inline error when sending fails", async () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useSendChatMessageMutation).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new ApiError("Session expired", 401)),
      isPending: false,
    } as never);

    render(<ChatWidget />);
    fireEvent.change(screen.getByLabelText("placeholder"), { target: { value: "hello" } });
    fireEvent.click(screen.getByText("send"));

    await screen.findByText("Session expired");
  });

  // Story 85 — AI Chat: Escalate to a Human Ticket.
  it("hides the escalate action when there are no messages yet", () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<ChatWidget />);

    expect(screen.queryByText("escalate")).not.toBeInTheDocument();
  });

  it("shows the escalate action once messages exist and navigates to the new ticket on success", async () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({
        data: [{ id: "m1", role: "CUSTOMER", body: "Hi, I need help", createdAt: "2024-01-01T00:00:00.000Z" }],
        isSuccess: true,
      }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue({ ticketId: "ticket-1" });
    vi.mocked(useEscalateChatSessionMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);

    render(<ChatWidget />);
    fireEvent.click(screen.getByText("escalate"));

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledOnce();
    });
    expect(mockRouterPush).toHaveBeenCalledWith("/en/tickets/ticket-1");
  });

  it("shows an inline error when escalation fails", async () => {
    vi.mocked(useChatMessagesQuery).mockReturnValue(
      queryResult({
        data: [{ id: "m1", role: "CUSTOMER", body: "Hi, I need help", createdAt: "2024-01-01T00:00:00.000Z" }],
        isSuccess: true,
      }) as never,
    );
    vi.mocked(useEscalateChatSessionMutation).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new ApiError("Nothing to escalate yet", 400)),
      isPending: false,
    } as never);

    render(<ChatWidget />);
    fireEvent.click(screen.getByText("escalate"));

    await screen.findByText("Nothing to escalate yet");
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
