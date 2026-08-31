import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketChatCard } from "./ticket-chat-card";
import {
  useMyTicketMessagesQuery,
  useSendMyTicketMessageMutation,
} from "@/hooks/use-portal-tickets";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-tickets", () => ({
  useMyTicketMessagesQuery: vi.fn(),
  useSendMyTicketMessageMutation: vi.fn(),
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

const agentMessage = {
  id: "message-1",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT",
  direction: "OUTBOUND" as const,
  senderContactId: null,
  senderUserId: "agent-1",
  body: "How can I help?",
  createdAt: "2024-01-01T09:00:00.000Z",
};

const myMessage = {
  id: "message-2",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT",
  direction: "INBOUND" as const,
  senderContactId: "contact-1",
  senderUserId: null,
  body: "I still can't log in.",
  createdAt: "2024-01-01T09:01:00.000Z",
};

describe("TicketChatCard (portal)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSendMyTicketMessageMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(myMessage),
      isPending: false,
    } as never);
  });

  it("shows a loading skeleton while messages are loading", () => {
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TicketChatCard ticketId="ticket-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows an error state when the query fails", () => {
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketChatCard ticketId="ticket-1" />);

    expect(screen.getByText("detail.chatLoadError")).toBeInTheDocument();
  });

  it("shows the empty message when there are no messages yet", () => {
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<TicketChatCard ticketId="ticket-1" />);

    expect(screen.getByText("detail.chatEmpty")).toBeInTheDocument();
  });

  it("labels an agent's message and the contact's own message distinctly", () => {
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [agentMessage, myMessage], isSuccess: true }) as never,
    );

    render(<TicketChatCard ticketId="ticket-1" />);

    expect(screen.getByText(agentMessage.body)).toBeInTheDocument();
    expect(screen.getByText(myMessage.body)).toBeInTheDocument();
    expect(screen.getByText(/detail.chatAgentLabel/)).toBeInTheDocument();
    expect(screen.getByText(/detail.chatYouLabel/)).toBeInTheDocument();
  });

  it("sends a message when the composer is submitted", async () => {
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue(myMessage);
    vi.mocked(useSendMyTicketMessageMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);

    render(<TicketChatCard ticketId="ticket-1" />);
    fireEvent.change(screen.getByLabelText("detail.chatPlaceholder"), {
      target: { value: "I still can't log in." },
    });
    fireEvent.click(screen.getByText("detail.chatSend"));

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ body: "I still can't log in." });
    });
  });

  it("sends on Enter and inserts a newline on Shift+Enter", async () => {
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue(myMessage);
    vi.mocked(useSendMyTicketMessageMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
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
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useSendMyTicketMessageMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as never);

    render(<TicketChatCard ticketId="ticket-1" />);

    expect(screen.getByLabelText("detail.chatPlaceholder")).toBeDisabled();
    expect(screen.getByText("detail.chatSending")).toBeInTheDocument();
  });

  it("shows an inline error when sending fails", async () => {
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useSendMyTicketMessageMutation).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new ApiError("Ticket not found", 404)),
      isPending: false,
    } as never);

    render(<TicketChatCard ticketId="ticket-1" />);
    fireEvent.change(screen.getByLabelText("detail.chatPlaceholder"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByText("detail.chatSend"));

    await screen.findByText("Ticket not found");
  });

  it("shows the fallback error message for a non-ApiError send failure", async () => {
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useSendMyTicketMessageMutation).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error("network down")),
      isPending: false,
    } as never);

    render(<TicketChatCard ticketId="ticket-1" />);
    fireEvent.change(screen.getByLabelText("detail.chatPlaceholder"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByText("detail.chatSend"));

    await screen.findByText("detail.chatSendFailed");
  });
});
