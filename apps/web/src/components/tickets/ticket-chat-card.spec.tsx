import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketChatCard } from "./ticket-chat-card";
import {
  useCreateTicketEmailMessageMutation,
  useCreateTicketMessageMutation,
  useEmailChannelStatusQuery,
  useTicketMessagesQuery,
} from "@/hooks/use-ticket-messages";
import { useCurrentUserQuery, useUsersQuery } from "@/hooks/use-tickets";
import { useQuickRepliesQuery } from "@/hooks/use-quick-replies";
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
  useCreateTicketEmailMessageMutation: vi.fn(),
  useEmailChannelStatusQuery: vi.fn(),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useUsersQuery: vi.fn(),
  useCurrentUserQuery: vi.fn(),
}));

vi.mock("@/hooks/use-quick-replies", () => ({
  useQuickRepliesQuery: vi.fn(),
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

// RM-13 — every fixture below now carries `deliveryStatus: "DELIVERED"`,
// matching what the real API always returns for these channels (Live
// Chat/AI_CHAT are always instantly delivered) — omitting it would make
// the new delivery-status indicator (direction === "OUTBOUND" &&
// deliveryStatus !== "DELIVERED") spuriously render in every test below
// that isn't specifically testing it.
const customerMessage = {
  id: "message-1",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT",
  direction: "INBOUND" as const,
  senderContactId: "contact-1",
  senderUserId: null,
  body: "I still can't log in.",
  createdAt: "2024-01-01T09:00:00.000Z",
  deliveryStatus: "DELIVERED" as const,
  externalMessageId: null,
  failureReason: null,
  retryCount: 0,
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
  deliveryStatus: "DELIVERED" as const,
  externalMessageId: null,
  failureReason: null,
  retryCount: 0,
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
  deliveryStatus: "DELIVERED" as const,
  externalMessageId: null,
  failureReason: null,
  retryCount: 0,
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
  deliveryStatus: "DELIVERED" as const,
  externalMessageId: null,
  failureReason: null,
  retryCount: 0,
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
  deliveryStatus: "DELIVERED" as const,
  externalMessageId: null,
  failureReason: null,
  retryCount: 0,
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
    // RM-15 — defaults to "not configured" (no checkbox, no separate
    // mutation exercised) so every pre-existing test below keeps testing
    // exactly the Live Chat flow it always has; the "send by email
    // (RM-15)" describe block below overrides this explicitly.
    vi.mocked(useCreateTicketEmailMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(myOwnMessage),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useEmailChannelStatusQuery).mockReturnValue(
      queryResult({ data: { configured: false }, isSuccess: true }) as never,
    );
    vi.mocked(useQuickRepliesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
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

  it("shows the shared forbidden text, not the raw backend message, for a 403 send failure", async () => {
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

    // Batch 1 (UX audit) — 403 is classified as "forbidden": always the
    // feature's own translated copy, never the raw ApiError message.
    await screen.findByText("detail.actionForbidden");
    expect(screen.queryByText("You lack permission")).not.toBeInTheDocument();
  });

  it("shows the shared network-error message for a non-ApiError send failure", async () => {
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

    // Batch 1 (UX audit) — a non-`ApiError` rejection is a network failure,
    // never this feature's own generic fallback text.
    await screen.findByText("errors.network");
  });

  it("shows the generic send-failed fallback for an unexpected 500 send failure", async () => {
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockRejectedValue(new ApiError("stack trace-ish internals", 500)),
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
    expect(screen.queryByText("stack trace-ish internals")).not.toBeInTheDocument();
  });

  // RM-13 — Channel Message Delivery Status & Retry Model.
  describe("delivery-status indicator (RM-13)", () => {
    it("shows no indicator at all for an INBOUND message, regardless of its own deliveryStatus", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({
          data: [{ ...customerMessage, deliveryStatus: "PENDING" as const }],
          isSuccess: true,
        }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.queryByText("detail.chatDeliveryStatus.PENDING")).not.toBeInTheDocument();
    });

    it("shows no indicator for an OUTBOUND message that is already DELIVERED (every message today)", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [myOwnMessage], isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.queryByText(/detail.chatDeliveryStatus/)).not.toBeInTheDocument();
    });

    it("shows the PENDING label for an OUTBOUND message still awaiting delivery", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({
          data: [{ ...myOwnMessage, deliveryStatus: "PENDING" as const }],
          isSuccess: true,
        }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.getByText("detail.chatDeliveryStatus.PENDING")).toBeInTheDocument();
    });

    it("shows the SENT label once the provider has accepted the message", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({
          data: [
            {
              ...myOwnMessage,
              deliveryStatus: "SENT" as const,
              externalMessageId: "provider-msg-1",
            },
          ],
          isSuccess: true,
        }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.getByText("detail.chatDeliveryStatus.SENT")).toBeInTheDocument();
    });

    it("shows the FAILED label, styled destructively, once every retry is exhausted", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({
          data: [
            {
              ...myOwnMessage,
              deliveryStatus: "FAILED" as const,
              failureReason: "Provider rejected: invalid recipient",
              retryCount: 3,
            },
          ],
          isSuccess: true,
        }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.getByText("detail.chatDeliveryStatus.FAILED")).toHaveClass("text-danger-solid");
    });
  });

  // RM-15 — Email Adapter (Outbound).
  describe("send by email (RM-15)", () => {
    it("renders no checkbox at all when email isn't configured (the default today)", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.queryByText("detail.sendByEmailLabel")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("renders the checkbox once email is configured", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useEmailChannelStatusQuery).mockReturnValue(
        queryResult({ data: { configured: true }, isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.getByRole("checkbox", { name: "detail.sendByEmailLabel" })).toBeInTheDocument();
    });

    it("sends via the Live Chat endpoint by default even when email is configured (checkbox unchecked)", async () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useEmailChannelStatusQuery).mockReturnValue(
        queryResult({ data: { configured: true }, isSuccess: true }) as never,
      );
      const liveChatMutateAsync = vi.fn().mockResolvedValue(myOwnMessage);
      const emailMutateAsync = vi.fn().mockResolvedValue(myOwnMessage);
      vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: liveChatMutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);
      vi.mocked(useCreateTicketEmailMessageMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: emailMutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketChatCard ticketId="ticket-1" />);
      fireEvent.change(screen.getByLabelText("detail.chatPlaceholder"), {
        target: { value: "How can I help?" },
      });
      fireEvent.click(screen.getByText("detail.chatSend"));

      await vi.waitFor(() => {
        expect(liveChatMutateAsync).toHaveBeenCalledWith({ body: "How can I help?" });
      });
      expect(emailMutateAsync).not.toHaveBeenCalled();
    });

    it("sends via the email endpoint instead once the checkbox is checked", async () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useEmailChannelStatusQuery).mockReturnValue(
        queryResult({ data: { configured: true }, isSuccess: true }) as never,
      );
      const liveChatMutateAsync = vi.fn().mockResolvedValue(myOwnMessage);
      const emailMutateAsync = vi.fn().mockResolvedValue(myOwnMessage);
      vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: liveChatMutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);
      vi.mocked(useCreateTicketEmailMessageMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: emailMutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketChatCard ticketId="ticket-1" />);
      fireEvent.click(screen.getByRole("checkbox", { name: "detail.sendByEmailLabel" }));
      fireEvent.change(screen.getByLabelText("detail.chatPlaceholder"), {
        target: { value: "Your invoice is attached." },
      });
      fireEvent.click(screen.getByText("detail.chatSend"));

      await vi.waitFor(() => {
        expect(emailMutateAsync).toHaveBeenCalledWith({ body: "Your invoice is attached." });
      });
      expect(liveChatMutateAsync).not.toHaveBeenCalled();
    });

    it("shows the inline error message when the email send is rejected", async () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useEmailChannelStatusQuery).mockReturnValue(
        queryResult({ data: { configured: true }, isSuccess: true }) as never,
      );
      vi.mocked(useCreateTicketEmailMessageMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockRejectedValue(new ApiError("This ticket has no contact to email.", 400)),
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketChatCard ticketId="ticket-1" />);
      fireEvent.click(screen.getByRole("checkbox", { name: "detail.sendByEmailLabel" }));
      fireEvent.change(screen.getByLabelText("detail.chatPlaceholder"), {
        target: { value: "hello" },
      });
      fireEvent.click(screen.getByText("detail.chatSend"));

      await screen.findByText("This ticket has no contact to email.");
    });
  });

  // Story 91 — Communication/Channels: Quick Replies.
  describe("quick-reply picker (Story 91)", () => {
    const quickReply = {
      id: "quick-reply-1",
      title: "Password reset",
      body: "You can reset your password from the login page.",
      isActive: true,
    };

    it("does not render a picker when there are no active quick replies", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useQuickRepliesQuery).mockReturnValue(
        queryResult({ data: [{ ...quickReply, isActive: false }], isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("inserts the selected quick reply's body into an empty draft", async () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useQuickRepliesQuery).mockReturnValue(
        queryResult({ data: [quickReply], isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      fireEvent.click(screen.getByRole("combobox"));
      fireEvent.click(await screen.findByRole("option", { name: "Password reset" }));

      expect(screen.getByLabelText("detail.chatPlaceholder")).toHaveValue(quickReply.body);
    });

    it("appends the selected quick reply's body to existing draft text rather than overwriting it", async () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useQuickRepliesQuery).mockReturnValue(
        queryResult({ data: [quickReply], isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      const textarea = screen.getByLabelText("detail.chatPlaceholder");
      fireEvent.change(textarea, { target: { value: "Thanks for reaching out." } });

      fireEvent.click(screen.getByRole("combobox"));
      fireEvent.click(await screen.findByRole("option", { name: "Password reset" }));

      expect(textarea).toHaveValue(`Thanks for reaching out.\n\n${quickReply.body}`);
    });
  });
});
