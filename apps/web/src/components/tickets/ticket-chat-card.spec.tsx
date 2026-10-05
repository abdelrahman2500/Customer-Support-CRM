import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketChatCard } from "./ticket-chat-card";
import {
  useCreateTicketEmailMessageMutation,
  useCreateTicketMessageMutation,
  useEmailChannelStatusQuery,
  useTicketMessagesQuery,
} from "@/hooks/use-ticket-messages";
import {
  useCreateTicketNoteMutation,
  useCurrentUserQuery,
  useTicketEscalationsQuery,
  useTicketHistoryQuery,
  useTicketNotesQuery,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useQuickRepliesQuery } from "@/hooks/use-quick-replies";
import { ApiError } from "@/lib/api";

// Story 206 — switchable, so one case can read the page as Arabic (RTL).
const route = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: route.locale }),
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
  // Story 207 — the composer's Internal note mode.
  useCreateTicketNoteMutation: vi.fn(),
  // Story 206 — the timeline's other sources.
  useTicketNotesQuery: vi.fn(),
  useTicketHistoryQuery: vi.fn(),
  useTicketEscalationsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-quick-replies", () => ({
  useQuickRepliesQuery: vi.fn(),
}));

/** Story 207 (RD-3.7, recon A11Y-09) — the reply field is named by its own
 * label now, not by its placeholder; it is the same field as before. */
function replyBox() {
  return screen.getByRole("textbox", { name: "detail.composerReplyLabel" });
}

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
    route.locale = "en";
    // Story 207 — drafts persist per ticket for the session; start clean.
    window.sessionStorage.clear();
    vi.mocked(useCreateTicketNoteMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "note-new" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
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
    // Story 206 — no notes, history or escalations unless a test adds them,
    // so every message-only case above reads exactly as it always has.
    vi.mocked(useTicketNotesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useTicketHistoryQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useTicketEscalationsQuery).mockReturnValue(
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
    const textarea = replyBox();
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
    const textarea = replyBox();
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter" });
    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ body: "hello" });
    });
  });

  // Story 207 (RD-3.7, recon A11Y-09) — the field used to be disabled while
  // sending, which dropped the agent's focus; it now stays enabled and only
  // Send is disabled (still reading "Sending").
  it("keeps the field enabled while sending, with Send disabled and reading Sending", () => {
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

    expect(replyBox()).toBeEnabled();
    expect(screen.getByRole("button", { name: "detail.chatSending" })).toBeDisabled();
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
    fireEvent.change(replyBox(), {
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
    fireEvent.change(replyBox(), {
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
    fireEvent.change(replyBox(), {
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

      expect(screen.getByText("detail.chatDeliveryStatus.FAILED")).toHaveClass("text-danger-foreground");
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
      fireEvent.change(replyBox(), {
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
      fireEvent.change(replyBox(), {
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
      fireEvent.change(replyBox(), {
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

      expect(replyBox()).toHaveValue(quickReply.body);
    });

    it("appends the selected quick reply's body to existing draft text rather than overwriting it", async () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useQuickRepliesQuery).mockReturnValue(
        queryResult({ data: [quickReply], isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      const textarea = replyBox();
      fireEvent.change(textarea, { target: { value: "Thanks for reaching out." } });

      fireEvent.click(screen.getByRole("combobox"));
      fireEvent.click(await screen.findByRole("option", { name: "Password reset" }));

      expect(textarea).toHaveValue(`Thanks for reaching out.\n\n${quickReply.body}`);
    });
  });

  // Story 205 (RD-3.5, recon TW-03) — the conversation is a MessageThread.
  describe("conversation thread (Story 205)", () => {
    it("is a labelled log, so new messages are announced", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [customerMessage, myOwnMessage], isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      const log = screen.getByRole("log", { name: "detail.chatHeading" });
      expect(log).toHaveAttribute("aria-live", "polite");
      expect(log).toContainElement(screen.getByText(customerMessage.body));
    });

    it("dates each day of a multi-day thread, keeping one list item per message", () => {
      const nextDay = { ...colleagueMessage, id: "message-next-day", createdAt: "2024-01-03T10:00:00.000Z" };
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [customerMessage, nextDay], isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      const log = screen.getByRole("log");
      expect(log.querySelectorAll("p")).toHaveLength(2);
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("marks up each message time with its full date-time", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [customerMessage], isSuccess: true }) as never,
      );

      const { container } = render(<TicketChatCard ticketId="ticket-1" />);

      const time = container.querySelector("time")!;
      expect(time).toHaveAttribute("dateTime", customerMessage.createdAt);
      expect(time.getAttribute("title")).toBeTruthy();
    });
  });

  // Story 206 (RD-3.6, recon TW-04) — the unified timeline.
  describe("unified timeline (Story 206)", () => {
    const note = {
      id: "note-1",
      ticketId: "ticket-1",
      authorUserId: "agent-2",
      body: "Customer is on the legacy plan.",
      createdAt: "2024-01-01T09:00:30.000Z",
    };
    const created = {
      id: "history-1",
      eventType: "ticket.created",
      actorUserId: "agent-2",
      snapshot: {},
      createdAt: "2024-01-01T08:00:00.000Z",
    };
    const escalation = {
      id: "escalation-1",
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T09:01:30.000Z",
      escalatedAt: "2024-01-01T09:01:45.000Z",
    };

    function renderTimeline() {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [customerMessage, myOwnMessage, colleagueMessage], isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [note], isSuccess: true }) as never,
      );
      vi.mocked(useTicketHistoryQuery).mockReturnValue(
        queryResult({ data: [created], isSuccess: true }) as never,
      );
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: [escalation], isSuccess: true }) as never,
      );
      return render(<TicketChatCard ticketId="ticket-1" />);
    }

    function itemTexts() {
      return within(screen.getByRole("log"))
        .getAllByRole("listitem")
        .map((item) => item.textContent);
    }

    it("interleaves messages, notes, history and escalations in time order", () => {
      renderTimeline();

      const items = itemTexts();
      expect(items).toHaveLength(6);
      // 08:00 created · 09:00 customer · 09:00:30 note · 09:01 mine ·
      // 09:01:45 escalation · 09:02 colleague
      expect(items[0]).toContain("detail.historyEvent.created");
      expect(items[1]).toContain(customerMessage.body);
      expect(items[2]).toContain(note.body);
      expect(items[3]).toContain(myOwnMessage.body);
      expect(items[4]).toContain("detail.timelineEscalated");
      expect(items[5]).toContain(colleagueMessage.body);
    });

    it("never lets a note pass for a reply: own surface, lock icon and an Internal note label", () => {
      renderTimeline();

      const body = screen.getByText(note.body);
      expect(body).toHaveClass("bg-warning-subtle", "border-warning-border");
      const reply = screen.getByText(colleagueMessage.body);
      expect(reply).not.toHaveClass("bg-warning-subtle");

      const item = body.closest("li") as HTMLElement;
      expect(within(item).getByText("detail.internalNoteLabel")).toBeInTheDocument();
      expect(item.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      // The author is still named as before (Story 50), never "You".
      expect(within(item).getByText("Sam Colleague")).toBeInTheDocument();
    });

    it("names a history event's actor when the loaded users resolve it, and no one otherwise", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketHistoryQuery).mockReturnValue(
        queryResult({
          data: [
            created,
            { ...created, id: "history-2", eventType: "ticket.updated", actorUserId: null },
            { ...created, id: "history-3", eventType: "ticket.recategorized", actorUserId: "gone" },
          ],
          isSuccess: true,
        }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      const [first, second, third] = within(screen.getByRole("log")).getAllByRole("listitem");
      expect(first).toHaveTextContent("detail.historyEvent.created");
      expect(within(first!).getByText("Sam Colleague")).toBeInTheDocument();
      expect(second).toHaveTextContent("detail.historyEvent.updated");
      expect(third).toHaveTextContent("detail.historyEvent.recategorized");
      expect(third).not.toHaveTextContent("gone");
      for (const item of [second!, third!]) {
        expect(within(item).queryByText("Sam Colleague")).not.toBeInTheDocument();
      }
    });

    it("labels an escalation with its target and keeps the raw-value fallback", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({
          data: [escalation, { ...escalation, id: "escalation-2", targetType: "unknown" }],
          isSuccess: true,
        }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.getAllByText("detail.timelineEscalated")).toHaveLength(2);
      expect(screen.getByText("escalations.targetType.response")).toBeInTheDocument();
      expect(screen.getByText("unknown")).toBeInTheDocument();
      const time = screen.getAllByText((_, element) => element?.tagName === "TIME")[0]!;
      expect(time).toHaveAttribute("dateTime", escalation.escalatedAt);
      expect(time).toHaveAttribute("title", new Date(escalation.escalatedAt).toLocaleString("en"));
    });

    it("filters by kind from the keyboard, with arrow keys", async () => {
      const user = userEvent.setup();
      renderTimeline();

      const tabs = screen.getByRole("tablist", { name: "detail.timelineFilterLabel" });
      const all = within(tabs).getByRole("tab", { name: "detail.timelineFilter.all" });
      expect(all).toHaveAttribute("aria-selected", "true");

      all.focus();
      await user.keyboard("{ArrowRight}");
      expect(within(tabs).getByRole("tab", { name: "detail.timelineFilter.conversation" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(itemTexts()).toHaveLength(3);
      expect(screen.queryByText(note.body)).not.toBeInTheDocument();

      await user.keyboard("{ArrowRight}");
      expect(itemTexts()).toEqual([expect.stringContaining(note.body)]);

      await user.keyboard("{ArrowRight}");
      const events = itemTexts();
      expect(events).toHaveLength(2);
      expect(events[0]).toContain("detail.historyEvent.created");
      expect(events[1]).toContain("detail.timelineEscalated");
      expect(screen.queryByText(customerMessage.body)).not.toBeInTheDocument();
    });

    it("follows the reading direction: in Arabic, ArrowLeft moves to the next filter", async () => {
      const user = userEvent.setup();
      route.locale = "ar";
      renderTimeline();

      const tabs = screen.getByRole("tablist", { name: "detail.timelineFilterLabel" });
      within(tabs).getByRole("tab", { name: "detail.timelineFilter.all" }).focus();
      await user.keyboard("{ArrowLeft}");

      expect(
        within(tabs).getByRole("tab", { name: "detail.timelineFilter.conversation" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("shows each filter's own empty message", async () => {
      const user = userEvent.setup();
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [customerMessage], isSuccess: true }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);
      // All has a message, so nothing reads as empty there.
      expect(screen.queryByText("detail.chatEmpty")).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "detail.timelineFilter.notes" }));
      expect(screen.getByText("detail.notesEmpty")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "detail.timelineFilter.events" }));
      expect(screen.getByText("detail.historyEmpty")).toBeInTheDocument();
      expect(screen.getByText("detail.escalationsEmpty")).toBeInTheDocument();
    });

    it("keeps the rest of the timeline when one source fails, with that source's own error", async () => {
      const user = userEvent.setup();
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [customerMessage], isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<TicketChatCard ticketId="ticket-1" />);

      expect(screen.getByText("detail.notesError")).toBeInTheDocument();
      expect(screen.getByText(customerMessage.body)).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "detail.timelineFilter.conversation" }));
      expect(screen.queryByText("detail.notesError")).not.toBeInTheDocument();
    });

    it("waits for every source before drawing the timeline", () => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [customerMessage], isSuccess: true }) as never,
      );
      vi.mocked(useTicketHistoryQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

      const { container } = render(<TicketChatCard ticketId="ticket-1" />);

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
      expect(screen.queryByRole("log")).not.toBeInTheDocument();
    });
  });

  // Story 207 (RD-3.7, recon TW-04/A11Y-05/A11Y-09) — one composer, two modes.
  describe("composer v2 (Story 207)", () => {
    beforeEach(() => {
      vi.mocked(useTicketMessagesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
    });

    function noteBox() {
      return screen.getByRole("combobox", { name: "detail.composerNoteLabel" });
    }

    async function noteMode(user = userEvent.setup()) {
      await user.click(screen.getByRole("tab", { name: "detail.internalNoteLabel" }));
    }

    it("offers Reply and Internal note as named modes, Reply first, with one field at a time", async () => {
      render(<TicketChatCard ticketId="ticket-1" />);

      const modes = screen.getByRole("tablist", { name: "detail.composerModeLabel" });
      const [reply, note] = within(modes).getAllByRole("tab");
      expect(reply).toHaveTextContent("detail.composerModeReply");
      expect(reply).toHaveAttribute("aria-selected", "true");
      expect(note).toHaveTextContent("detail.internalNoteLabel");
      expect(replyBox()).toHaveAttribute("placeholder", "detail.chatPlaceholder");

      await noteMode();
      expect(note).toHaveAttribute("aria-selected", "true");
      expect(noteBox()).toHaveAttribute("placeholder", "detail.notesPlaceholder");
      expect(noteBox()).toHaveClass("bg-warning-subtle");
      expect(screen.getByText("detail.composerNoteHint")).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "detail.composerReplyLabel" })).not.toBeInTheDocument();
    });

    it("never sends a reply on an Enter that confirms an IME composition", () => {
      const mutateAsync = vi.fn().mockResolvedValue(myOwnMessage);
      vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);
      render(<TicketChatCard ticketId="ticket-1" />);

      fireEvent.change(replyBox(), { target: { value: "مرحبا" } });
      fireEvent.compositionStart(replyBox());
      fireEvent.keyDown(replyBox(), { key: "Enter", isComposing: true });
      expect(mutateAsync).not.toHaveBeenCalled();

      fireEvent.compositionEnd(replyBox());
      fireEvent.keyDown(replyBox(), { key: "Enter" });
      expect(mutateAsync).toHaveBeenCalledWith({ body: "مرحبا" });
    });

    it("keeps focus in the field after sending with the button", async () => {
      render(<TicketChatCard ticketId="ticket-1" />);

      fireEvent.change(replyBox(), { target: { value: "On it." } });
      const send = screen.getByRole("button", { name: "detail.chatSend" });
      send.focus();
      await act(async () => {
        fireEvent.click(send);
      });

      await vi.waitFor(() => expect(replyBox()).toHaveValue(""));
      expect(replyBox()).toHaveFocus();
    });

    it("sends a note with the notes mutation, exactly { body }, and clears it", async () => {
      const user = userEvent.setup();
      const noteMutateAsync = vi.fn().mockResolvedValue({ id: "note-new" });
      const replyMutateAsync = vi.fn();
      vi.mocked(useCreateTicketNoteMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: noteMutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);
      vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: replyMutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);
      render(<TicketChatCard ticketId="ticket-1" />);

      await noteMode(user);
      fireEvent.change(noteBox(), { target: { value: "  Checked the logs.  " } });
      fireEvent.keyDown(noteBox(), { key: "Enter" });

      await vi.waitFor(() => expect(noteMutateAsync).toHaveBeenCalledWith({ body: "Checked the logs." }));
      expect(replyMutateAsync).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(noteBox()).toHaveValue(""));
    });

    it("shows the note's own error copy when adding a note fails", async () => {
      const user = userEvent.setup();
      vi.mocked(useCreateTicketNoteMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockRejectedValue(new ApiError("internals", 500)),
        isPending: false,
        isError: false,
        error: null,
      } as never);
      render(<TicketChatCard ticketId="ticket-1" />);

      await noteMode(user);
      fireEvent.change(noteBox(), { target: { value: "A note" } });
      fireEvent.click(screen.getByRole("button", { name: "detail.notesSubmit" }));

      expect(await screen.findByText("detail.notesCreateFailed")).toBeInTheDocument();
      expect(noteBox()).toHaveValue("A note");
    });

    it("picks a mention from the keyboard: ArrowDown, then Enter", async () => {
      const user = userEvent.setup();
      vi.mocked(useUsersQuery).mockReturnValue(
        queryResult({
          data: [
            { id: "u1", fullName: "Jane Doe" },
            { id: "u2", fullName: "Janet Roe" },
          ],
          isSuccess: true,
        }) as never,
      );
      render(<TicketChatCard ticketId="ticket-1" />);

      await noteMode(user);
      fireEvent.change(noteBox(), { target: { value: "Ask @Jan" } });
      expect(noteBox()).toHaveAttribute("aria-expanded", "true");
      const listbox = screen.getByRole("listbox", { name: "detail.mentionSuggestions" });
      expect(within(listbox).getAllByRole("option")).toHaveLength(2);

      fireEvent.keyDown(noteBox(), { key: "ArrowDown" });
      fireEvent.keyDown(noteBox(), { key: "Enter" });

      expect(noteBox()).toHaveValue("Ask @Janet Roe ");
      expect(noteBox()).toHaveAttribute("aria-expanded", "false");
    });

    it("keeps each mode's draft for the session, per ticket, and clears it on send", async () => {
      const user = userEvent.setup();
      const { unmount } = render(<TicketChatCard ticketId="ticket-1" />);

      fireEvent.change(replyBox(), { target: { value: "Half a reply" } });
      await noteMode(user);
      fireEvent.change(noteBox(), { target: { value: "Half a note" } });
      unmount();

      render(<TicketChatCard ticketId="ticket-1" />);
      expect(replyBox()).toHaveValue("Half a reply");
      await noteMode(user);
      expect(noteBox()).toHaveValue("Half a note");

      fireEvent.keyDown(noteBox(), { key: "Enter" });
      await vi.waitFor(() => expect(noteBox()).toHaveValue(""));
      expect(window.sessionStorage.getItem("crm.ticketDraft.ticket-1.note")).toBeNull();
      expect(window.sessionStorage.getItem("crm.ticketDraft.ticket-1.reply")).toBe("Half a reply");
    });

    it("does not carry a draft to another ticket", () => {
      window.sessionStorage.setItem("crm.ticketDraft.ticket-1.reply", "For ticket one");

      render(<TicketChatCard ticketId="ticket-2" />);

      expect(replyBox()).toHaveValue("");
    });

    it("shows the Enter and Shift+Enter hint", () => {
      render(<TicketChatCard ticketId="ticket-1" />);

      const keys = screen.getAllByText((_, element) => element?.tagName === "KBD");
      expect(keys.map((key) => key.textContent)).toEqual(["Enter", "Shift", "Enter"]);
      expect(screen.getByText(/detail\.composerHintSend/)).toBeInTheDocument();
    });

    it("follows the reading direction between modes: in Arabic, ArrowLeft moves to Internal note", async () => {
      const user = userEvent.setup();
      route.locale = "ar";
      render(<TicketChatCard ticketId="ticket-1" />);

      screen.getByRole("tab", { name: "detail.composerModeReply" }).focus();
      await user.keyboard("{ArrowLeft}");

      expect(screen.getByRole("tab", { name: "detail.internalNoteLabel" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });
});
