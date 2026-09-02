import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketDetailView } from "./ticket-detail-view";
import {
  useMyTicketCsatQuery,
  useMyTicketHistoryQuery,
  useMyTicketMessagesQuery,
  useMyTicketQuery,
  useSendMyTicketMessageMutation,
  useSubmitMyTicketCsatMutation,
} from "@/hooks/use-portal-tickets";
import {
  useMyTicketAttachmentsQuery,
  useUploadMyTicketAttachmentMutation,
} from "@/hooks/use-portal-attachments";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-tickets", () => ({
  useMyTicketQuery: vi.fn(),
  useMyTicketHistoryQuery: vi.fn(),
  useMyTicketCsatQuery: vi.fn(),
  useSubmitMyTicketCsatMutation: vi.fn(),
  useMyTicketMessagesQuery: vi.fn(),
  useSendMyTicketMessageMutation: vi.fn(),
}));

// Story 103 — `TicketAttachmentsCard`'s own behavior is covered by its
// dedicated spec; this file only needs its two hooks swapped out so no
// real `useQuery`/`useMutation` call ever runs without a `QueryClient`.
vi.mock("@/hooks/use-portal-attachments", () => ({
  useMyTicketAttachmentsQuery: vi.fn(),
  useUploadMyTicketAttachmentMutation: vi.fn(),
}));

// Story 78 — this app's first realtime subscription; its own behavior is
// covered by its dedicated spec, so this file only needs a no-op mock.
vi.mock("@/hooks/use-portal-ticket-realtime", () => ({
  usePortalTicketRealtime: vi.fn(),
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

const baseTicket = {
  id: "ticket-1",
  subject: "Cannot log in",
  category: "account",
  priority: "MEDIUM",
  status: "OPEN",
  customerId: "customer-1",
  contactId: "contact-1",
  departmentId: null,
  assignedToUserId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("TicketDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyTicketHistoryQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useMyTicketCsatQuery).mockReturnValue(
      queryResult({ data: undefined, isSuccess: true }) as never,
    );
    vi.mocked(useSubmitMyTicketCsatMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useSendMyTicketMessageMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "message-new" }),
      isPending: false,
    } as never);
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadMyTicketAttachmentMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it("renders a loading skeleton while the ticket query is pending", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TicketDetailView ticketId="ticket-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  // Story 97 — Loading & Skeleton UX.
  it("shapes the loading skeleton to the real header/chat/history layout, not two generic blocks", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TicketDetailView ticketId="ticket-1" />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
  });

  it("renders a not-found message when the ticket lookup 404s", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<TicketDetailView ticketId="missing" />);

    expect(screen.getByText("detail.notFound")).toBeInTheDocument();
  });

  it("renders a generic load error for a non-404 failure", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.loadError")).toBeInTheDocument();
  });

  it("renders the ticket's subject, status, priority, and category", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("Cannot log in")).toBeInTheDocument();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText("MEDIUM")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
  });

  // Story 98 — Design System & Visual Polish.
  it("gives the status pill a visually distinct color, mirroring apps/web's own status color semantics", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("OPEN")).toHaveClass("bg-amber-100");
  });

  it("renders the empty history message when there are no entries", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.historyEmpty")).toBeInTheDocument();
  });

  it("renders history entries when present", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );
    vi.mocked(useMyTicketHistoryQuery).mockReturnValue(
      queryResult({
        data: [
          {
            id: "history-1",
            eventType: "ticket.created",
            actorUserId: null,
            snapshot: {},
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("ticket.created")).toBeInTheDocument();
  });

  it("renders an inline error when history fails to load", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );
    vi.mocked(useMyTicketHistoryQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.historyError")).toBeInTheDocument();
  });

  // Story 55 — Customer Portal — Ticket CSAT / Feedback.
  it("does not render the feedback section for an OPEN ticket", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.queryByText("detail.csatHeading")).not.toBeInTheDocument();
  });

  it("renders the feedback form for a RESOLVED ticket with no response yet", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: { ...baseTicket, status: "RESOLVED" }, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.csatHeading")).toBeInTheDocument();
    expect(screen.getByText("detail.csatSubmit")).toBeInTheDocument();
  });

  it("renders the feedback form for a CLOSED ticket with no response yet", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: { ...baseTicket, status: "CLOSED" }, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.csatHeading")).toBeInTheDocument();
    expect(screen.getByText("detail.csatSubmit")).toBeInTheDocument();
  });

  it("renders the read-only summary once a response exists, not the form", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: { ...baseTicket, status: "RESOLVED" }, isSuccess: true }) as never,
    );
    vi.mocked(useMyTicketCsatQuery).mockReturnValue(
      queryResult({
        data: {
          id: "csat-1",
          ticketId: "ticket-1",
          submittedByContactId: "contact-1",
          rating: 4,
          comment: "Great support",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("Great support")).toBeInTheDocument();
    expect(screen.queryByText("detail.csatSubmit")).not.toBeInTheDocument();
  });

  it("disables the submit button until a rating is chosen", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: { ...baseTicket, status: "RESOLVED" }, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.csatSubmit").closest("button")).toBeDisabled();
  });
});
