import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketChatCard } from "./ticket-chat-card";
import {
  useCreateTicketMessageMutation,
  useTicketMessagesQuery,
} from "@/hooks/use-ticket-messages";
import { useCurrentUserQuery, useUsersQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-ticket-messages", () => ({
  useTicketMessagesQuery: vi.fn(),
  useCreateTicketMessageMutation: vi.fn(),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useUsersQuery: vi.fn(),
  useCurrentUserQuery: vi.fn(),
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

const customerMessage = {
  id: "message-1",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT",
  direction: "INBOUND" as const,
  senderContactId: "contact-1",
  senderUserId: null,
  body: "I still can't log in.",
  createdAt: "2024-01-01T09:00:00.000Z",
};

const myOwnMessage = {
  id: "message-2",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT",
  direction: "OUTBOUND" as const,
  senderContactId: null,
  senderUserId: "agent-1",
  body: "Let me look into that.",
  createdAt: "2024-01-01T09:01:00.000Z",
};

const colleagueMessage = {
  id: "message-3",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT",
  direction: "OUTBOUND" as const,
  senderContactId: null,
  senderUserId: "agent-2",
  body: "I can take over.",
  createdAt: "2024-01-01T09:02:00.000Z",
};

// Story 85 — replayed from a chat-escalation transcript.
const aiCustomerMessage = {
  id: "message-4",
  ticketId: "ticket-1",
  channelType: "AI_CHAT",
  direction: "INBOUND" as const,
  senderContactId: "contact-1",
  senderUserId: null,
  body: "Cannot log in to my account",
  createdAt: "2024-01-01T08:59:00.000Z",
};

const aiAssistantMessage = {
  id: "message-5",
  ticketId: "ticket-1",
  channelType: "AI_CHAT",
  direction: "OUTBOUND" as const,
  senderContactId: null,
  senderUserId: null,
  body: "Have you tried resetting your password?",
  createdAt: "2024-01-01T08:59:30.000Z",
};

describe("TicketChatCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUsersQuery).mockReturnValue(
      queryResult({
        data: [{ id: "agent-2", fullName: "Sam Colleague" }],
        isSuccess: true,
      }) as never,
    );
    vi.mocked(useCurrentUserQuery).mockReturnValue(
      queryResult({ data: { id: "agent-1" }, isSuccess: true }) as never,
    );
    vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(myOwnMessage),
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it("shows a loading skeleton while messages are loading", () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TicketChatCard ticketId="ticket-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows an error state when the query fails", () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketChatCard ticketId="ticket-1" />);

    expect(screen.getByText("detail.chatLoadError")).toBeInTheDocument();
  });

  it("shows the empty message when there are no messages yet", () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<TicketChatCard ticketId="ticket-1" />);

    expect(screen.getByText("detail.chatEmpty")).toBeInTheDocument();
  });

  it("labels the customer's message, the agent's own message, and a colleague's message distinctly", () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({
        data: [customerMessage, myOwnMessage, colleagueMessage],
        isSuccess: true,
      }) as never,
    );

    render(<TicketChatCard ticketId="ticket-1" />);

    expect(screen.getByText(customerMessage.body)).toBeInTheDocument();
    expect(screen.getByText(myOwnMessage.body)).toBeInTheDocument();
    expect(screen.getByText(colleagueMessage.body)).toBeInTheDocument();
    expect(screen.getByText(/detail.chatCustomerLabel/)).toBeInTheDocument();
    expect(screen.getByText(/detail.chatYouLabel/)).toBeInTheDocument();
    expect(screen.getByText(/Sam Colleague/)).toBeInTheDocument();
  });

  // Story 85 — AI Chat: Escalate to a Human Ticket.
  it("labels an AI_CHAT-channel assistant message as AI Assistant, not Agent, while its customer message still reads Customer", () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({
        data: [aiCustomerMessage, aiAssistantMessage],
        isSuccess: true,
      }) as never,
    );

    render(<TicketChatCard ticketId="ticket-1" />);

    expect(screen.getByText(aiCustomerMessage.body)).toBeInTheDocument();
    expect(screen.getByText(aiAssistantMessage.body)).toBeInTheDocument();
    expect(screen.getByText(/detail.chatCustomerLabel/)).toBeInTheDocument();
    expect(screen.getByText(/detail.chatAiLabel/)).toBeInTheDocument();
    expect(screen.queryByText(/detail.chatAgentLabel/)).not.toBeInTheDocument();
  });

  it("sends a message when the composer is submitted", async () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue(myOwnMessage);
    vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<TicketChatCard ticketId="ticket-1" />);
    const textarea = screen.getByLabelText("detail.chatPlaceholder");
    fireEvent.change(textarea, { target: { value: "Let me look into that." } });
    fireEvent.click(screen.getByText("detail.chatSend"));

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ body: "Let me look into that." });
    });
  });

  it("sends on Enter and inserts a newline on Shift+Enter", async () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue(myOwnMessage);
    vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<TicketChatCard ticketId="ticket-1" />);
    const textarea = screen.getByLabelText("detail.chatPlaceholder");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter" });
    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ body: "hello" });
    });
  });

  it("disables the composer while sending", () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    } as never);

    render(<TicketChatCard ticketId="ticket-1" />);

    expect(screen.getByLabelText("detail.chatPlaceholder")).toBeDisabled();
    expect(screen.getByText("detail.chatSending")).toBeInTheDocument();
  });

  it("shows an inline error when sending fails", async () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockRejectedValue(new ApiError("You lack permission", 403)),
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<TicketChatCard ticketId="ticket-1" />);
    fireEvent.change(screen.getByLabelText("detail.chatPlaceholder"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByText("detail.chatSend"));

    await screen.findByText("You lack permission");
  });

  it("shows the fallback error message for a non-ApiError send failure", async () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockRejectedValue(new Error("network down")),
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<TicketChatCard ticketId="ticket-1" />);
    fireEvent.change(screen.getByLabelText("detail.chatPlaceholder"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByText("detail.chatSend"));

    await screen.findByText("detail.chatSendFailed");
  });
});
