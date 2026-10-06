import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketDetailView } from "./ticket-detail-view";
import {
  useCreateTicketNoteMutation,
  useCurrentUserQuery,
  useCustomerQuery,
  useCustomersQuery,
  useDepartmentsQuery,
  useTicketCsatQuery,
  useTicketEscalationsQuery,
  useTicketHistoryQuery,
  useTicketNotesQuery,
  useTicketQuery,
  useTicketSlaTargetQuery,
  useTicketsQuery,
  useUpdateTicketMutation,
  useHoldTicketMutation,
  useResumeTicketMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import { useAttachmentsQuery, useUploadAttachmentMutation } from "@/hooks/use-attachments";
import {
  useCreateTicketEmailMessageMutation,
  useCreateTicketMessageMutation,
  useEmailChannelStatusQuery,
  useTicketMessagesQuery,
} from "@/hooks/use-ticket-messages";
import { useQuickRepliesQuery } from "@/hooks/use-quick-replies";
import { useSubmitAiOperationMutation, useTicketAiResultQuery } from "@/hooks/use-ticket-ai";
import {
  useCreateTicketKbReferenceMutation,
  useDeleteTicketKbReferenceMutation,
  useTicketKbReferencesQuery,
} from "@/hooks/use-ticket-kb-references";
import { usePublishedArticleSearchQuery } from "@/hooks/use-knowledge-base";
import { useAgentPresence } from "@/hooks/use-agent-presence";
import { getAttachmentDownloadUrl } from "@/lib/attachments-api";
import { ApiError } from "@/lib/api";
import { showSuccessToast } from "@crm/ui";

// Story S-2 — `showSuccessToast` now lives in `@crm/ui`, which also exports
// every primitive these components render. A whole-module factory would
// replace those too, so this spreads the real module and overrides only
// the one function under assertion.
vi.mock("@crm/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@crm/ui")>()),
  showSuccessToast: vi.fn(),
}));

const mockedShowSuccessToast = vi.mocked(showSuccessToast);

let searchParamsString = "";
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn() }),
  // Story 220 — the board/list context a ticket was opened from.
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

// Story 220 — the prev/next column query (none in these tests' context).
vi.mock("@/hooks/use-ticket-board", () => ({
  useTicketBoardColumnQuery: () => ({ data: undefined }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-ticket-realtime", () => ({ useTicketRealtime: vi.fn() }));

vi.mock("@/hooks/use-tickets", () => ({
  useTicketQuery: vi.fn(),
  useTicketHistoryQuery: vi.fn(),
  useTicketSlaTargetQuery: vi.fn(),
  useTicketEscalationsQuery: vi.fn(),
  useTicketNotesQuery: vi.fn(),
  useTicketCsatQuery: vi.fn(),
  useCustomersQuery: vi.fn(),
  useUsersQuery: vi.fn(),
  useCurrentUserQuery: vi.fn(),
  useDepartmentsQuery: vi.fn(),
  useUpdateTicketMutation: vi.fn(),
  // RM-25 — SLA Pause/Resume.
  useHoldTicketMutation: vi.fn(),
  useResumeTicketMutation: vi.fn(),
  useCreateTicketNoteMutation: vi.fn(),
  // RM-04 — `CustomerContextPanel`'s own two hooks; its behavior is
  // covered by its own dedicated describe block below (mirrors this
  // file's own precedent for TicketChatCard/TicketAiCard's hooks — see
  // their mocks further down).
  useCustomerQuery: vi.fn(),
  useTicketsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-ticket-categories", () => ({
  useTicketCategoriesQuery: vi.fn(),
}));

vi.mock("@/hooks/use-attachments", () => ({
  useAttachmentsQuery: vi.fn(),
  useUploadAttachmentMutation: vi.fn(),
}));

// Story 78 — TicketChatCard's own hooks; its behavior is covered in its own
// dedicated spec (mirrors AttachmentsCard's own precedent), so this file
// only needs enough of a mock for TicketDetailView to render it cleanly.
// RM-15 adds two more (send-by-email + its own config-status check) for
// the exact same reason.
vi.mock("@/hooks/use-ticket-messages", () => ({
  useTicketMessagesQuery: vi.fn(),
  useCreateTicketMessageMutation: vi.fn(),
  useCreateTicketEmailMessageMutation: vi.fn(),
  useEmailChannelStatusQuery: vi.fn(),
}));

// Story 91 — TicketChatCard's ChatComposer also reads this hook directly;
// mirrors the `use-ticket-messages` mock above for the same reason.
vi.mock("@/hooks/use-quick-replies", () => ({
  useQuickRepliesQuery: vi.fn(),
}));

// Story 79 — TicketAiCard's own hooks; its behavior is covered in its own
// dedicated spec (mirrors TicketChatCard's own precedent above), so this
// file only needs enough of a mock for TicketDetailView to render it
// cleanly.
vi.mock("@/hooks/use-ticket-ai", () => ({
  useTicketAiResultQuery: vi.fn(),
  useSubmitAiOperationMutation: vi.fn(),
}));

vi.mock("@/lib/attachments-api", () => ({
  getAttachmentDownloadUrl: vi.fn(),
}));

// RM-05 — `TicketKbReferencesCard`'s own hooks; its behavior is covered by
// its own dedicated describe block below (mirrors this file's own
// precedent for TicketChatCard/TicketAiCard's hooks above).
vi.mock("@/hooks/use-ticket-kb-references", () => ({
  useTicketKbReferencesQuery: vi.fn(),
  useCreateTicketKbReferenceMutation: vi.fn(),
  useDeleteTicketKbReferenceMutation: vi.fn(),
}));

vi.mock("@/hooks/use-knowledge-base", () => ({
  usePublishedArticleSearchQuery: vi.fn(),
}));

// RM-06 — Workspace Presence.
vi.mock("@/hooks/use-agent-presence", () => ({
  useAgentPresence: vi.fn(),
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

/** Story 206 (RD-3.6) — notes, history and SLA escalations live in the
 * conversation timeline now, not in cards of their own; this shows one
 * kind, the way an agent would, through the timeline's filter. */
async function showTimeline(filter: "notes" | "events") {
  await userEvent
    .setup()
    .click(screen.getByRole("tab", { name: `detail.timelineFilter.${filter}` }));
}

/** Story 207 (RD-3.7, recon TW-04) — notes are written in the conversation
 * composer's Internal note mode now, not in a form of their own; this picks
 * that mode (Radix tabs activate on mouse down). */
function noteMode() {
  fireEvent.mouseDown(screen.getByRole("tab", { name: "detail.internalNoteLabel" }));
}

const baseTicket = {
  id: "ticket-1",
  subject: "Cannot log in",
  categoryId: "category-1",
  categoryName: "billing",
  // Story S-8d — resolved by the API alongside `categoryName`, rather than
  // looked up client-side from the whole customer list.
  customerName: "Acme Inc.",
  priority: "HIGH",
  status: "OPEN",
  customerId: "customer-1",
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
};

describe("TicketDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Story 207 — composer drafts persist per ticket for the session.
    window.sessionStorage.clear();
    vi.mocked(useCustomersQuery).mockReturnValue(
      queryResult({
        data: [{ id: "customer-1", displayName: "Acme Inc." }],
        isSuccess: true,
      }) as never,
    );
    vi.mocked(useUsersQuery).mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    vi.mocked(useDepartmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useTicketCategoriesQuery).mockReturnValue(
      queryResult({
        data: [{ id: "category-1", branchId: "branch-1", name: "billing", isActive: true }],
        isSuccess: true,
      }) as never,
    );
    vi.mocked(useTicketHistoryQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
      queryResult({ data: null, isSuccess: true }) as never,
    );
    vi.mocked(useTicketEscalationsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useTicketNotesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useTicketCsatQuery).mockReturnValue(
      queryResult({ data: undefined, isSuccess: true }) as never,
    );
    vi.mocked(useUpdateTicketMutation).mockReturnValue({
      mutate: vi.fn(),
      isError: false,
      error: null,
    } as never);
    // RM-25 — SLA Pause/Resume.
    vi.mocked(useHoldTicketMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useResumeTicketMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useCreateTicketNoteMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "note-new" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadAttachmentMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "attachment-new" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useCurrentUserQuery).mockReturnValue(
      queryResult({ data: { id: "agent-1" }, isSuccess: true }) as never,
    );
    vi.mocked(useTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "message-new" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    // RM-15 — defaults to "not configured", mirroring
    // ticket-chat-card.spec.tsx's own default: this file only needs
    // TicketChatCard to render cleanly, not to exercise its email flow.
    vi.mocked(useCreateTicketEmailMessageMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "message-new" }),
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
    vi.mocked(useTicketAiResultQuery).mockReturnValue(
      queryResult({ data: undefined, isSuccess: false }) as never,
    );
    vi.mocked(useSubmitAiOperationMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "log-new", outcome: "PENDING" }),
      isPending: false,
    } as never);
    // RM-04 — `CustomerContextPanel`'s own two queries; default to an
    // empty, successful result so pre-existing tests (which only assert
    // on their own card) are unaffected.
    vi.mocked(useTicketsQuery).mockReturnValue(
      queryResult({
        data: { items: [], total: 0, page: 1, pageSize: 5, totalPages: 1 },
        isSuccess: true,
      }) as never,
    );
    vi.mocked(useCustomerQuery).mockReturnValue(
      queryResult({ data: { id: "customer-1", contacts: [] }, isSuccess: true }) as never,
    );
    // RM-05 — `TicketKbReferencesCard`'s own hooks; default to an empty,
    // successful result so pre-existing tests are unaffected.
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useCreateTicketKbReferenceMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "reference-new" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useDeleteTicketKbReferenceMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "reference-1" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(usePublishedArticleSearchQuery).mockReturnValue(queryResult({}) as never);
    // RM-06 — default to an empty presence map so pre-existing tests are
    // unaffected; the dedicated describe block below overrides it.
    vi.mocked(useAgentPresence).mockReturnValue({});
  });

  it("renders the ticket subject and resolved customer name", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    // Story 156 — the subject is a visible heading again, editable behind
    // an explicit Edit affordance rather than being a permanent input.
    expect(screen.getByRole("heading", { level: 1, name: "Cannot log in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "detail.subjectEdit" })).toBeInTheDocument();
    expect(screen.getByText(/Acme Inc\./)).toBeInTheDocument();
  });

  // Batch 3 (UX audit) — mirrors the portal's own equivalent link, which
  // this screen never had.
  it("renders a back-to-list link to the ticket list", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByRole("link", { name: /detail.backToList/ })).toHaveAttribute(
      "href",
      "/en/tickets",
    );
  });

  // NAV-2 — this page had no heading landmark at all (the subject is an
  // editable Input, not static text a plain <h1> could reuse).
  it("gives the page a level-1 heading landmark matching the ticket subject", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByRole("heading", { level: 1, name: "Cannot log in" })).toBeInTheDocument();
  });

  it("renders a not-found message when the ticket lookup 404s", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<TicketDetailView ticketId="missing" />);

    expect(screen.getByText("detail.notFound")).toBeInTheDocument();
  });

  it("renders a generic load error for a non-404 failure", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.loadError")).toBeInTheDocument();
  });

  it("renders an inline permission error when a mutation is rejected with 403", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );
    vi.mocked(useUpdateTicketMutation).mockReturnValue({
      mutate: vi.fn(),
      isError: true,
      error: new ApiError("Forbidden", 403),
    } as never);

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.actionForbidden")).toBeInTheDocument();
  });

  it("renders a generic action-failed message for a non-403 mutation error", () => {
    vi.mocked(useTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );
    vi.mocked(useUpdateTicketMutation).mockReturnValue({
      mutate: vi.fn(),
      isError: true,
      error: new ApiError("Server error", 500),
    } as never);

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.actionFailed")).toBeInTheDocument();
  });

  // Story 42 — subject reassignment.
  /**
   * Story 156 — the workspace layout. These assert the ORDER and the
   * presence of every section, because the restructure moved eleven blocks
   * and the risk is that one silently disappeared.
   */
  describe("workspace layout (Story 156)", () => {
    function renderLoaded() {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      render(<TicketDetailView ticketId="ticket-1" />);
    }

    it("keeps every section that existed before the restructure", () => {
      renderLoaded();

      for (const heading of ["detail.slaHeading", "detail.csatHeading"]) {
        expect(screen.getByText(heading)).toBeInTheDocument();
      }
      // Story 206 (RD-3.6) — escalations, history and notes are in the
      // conversation timeline now, each reachable through its filter.
      for (const filter of ["notes", "events"]) {
        expect(
          screen.getByRole("tab", { name: `detail.timelineFilter.${filter}` }),
        ).toBeInTheDocument();
      }
    });

    it("puts the conversation ahead of the read-mostly sections in the DOM", () => {
      renderLoaded();

      // The conversation is the agent's primary surface; it used to be the
      // fifth block on the page, after the metadata grid. Queried by its own
      // heading rather than a test-only attribute added to production code.
      // Story 206 (RD-3.6) — History is part of the conversation timeline
      // now, so the read-mostly section compared against is CSAT.
      const chat = screen.getByText("detail.chatHeading");
      const csat = screen.getByText("detail.csatHeading");
      expect(chat.compareDocumentPosition(csat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("gives the page exactly one h1, carrying the subject", () => {
      renderLoaded();

      const headings = screen.getAllByRole("heading", { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent("Cannot log in");
    });
  });

  /**
   * Phase 3 guard (Story 201, RD-3.1 — extended by every Phase 3 Story). The
   * ticket workspace is being restructured over fourteen Stories; this pins
   * every section and every control that exists today, so a restructure can
   * move them but never silently drop one.
   */
  describe("section survival (Phase 3 guard)", () => {
    function renderWithSla() {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      // A live SLA target, so the hold control (rendered only then) is present.
      vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
        queryResult({
          data: {
            responseTargetAt: "2999-01-01T00:00:00.000Z",
            resolutionTargetAt: "2999-01-02T00:00:00.000Z",
          },
          isSuccess: true,
        }) as never,
      );
      return render(<TicketDetailView ticketId="ticket-1" />);
    }

    it("keeps every section", () => {
      renderWithSla();

      for (const heading of [
        "detail.chatHeading",
        "detail.aiHeading",
        "detail.attachmentsHeading",
        "detail.kbReferencesHeading",
        "detail.contextPanelHeading",
        "detail.slaHeading",
        "detail.csatHeading",
      ]) {
        expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      }
      // Story 206 (RD-3.6) — the Notes, History and SLA Escalations cards
      // became the conversation timeline; every kind stays one filter away.
      const filters = screen.getByRole("tablist", { name: "detail.timelineFilterLabel" });
      for (const filter of ["all", "conversation", "notes", "events"]) {
        expect(
          within(filters).getByRole("tab", { name: `detail.timelineFilter.${filter}` }),
        ).toBeInTheDocument();
      }
    });

    it("keeps every control", () => {
      renderWithSla();

      expect(screen.getByRole("link", { name: "detail.backToList" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "detail.subjectEdit" })).toBeInTheDocument();
      for (const field of [
        "detail.status",
        "detail.priority",
        "detail.category",
        "detail.assignedAgent",
        "detail.department",
      ]) {
        expect(screen.getByRole("combobox", { name: field })).toBeInTheDocument();
      }
      expect(screen.getByRole("button", { name: "sla.placeOnHold" })).toBeInTheDocument();
      // Story 207 (RD-3.7) — one composer, two modes: the reply field and,
      // in Internal note mode, the note field (named by its own label now,
      // not its placeholder — A11Y-09).
      expect(screen.getByRole("textbox", { name: "detail.composerReplyLabel" })).toBeInTheDocument();
      noteMode();
      expect(screen.getByRole("combobox", { name: "detail.composerNoteLabel" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Acme Inc." })).toHaveAttribute(
        "href",
        "/en/customers/customer-1",
      );
    });

    // Story 201 — the state facts head the page, ahead of the conversation.
    it("shows status, priority, SLA and assignee in the header, before the conversation", () => {
      const { container } = renderWithSla();

      const header = container.querySelector("header")!;
      for (const term of [
        "list.columns.status",
        "list.columns.priority",
        "list.columns.sla",
        "list.columns.assignedAgent",
      ]) {
        expect(within(header).getByText(term).tagName).toBe("DT");
      }
      const chat = screen.getByRole("heading", { name: "detail.chatHeading" });
      expect(header.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe("subject editing (Story 42)", () => {
    it("commits a subject edit on blur when the value changed", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      const mutate = vi.fn();
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      // Story 156 — editing is an explicit mode now.
      fireEvent.click(screen.getByRole("button", { name: "detail.subjectEdit" }));
      const input = screen.getByDisplayValue("Cannot log in");
      fireEvent.change(input, { target: { value: "Cannot log in anymore" } });
      fireEvent.blur(input);

      // Batch 5 (UX audit) — the mutation now also carries an `onError`
      // revert callback (second arg), mirroring `SlaPolicyRow`'s pattern.
      expect(mutate).toHaveBeenCalledWith(
        { subject: "Cannot log in anymore" },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it("reverts the subject field to the server value when the mutation is rejected", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      const mutate = vi.fn();
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      // Story 156 — editing is an explicit mode now.
      fireEvent.click(screen.getByRole("button", { name: "detail.subjectEdit" }));
      const input = screen.getByDisplayValue("Cannot log in");
      fireEvent.change(input, { target: { value: "Cannot log in anymore" } });
      fireEvent.blur(input);

      const onError = mutate.mock.calls[0]![1].onError as () => void;
      act(() => onError());

      // Story 156 — blur also leaves edit mode, so the revert is observed by
      // reopening: the draft must have gone back to the server's value, not
      // kept the rejected keystrokes.
      fireEvent.click(screen.getByRole("button", { name: "detail.subjectEdit" }));
      expect(screen.getByDisplayValue("Cannot log in")).toBeInTheDocument();
    });

    it("does not commit the subject when blurred unchanged", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      const mutate = vi.fn();
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      // Story 156 — editing is an explicit mode now.
      fireEvent.click(screen.getByRole("button", { name: "detail.subjectEdit" }));
      fireEvent.blur(screen.getByDisplayValue("Cannot log in"));

      expect(mutate).not.toHaveBeenCalled();
    });

    it("does not commit an emptied (or whitespace-only) subject", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      const mutate = vi.fn();
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      // Story 156 — editing is an explicit mode now.
      fireEvent.click(screen.getByRole("button", { name: "detail.subjectEdit" }));
      const input = screen.getByDisplayValue("Cannot log in");
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.blur(input);

      expect(mutate).not.toHaveBeenCalled();
    });

    // Story 166 — both keyboard exits unmount the focused `Input`, which left
    // focus on `document.body`. The persistent "Edit" trigger is the successor.
    describe("focus restoration (Story 166)", () => {
      it("returns focus to the subject edit trigger after Escape", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate: vi.fn(),
        isError: false,
        error: null,
      } as never);

        render(<TicketDetailView ticketId="ticket-1" />);

        const trigger = screen.getByRole("button", { name: "detail.subjectEdit" });
        fireEvent.click(trigger);
        const input = screen.getByDisplayValue("Cannot log in");
        expect(document.activeElement).toBe(input);

        fireEvent.keyDown(input, { key: "Escape" });

        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: "detail.subjectEdit" }),
        );
      });

      it("returns focus to the subject edit trigger after Enter commits", () => {
        vi.mocked(useTicketQuery).mockReturnValue(
          queryResult({ data: baseTicket, isSuccess: true }) as never,
        );
        const mutate = vi.fn();
        vi.mocked(useUpdateTicketMutation).mockReturnValue({
          mutate,
          isError: false,
          error: null,
        } as never);

        render(<TicketDetailView ticketId="ticket-1" />);

        fireEvent.click(screen.getByRole("button", { name: "detail.subjectEdit" }));
        const input = screen.getByDisplayValue("Cannot log in");
        fireEvent.change(input, { target: { value: "Cannot log in anymore" } });
        fireEvent.keyDown(input, { key: "Enter" });

        // The existing Enter-commits-through-blur path is unchanged...
        expect(mutate).toHaveBeenCalledWith(
          { subject: "Cannot log in anymore" },
          expect.objectContaining({ onError: expect.any(Function) }),
        );
        // ...and focus no longer falls to the body.
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: "detail.subjectEdit" }),
        );
      });

      it("does not steal focus when the edit is left by focusing another control", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate: vi.fn(),
        isError: false,
        error: null,
      } as never);

        render(<TicketDetailView ticketId="ticket-1" />);

        fireEvent.click(screen.getByRole("button", { name: "detail.subjectEdit" }));
        const input = screen.getByDisplayValue("Cannot log in");

        // A mouse user clicking elsewhere: focus has already moved somewhere
        // valid by the time `onBlur` fires, so it must be left alone.
        const elsewhere = document.createElement("button");
        document.body.appendChild(elsewhere);
        elsewhere.focus();
        fireEvent.blur(input);

        expect(document.activeElement).toBe(elsewhere);
        elsewhere.remove();
      });

      it("does not focus the subject edit trigger on first render", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate: vi.fn(),
        isError: false,
        error: null,
      } as never);

        render(<TicketDetailView ticketId="ticket-1" />);

        expect(screen.getByRole("button", { name: "detail.subjectEdit" })).toBeInTheDocument();
        expect(document.activeElement).toBe(document.body);
      });
    });
  });

  // Story 42 — department reassignment.
  describe("department reassignment (Story 42)", () => {
    it("shows the no-department placeholder when the ticket has no department", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.noDepartment")).toBeInTheDocument();
    });

    it("renders the department select showing the ticket's current department name", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({
          data: { ...baseTicket, departmentId: "dept-1" },
          isSuccess: true,
        }) as never,
      );
      vi.mocked(useDepartmentsQuery).mockReturnValue(
        queryResult({
          data: [{ id: "dept-1", branchId: "branch-1", name: "Billing" }],
          isSuccess: true,
        }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("Billing")).toBeInTheDocument();
    });

    it("commits a department reassignment when a different department is selected", async () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useDepartmentsQuery).mockReturnValue(
        queryResult({
          data: [{ id: "dept-1", branchId: "branch-1", name: "Billing" }],
          isSuccess: true,
        }) as never,
      );
      const mutate = vi.fn();
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      fireEvent.click(screen.getByText("detail.noDepartment"));
      fireEvent.click(await screen.findByRole("option", { name: "Billing" }));

      // Batch 5 (UX audit) — carries an `onSuccess` toast now too, mirroring
      // the status/priority Selects (second arg).
      expect(mutate).toHaveBeenCalledWith(
        { departmentId: "dept-1" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    // Batch 5 (UX audit) — category/assignedAgent/department previously
    // committed silently while status/priority already confirmed
    // themselves; all five immediate-commit fields on this page now do.
    it("shows a translated success toast once the category-update mutation actually succeeds", async () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useTicketCategoriesQuery).mockReturnValue(
        queryResult({
          data: [{ id: "category-2", branchId: "branch-1", name: "Billing", isActive: true }],
          isSuccess: true,
        }) as never,
      );
      const mutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      });
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      fireEvent.click(screen.getByRole("combobox", { name: "detail.category" }));
      fireEvent.click(await screen.findByRole("option", { name: "Billing" }));

      expect(mockedShowSuccessToast).toHaveBeenCalledWith(
        'detail.categoryUpdateSuccess:{"category":"Billing"}',
      );
    });

    it("shows a translated success toast once the department-update mutation actually succeeds", async () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useDepartmentsQuery).mockReturnValue(
        queryResult({
          data: [{ id: "dept-1", branchId: "branch-1", name: "Billing" }],
          isSuccess: true,
        }) as never,
      );
      const mutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      });
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      fireEvent.click(screen.getByText("detail.noDepartment"));
      fireEvent.click(await screen.findByRole("option", { name: "Billing" }));

      expect(mockedShowSuccessToast).toHaveBeenCalledWith(
        'detail.departmentUpdateSuccess:{"department":"Billing"}',
      );
    });

    // Story 94 — success feedback.
    it("shows a translated success toast once the status-update mutation actually succeeds", async () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      const mutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      });
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      // Story 201 (RD-3.1) — the header now shows the same badge text, so the
      // click is scoped to the inspector's own trigger (the same element as before).
      fireEvent.click(
        within(screen.getByRole("combobox", { name: "detail.status" })).getByText("ticketStatus.OPEN"),
      );
      fireEvent.click(await screen.findByRole("option", { name: "ticketStatus.IN_PROGRESS" }));

      // Story 153 — the toast reports the localized label, not the raw enum.
      expect(mockedShowSuccessToast).toHaveBeenCalledWith(
        'detail.statusUpdateSuccess:{"status":"ticketStatus.IN_PROGRESS"}',
      );
    });

    it("shows a translated success toast once the priority-update mutation actually succeeds", async () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      const mutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      });
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      // Story 201 (RD-3.1) — the header now shows the same badge text, so the
      // click is scoped to the inspector's own trigger (the same element as before).
      fireEvent.click(
        within(screen.getByRole("combobox", { name: "detail.priority" })).getByText(
          "ticketPriority.HIGH",
        ),
      );
      fireEvent.click(await screen.findByRole("option", { name: "ticketPriority.URGENT" }));

      expect(mockedShowSuccessToast).toHaveBeenCalledWith(
        'detail.priorityUpdateSuccess:{"priority":"ticketPriority.URGENT"}',
      );
    });

    // A11Y-2 — each of these five Selects sat inside a `<label>` wrapping a
    // Radix trigger, which doesn't reliably associate for a `role="combobox"`
    // element across screen readers; each now carries its own `aria-label`
    // matching the visible label text next to it.
    it("gives the status, priority, category, assigned-agent and department pickers accessible names", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByRole("combobox", { name: "detail.status" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "detail.priority" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "detail.category" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "detail.assignedAgent" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "detail.department" })).toBeInTheDocument();
    });

    it("does not show a success toast when the status-update mutation is not yet successful", async () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      // A bare `vi.fn()` never invokes `onSuccess` — mirrors a real,
      // still-pending/rejected mutation.
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate: vi.fn(),
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      // Story 201 (RD-3.1) — the header now shows the same badge text, so the
      // click is scoped to the inspector's own trigger (the same element as before).
      fireEvent.click(
        within(screen.getByRole("combobox", { name: "detail.status" })).getByText("ticketStatus.OPEN"),
      );
      fireEvent.click(await screen.findByRole("option", { name: "ticketStatus.IN_PROGRESS" }));

      expect(mockedShowSuccessToast).not.toHaveBeenCalled();
    });

    it("renders an inline error when departments fail to load", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useDepartmentsQuery).mockReturnValue(queryResult({ isError: true }) as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.departmentLoadError")).toBeInTheDocument();
    });
  });

  // RM-06 — Workspace Presence. Extends Story 108's presence foundation
  // into the assignee picker.
  describe("assignee presence (RM-06)", () => {
    beforeEach(() => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useUsersQuery).mockReturnValue(
        queryResult({
          data: [
            { id: "user-1", fullName: "Jane Online" },
            { id: "user-2", fullName: "John Offline" },
          ],
          isSuccess: true,
        }) as never,
      );
    });

    it("passes every listed agent's id to useAgentPresence", () => {
      render(<TicketDetailView ticketId="ticket-1" />);

      expect(useAgentPresence).toHaveBeenCalledWith(["user-1", "user-2"]);
    });

    it("shows an online badge for an agent useAgentPresence reports online", async () => {
      vi.mocked(useAgentPresence).mockReturnValue({ "user-1": "online" });

      render(<TicketDetailView ticketId="ticket-1" />);
      fireEvent.click(screen.getByRole("combobox", { name: "detail.assignedAgent" }));

      const option = await screen.findByRole("option", { name: /Jane Online/ });
      expect(within(option).getByText("detail.presenceOnline")).toBeInTheDocument();
    });

    it("shows an offline badge for an agent useAgentPresence reports offline (or doesn't mention at all)", async () => {
      vi.mocked(useAgentPresence).mockReturnValue({ "user-1": "online" });

      render(<TicketDetailView ticketId="ticket-1" />);
      fireEvent.click(screen.getByRole("combobox", { name: "detail.assignedAgent" }));

      const option = await screen.findByRole("option", { name: /John Offline/ });
      expect(within(option).getByText("detail.presenceOffline")).toBeInTheDocument();
    });
  });

  // Story 49 — SLA escalations card.
  describe("SLA escalations card (Story 49)", () => {
    beforeEach(() => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
    });

    it("renders a skeleton while escalations are loading", () => {
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ isLoading: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      // Story 206 (RD-3.6) — escalations load as part of the conversation
      // timeline, which shows its skeleton until every source has loaded.
      const card = screen
        .getByRole("heading", { name: "detail.chatHeading" })
        .closest(".p-surface") as HTMLElement;
      expect(card.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders an inline error when escalations fail to load", () => {
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.escalationsError")).toBeInTheDocument();
    });

    it("renders the empty message when there are no escalations", async () => {
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);
      // Story 206 (RD-3.6) — notes, history and escalations moved into the
      // timeline; each kind's empty message shows under its own filter.
      await showTimeline("events");

      expect(screen.getByText("detail.escalationsEmpty")).toBeInTheDocument();
    });

    it("renders response and resolution escalations with human-readable labels and timestamps", () => {
      const escalations = [
        {
          id: "escalation-1",
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "response",
          targetAt: "2024-01-01T10:00:00.000Z",
          escalatedAt: "2024-01-01T10:05:00.000Z",
        },
        {
          id: "escalation-2",
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "resolution",
          targetAt: "2024-01-02T10:00:00.000Z",
          escalatedAt: "2024-01-02T10:05:00.000Z",
        },
      ];
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: escalations, isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      // The mocked next-intl echoes the translation key rather than a human
      // string, so the "human-readable label, not the raw string" assertion
      // is that the lookup key is used (differs from the raw `targetType`),
      // mirroring how every other `t(...)` call is asserted in this file.
      expect(screen.getByText("escalations.targetType.response")).toBeInTheDocument();
      expect(screen.getByText("escalations.targetType.resolution")).toBeInTheDocument();
      expect(screen.queryByText("response")).not.toBeInTheDocument();
      expect(screen.queryByText("resolution")).not.toBeInTheDocument();

      // Story 206 (RD-3.6) — in the day-grouped timeline the row shows the
      // time; the full date and time is the `<time>` element's title.
      for (const escalation of escalations) {
        expect(screen.getByTitle(new Date(escalation.escalatedAt).toLocaleString("en"))).toHaveAttribute(
          "dateTime",
          escalation.escalatedAt,
        );
      }
    });

    it("falls back to the raw targetType string for an unrecognized value, without crashing", () => {
      const escalations = [
        {
          id: "escalation-3",
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "unknown",
          targetAt: "2024-01-03T10:00:00.000Z",
          escalatedAt: "2024-01-03T10:05:00.000Z",
        },
      ];
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: escalations, isSuccess: true }) as never,
      );

      expect(() => render(<TicketDetailView ticketId="ticket-1" />)).not.toThrow();

      expect(screen.getByText("unknown")).toBeInTheDocument();
    });

    it("does not interfere with the SLA card's own rendering", async () => {
      vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
        queryResult({ data: null, isSuccess: true }) as never,
      );
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      // Story 201 (RD-3.1) — the header shows the SLA too, so this is scoped
      // to the SLA card it has always been about.
      const slaCard = screen
        .getByRole("heading", { name: "detail.slaHeading" })
        .closest(".p-surface") as HTMLElement;
      expect(within(slaCard).getByText("sla.none")).toBeInTheDocument();
      // Story 206 (RD-3.6) — notes, history and escalations moved into the
      // timeline; each kind's empty message shows under its own filter.
      await showTimeline("events");
      expect(screen.getByText("detail.escalationsEmpty")).toBeInTheDocument();
    });

    it("does not interfere with the History card's own rendering", async () => {
      vi.mocked(useTicketHistoryQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);
      // Story 206 (RD-3.6) — notes, history and escalations moved into the
      // timeline; each kind's empty message shows under its own filter.
      await showTimeline("events");

      expect(screen.getByText("detail.historyEmpty")).toBeInTheDocument();
      expect(screen.getByText("detail.escalationsEmpty")).toBeInTheDocument();
    });
  });

  // RM-25 — SLA Pause/Resume.
  describe("SLA pause/resume (RM-25)", () => {
    beforeEach(() => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
    });

    it("shows no hold/resume action when there is no SLA target", () => {
      vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
        queryResult({ data: null, isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.queryByText("sla.placeOnHold")).not.toBeInTheDocument();
      expect(screen.queryByText("sla.resume")).not.toBeInTheDocument();
    });

    it("shows a 'place on hold' action (not immediate — opens a confirmation dialog) for an on-track target", () => {
      const mutate = vi.fn();
      vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
        queryResult({
          data: {
            responseTargetAt: "2099-01-01T00:00:00.000Z",
            resolutionTargetAt: "2099-01-02T00:00:00.000Z",
            onHoldSince: null,
          },
          isSuccess: true,
        }) as never,
      );
      vi.mocked(useHoldTicketMutation).mockReturnValue({
        mutate,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      fireEvent.click(screen.getByText("sla.placeOnHold"));

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(mutate).not.toHaveBeenCalled();

      fireEvent.click(within(screen.getByRole("alertdialog")).getByText("sla.placeOnHold"));

      expect(mutate).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("renders the on-hold badge and a 'resume' action (no confirmation) for a held target", () => {
      const mutate = vi.fn();
      vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
        queryResult({
          data: {
            responseTargetAt: "2099-01-01T00:00:00.000Z",
            resolutionTargetAt: "2099-01-02T00:00:00.000Z",
            onHoldSince: "2024-01-01T00:00:00.000Z",
          },
          isSuccess: true,
        }) as never,
      );
      vi.mocked(useResumeTicketMutation).mockReturnValue({
        mutate,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText(/sla\.onHoldSince/)).toBeInTheDocument();
      fireEvent.click(screen.getByText("sla.resume"));

      expect(mutate).toHaveBeenCalledOnce();
    });

    it("shows a forbidden message when the hold action fails with 403", () => {
      vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
        queryResult({
          data: {
            responseTargetAt: "2099-01-01T00:00:00.000Z",
            resolutionTargetAt: "2099-01-02T00:00:00.000Z",
            onHoldSince: null,
          },
          isSuccess: true,
        }) as never,
      );
      vi.mocked(useHoldTicketMutation).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new ApiError("Forbidden", 403),
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("sla.actionForbidden")).toBeInTheDocument();
    });
  });

  // Story 50 — Ticket Internal Notes (Agent-Only).
  describe("Notes card (Story 50)", () => {
    beforeEach(() => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
    });

    it("renders a skeleton while notes are loading", () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      // Story 206 (RD-3.6) — notes load as part of the conversation
      // timeline, which shows its skeleton until every source has loaded.
      const card = screen
        .getByRole("heading", { name: "detail.chatHeading" })
        .closest(".p-surface") as HTMLElement;
      expect(card.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders an inline error when notes fail to load", () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.notesError")).toBeInTheDocument();
    });

    it("renders the empty message when there are no notes", async () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);
      // Story 206 (RD-3.6) — notes, history and escalations moved into the
      // timeline; each kind's empty message shows under its own filter.
      await showTimeline("notes");

      expect(screen.getByText("detail.notesEmpty")).toBeInTheDocument();
    });

    it("renders each note's resolved author name and timestamp", () => {
      vi.mocked(useUsersQuery).mockReturnValue(
        queryResult({
          data: [{ id: "user-1", fullName: "Jane Agent" }],
          isSuccess: true,
        }) as never,
      );
      const notes = [
        {
          id: "note-1",
          ticketId: "ticket-1",
          authorUserId: "user-1",
          body: "Called the customer back.",
          createdAt: "2024-01-01T10:05:00.000Z",
        },
      ];
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: notes, isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("Jane Agent")).toBeInTheDocument();
      expect(screen.getByText("Called the customer back.")).toBeInTheDocument();
      // Story 206 (RD-3.6) — in the day-grouped timeline a note shows its
      // time; the full date and time is the `<time>` element's title.
      expect(screen.getByTitle(new Date(notes[0]!.createdAt).toLocaleString("en"))).toHaveAttribute(
        "dateTime",
        notes[0]!.createdAt,
      );
    });

    it("falls back to the raw authorUserId when the author isn't found in the users list", () => {
      const notes = [
        {
          id: "note-1",
          ticketId: "ticket-1",
          authorUserId: "user-unknown",
          body: "Note from an unresolvable author.",
          createdAt: "2024-01-01T10:05:00.000Z",
        },
      ];
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: notes, isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("user-unknown")).toBeInTheDocument();
    });

    // Story 164 — the note field was named only by its placeholder, which is
    // not an accessible name; the same key now also names the control.
    it("gives the add-note textarea an accessible name", () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);
      noteMode();

      // Story 207 (RD-3.7, recon A11Y-05/A11Y-09) — the note field is named by
      // its own label rather than its placeholder, and is a combobox because
      // it offers @mention suggestions.
      const textarea = screen.getByRole("combobox", { name: "detail.composerNoteLabel" });
      expect(textarea).toBe(screen.getByPlaceholderText("detail.notesPlaceholder"));

      // Typing still drives the same submit-enabling behaviour.
      fireEvent.change(textarea, { target: { value: "A new note" } });
      expect(screen.getByText("detail.notesSubmit")).not.toBeDisabled();
    });

    it("disables the submit button until the note body is non-empty", () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);
      noteMode();

      const submit = screen.getByText("detail.notesSubmit");
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText("detail.notesPlaceholder"), {
        target: { value: "A new note" },
      });

      expect(submit).not.toBeDisabled();
    });

    it("submits the exact { body } payload and clears the field on success", async () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      const mutateAsync = vi.fn().mockResolvedValue({ id: "note-new" });
      vi.mocked(useCreateTicketNoteMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      noteMode();

      const textarea = screen.getByPlaceholderText(
        "detail.notesPlaceholder",
      ) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "A new note" } });
      fireEvent.click(screen.getByText("detail.notesSubmit"));

      await Promise.resolve();
      await Promise.resolve();

      expect(mutateAsync).toHaveBeenCalledWith({ body: "A new note" });
      expect(textarea.value).toBe("");
    });

    it("shows the backend's own error message when adding a note fails", async () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Note too long", 400));
      vi.mocked(useCreateTicketNoteMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      noteMode();

      fireEvent.change(screen.getByPlaceholderText("detail.notesPlaceholder"), {
        target: { value: "A new note" },
      });
      fireEvent.click(screen.getByText("detail.notesSubmit"));

      expect(await screen.findByText("Note too long")).toBeInTheDocument();
    });

    it("shows the shared network-failure message for a non-ApiError failure", async () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
      vi.mocked(useCreateTicketNoteMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      noteMode();

      fireEvent.change(screen.getByPlaceholderText("detail.notesPlaceholder"), {
        target: { value: "A new note" },
      });
      fireEvent.click(screen.getByText("detail.notesSubmit"));

      expect(await screen.findByText("errors.network")).toBeInTheDocument();
    });

    it("does not interfere with the History card's own rendering", async () => {
      vi.mocked(useTicketHistoryQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);
      noteMode();
      // Story 206 (RD-3.6) — notes, history and escalations moved into the
      // timeline; each kind's empty message shows under its own filter.
      await showTimeline("events");
      expect(screen.getByText("detail.historyEmpty")).toBeInTheDocument();
      await showTimeline("notes");
      expect(screen.getByText("detail.notesEmpty")).toBeInTheDocument();
    });

    it("does not interfere with the Escalations card's own rendering", async () => {
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);
      noteMode();
      // Story 206 (RD-3.6) — notes, history and escalations moved into the
      // timeline; each kind's empty message shows under its own filter.
      await showTimeline("events");
      expect(screen.getByText("detail.escalationsEmpty")).toBeInTheDocument();
      await showTimeline("notes");
      expect(screen.getByText("detail.notesEmpty")).toBeInTheDocument();
    });

    // RM-06 — @Mentions. The note composer's own basic mention affordance.
    describe("@mention composer (RM-06)", () => {
      beforeEach(() => {
        vi.mocked(useTicketNotesQuery).mockReturnValue(
          queryResult({ data: [], isSuccess: true }) as never,
        );
        vi.mocked(useUsersQuery).mockReturnValue(
          queryResult({
            data: [
              { id: "user-1", fullName: "Jane Doe" },
              { id: "user-2", fullName: "John Smith" },
            ],
            isSuccess: true,
          }) as never,
        );
      });

      it("shows no suggestions until an @ is typed", () => {
        render(<TicketDetailView ticketId="ticket-1" />);
        noteMode();

        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
      });

      it("shows matching agents once @ is typed, filtered as the query narrows", () => {
        render(<TicketDetailView ticketId="ticket-1" />);
        noteMode();
        const textarea = screen.getByPlaceholderText("detail.notesPlaceholder");

        fireEvent.change(textarea, { target: { value: "@J" } });
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();
        expect(screen.getByText("John Smith")).toBeInTheDocument();

        fireEvent.change(textarea, { target: { value: "@Jane" } });
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();
        expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
      });

      it("does not show suggestions for an @ that isn't at a word boundary (mid-word, e.g. an email address)", () => {
        render(<TicketDetailView ticketId="ticket-1" />);
        noteMode();
        const textarea = screen.getByPlaceholderText("detail.notesPlaceholder");

        fireEvent.change(textarea, { target: { value: "user@J" } });

        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
      });

      it("closes the suggestions once the query no longer matches anyone", () => {
        render(<TicketDetailView ticketId="ticket-1" />);
        noteMode();
        const textarea = screen.getByPlaceholderText("detail.notesPlaceholder");

        fireEvent.change(textarea, { target: { value: "@Nobody Like This" } });

        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
        expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
      });

      it("inserts the full name and closes the dropdown when a suggestion is picked", () => {
        render(<TicketDetailView ticketId="ticket-1" />);
        noteMode();
        const textarea = screen.getByPlaceholderText(
          "detail.notesPlaceholder",
        ) as HTMLTextAreaElement;

        fireEvent.change(textarea, { target: { value: "Please review @Ja" } });
        fireEvent.click(screen.getByText("Jane Doe"));

        expect(textarea.value).toBe("Please review @Jane Doe ");
        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
      });

      it("closes the dropdown on Escape without changing the note body", () => {
        render(<TicketDetailView ticketId="ticket-1" />);
        noteMode();
        const textarea = screen.getByPlaceholderText(
          "detail.notesPlaceholder",
        ) as HTMLTextAreaElement;

        fireEvent.change(textarea, { target: { value: "@Ja" } });
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();

        fireEvent.keyDown(textarea, { key: "Escape" });

        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
        expect(textarea.value).toBe("@Ja");
      });

      it("submits the mention text verbatim as part of the note body", async () => {
        const mutateAsync = vi.fn().mockResolvedValue({ id: "note-new" });
        vi.mocked(useCreateTicketNoteMutation).mockReturnValue({
          mutate: vi.fn(),
          mutateAsync,
          isPending: false,
          isError: false,
          error: null,
        } as never);

        render(<TicketDetailView ticketId="ticket-1" />);
        noteMode();
        const textarea = screen.getByPlaceholderText(
          "detail.notesPlaceholder",
        ) as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: "@Ja" } });
        fireEvent.click(screen.getByText("Jane Doe"));
        fireEvent.click(screen.getByText("detail.notesSubmit"));

        await Promise.resolve();
        await Promise.resolve();

        expect(mutateAsync).toHaveBeenCalledWith({ body: "@Jane Doe" });
      });
    });
  });

  describe("Customer Satisfaction card (Story 55)", () => {
    beforeEach(() => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
    });

    it("renders a skeleton while feedback is loading", () => {
      vi.mocked(useTicketCsatQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      // Story 203 (RD-3.3) — the section is collapsible now, so the title text
      // sits inside its disclosure button; the card is found via closest().
      const heading = screen.getByText("detail.csatHeading");
      const card = heading.closest(".p-surface") as HTMLElement;
      expect(card.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders an inline error when feedback fails to load", () => {
      vi.mocked(useTicketCsatQuery).mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.csatError")).toBeInTheDocument();
    });

    it("renders the empty message when no feedback has been submitted yet", () => {
      vi.mocked(useTicketCsatQuery).mockReturnValue(
        queryResult({ data: undefined, isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.csatEmpty")).toBeInTheDocument();
    });

    it("renders the customer's rating and comment once submitted", () => {
      vi.mocked(useTicketCsatQuery).mockReturnValue(
        queryResult({
          data: {
            id: "csat-1",
            ticketId: "ticket-1",
            submittedByContactId: "contact-1",
            rating: 5,
            comment: "Resolved quickly, thank you!",
            createdAt: "2024-01-03T00:00:00.000Z",
          },
          isSuccess: true,
        }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(
        screen.getByText(`detail.csatRatingLabel:${JSON.stringify({ rating: 5 })}`),
      ).toBeInTheDocument();
      expect(screen.getByText("Resolved quickly, thank you!")).toBeInTheDocument();
      expect(screen.queryByText("detail.csatEmpty")).not.toBeInTheDocument();
    });

    it("does not interfere with the Notes card's own rendering", async () => {
      vi.mocked(useTicketCsatQuery).mockReturnValue(
        queryResult({ data: undefined, isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.csatEmpty")).toBeInTheDocument();
      // Story 206 (RD-3.6) — notes, history and escalations moved into the
      // timeline; each kind's empty message shows under its own filter.
      await showTimeline("notes");
      expect(screen.getByText("detail.notesEmpty")).toBeInTheDocument();
    });
  });

  describe("Attachments card (Story 66)", () => {
    beforeEach(() => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
    });

    it("renders a skeleton while attachments are loading", () => {
      vi.mocked(useAttachmentsQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

      const { container } = render(<TicketDetailView ticketId="ticket-1" />);

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders an inline error when attachments fail to load", () => {
      vi.mocked(useAttachmentsQuery).mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.attachmentsError")).toBeInTheDocument();
    });

    it("renders the empty message when there are no attachments", () => {
      vi.mocked(useAttachmentsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.attachmentsEmpty")).toBeInTheDocument();
    });

    it("renders each attachment's filename and size", () => {
      vi.mocked(useAttachmentsQuery).mockReturnValue(
        queryResult({
          data: [
            {
              id: "attachment-1",
              ticketId: "ticket-1",
              filename: "screenshot.png",
              size: 2048,
              mimeType: "image/png",
              uploadedByUserId: "user-1",
              createdAt: "2024-01-03T00:00:00.000Z",
            },
          ],
          isSuccess: true,
        }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("screenshot.png")).toBeInTheDocument();
      expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    });

    it("opens the presigned download URL when an attachment is clicked", async () => {
      vi.mocked(useAttachmentsQuery).mockReturnValue(
        queryResult({
          data: [
            {
              id: "attachment-1",
              ticketId: "ticket-1",
              filename: "screenshot.png",
              size: 2048,
              mimeType: "image/png",
              uploadedByUserId: "user-1",
              createdAt: "2024-01-03T00:00:00.000Z",
            },
          ],
          isSuccess: true,
        }) as never,
      );
      vi.mocked(getAttachmentDownloadUrl).mockResolvedValue({
        url: "https://minio.local/presigned-url",
      });
      const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      render(<TicketDetailView ticketId="ticket-1" />);
      fireEvent.click(screen.getByText("screenshot.png"));

      await vi.waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith(
          "https://minio.local/presigned-url",
          "_blank",
          "noopener,noreferrer",
        );
      });
    });

    it("uploads the selected file", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "attachment-new" });
      vi.mocked(useUploadAttachmentMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      const file = new File(["hello"], "notes.txt", { type: "text/plain" });
      // Story 208 (RD-3.8) — the composer has a file input too (earlier in the
      // DOM); this case is about the Attachments card, so it takes the card's
      // input by its name.
      const input = screen.getByLabelText("detail.attachmentsUploadLabel");
      fireEvent.change(input, { target: { files: [file] } });

      await vi.waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith(file);
      });
    });

    it("shows the backend's own error message when an upload fails", async () => {
      vi.mocked(useUploadAttachmentMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn().mockRejectedValue(new ApiError("File type not allowed", 400)),
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      const file = new File(["hello"], "script.sh", { type: "application/x-sh" });
      // Story 208 (RD-3.8) — the composer has a file input too (earlier in the
      // DOM); this case is about the Attachments card, so it takes the card's
      // input by its name.
      const input = screen.getByLabelText("detail.attachmentsUploadLabel");
      fireEvent.change(input, { target: { files: [file] } });

      await screen.findByText("File type not allowed");
    });

    it("does not interfere with the Notes card's own rendering", async () => {
      vi.mocked(useAttachmentsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.attachmentsEmpty")).toBeInTheDocument();
      // Story 206 (RD-3.6) — notes, history and escalations moved into the
      // timeline; each kind's empty message shows under its own filter.
      await showTimeline("notes");
      expect(screen.getByText("detail.notesEmpty")).toBeInTheDocument();
    });
  });

  // Story 97 — Loading & Skeleton UX.
  describe("loading & skeleton UX (Story 97)", () => {
    it("renders a shaped skeleton — not the ticket content — while the ticket itself is loading", () => {
      vi.mocked(useTicketQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

      const { container } = render(<TicketDetailView ticketId="ticket-1" />);

      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
      expect(screen.queryByDisplayValue("Cannot log in")).not.toBeInTheDocument();
    });

    it("disables the assignee select and shows a loading placeholder while its own options query is loading", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useUsersQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      // The trigger has no accessible name distinct from its wrapping
      // `Field` label (the accname spec excludes a nested labelable
      // control's own content from its wrapping label's computed name —
      // see `user-list-view.spec.tsx`'s own established convention for
      // this exact same constraint) — found by its rendered placeholder
      // text and asserted via the DOM instead.
      const combobox = screen.getByText("detail.optionsLoading").closest('[role="combobox"]');
      expect(combobox).toBeDisabled();
    });

    it("disables the department select and shows a loading placeholder while its own options query is loading", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useDepartmentsQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      const combobox = screen.getByText("detail.optionsLoading").closest('[role="combobox"]');
      expect(combobox).toBeDisabled();
    });

    it("does not disable the assignee/department selects once their options queries resolve", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.queryByText("detail.optionsLoading")).not.toBeInTheDocument();
    });
  });

  // Story 165 — the early-return loading state announces itself. The
  // announcement lives at the call site, never inside the shared skeleton:
  // route-level `loading.tsx` renders that same component and deliberately
  // does not announce (see `RouteLoadingSkeleton`).
  // `placeholderHidden={false}` here: TicketDetailSkeleton already carries
  // `aria-hidden` on its own root, so the wrapper must not add a second.
  it("announces the detail loading state while the skeleton hides itself", () => {
    vi.mocked(useTicketQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TicketDetailView ticketId="ticket-1" />);

    const status = screen.getByRole("status", { name: "loading" });
    expect(status).toHaveAttribute("aria-busy", "true");

    // The wrapper adds no aria-hidden of its own...
    expect(status.firstElementChild).not.toHaveAttribute("aria-hidden");
    // ...because the skeleton already hides its whole subtree.
    expect(status.querySelector("[aria-hidden='true']")).toBeInTheDocument();

    // The skeleton's own visuals are unchanged.
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  /**
   * Story 202 (RD-3.2) — the header actions go through the very handlers the
   * inspector fields use, so each sends exactly the field's request and
   * shows exactly its toast.
   */
  describe("header actions (Story 202)", () => {
    function renderWith(ticket: Record<string, unknown>, mutation: Record<string, unknown> = {}) {
      const mutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      });
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isPending: false,
        isError: false,
        error: null,
        ...mutation,
      } as never);
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: { ...baseTicket, ...ticket }, isSuccess: true }) as never,
      );
      vi.mocked(useUsersQuery).mockReturnValue(
        queryResult({ data: [{ id: "agent-1", fullName: "Ada Agent" }], isSuccess: true }) as never,
      );
      render(<TicketDetailView ticketId="ticket-1" />);
      return mutate;
    }
    const actions = () => screen.getByRole("group", { name: "detail.actions.label" });

    it("resolves through the status field's own request and toast", () => {
      const mutate = renderWith({ status: "OPEN" });

      fireEvent.click(within(actions()).getByRole("button", { name: "detail.actions.resolve" }));
      // Demo hardening — the header asks first, like the board.
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "board.confirm.RESOLVED.action",
        }),
      );

      expect(mutate).toHaveBeenCalledWith({ status: "RESOLVED" }, expect.any(Object));
      expect(mockedShowSuccessToast).toHaveBeenCalledWith(
        'detail.statusUpdateSuccess:{"status":"ticketStatus.RESOLVED"}',
      );
    });

    it("reopens a resolved ticket through the same request", () => {
      const mutate = renderWith({ status: "RESOLVED" });

      fireEvent.click(within(actions()).getByRole("button", { name: "detail.actions.reopen" }));

      expect(mutate).toHaveBeenCalledWith({ status: "OPEN" }, expect.any(Object));
    });

    it("assigns to the current agent through the assignee field's own request and toast", () => {
      const mutate = renderWith({ assignedToUserId: null });

      fireEvent.click(within(actions()).getByRole("button", { name: "detail.actions.assignToMe" }));

      expect(mutate).toHaveBeenCalledWith({ assignedToUserId: "agent-1" }, expect.any(Object));
      expect(mockedShowSuccessToast).toHaveBeenCalledWith(
        'detail.assignedAgentUpdateSuccess:{"agent":"Ada Agent"}',
      );
    });

    it("hides Assign to me when the ticket is already the current agent's", () => {
      renderWith({ assignedToUserId: "agent-1" });

      expect(
        within(actions()).queryByRole("button", { name: "detail.actions.assignToMe" }),
      ).not.toBeInTheDocument();
    });

    it("disables the actions while the shared mutation is pending", () => {
      renderWith({ status: "OPEN" }, { isPending: true });

      for (const button of within(actions()).getAllByRole("button")) {
        expect(button).toBeDisabled();
      }
    });

    // Phase 3 guard, extended by Story 202.
    it("keeps the header actions in the section-survival set", () => {
      renderWith({ status: "OPEN", assignedToUserId: null });

      expect(within(actions()).getAllByRole("button")).toHaveLength(2);
    });
  });

  /**
   * Story 203 (RD-3.3, recon TW-02/TW-07) — the inspector: titled,
   * collapsible sections, all open by default. Extends the Phase 3 guard.
   */
  describe("inspector (Story 203)", () => {
    function renderLoaded() {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      return render(<TicketDetailView ticketId="ticket-1" />);
    }
    // Story 206 (RD-3.6) — SLA escalations left the inspector for the
    // conversation timeline. Story 209 (RD-3.9) — AI assist joined it.
    // Story 219 (RD-3.10) — knowledge-base references joined the inspector.
    const SECTIONS = [
      "detail.propertiesHeading",
      "detail.aiHeading",
      "detail.contextPanelHeading",
      "detail.kbReferencesHeading",
      "detail.slaHeading",
      "detail.csatHeading",
    ];

    it("titles the properties section and keeps every inspector section open by default", () => {
      renderLoaded();

      for (const name of SECTIONS) {
        expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
        expect(screen.getByRole("button", { name })).toHaveAttribute("aria-expanded", "true");
      }
    });

    it("collapses and restores the properties section without losing a control", () => {
      renderLoaded();
      const toggle = screen.getByRole("button", { name: "detail.propertiesHeading" });

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("combobox", { name: "detail.status" })).not.toBeInTheDocument();

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      for (const field of [
        "detail.status",
        "detail.priority",
        "detail.category",
        "detail.assignedAgent",
        "detail.department",
      ]) {
        expect(screen.getByRole("combobox", { name: field })).toBeInTheDocument();
      }
    });

    it("shows the full ticket id in the properties section", () => {
      renderLoaded();

      const section = screen
        .getByRole("heading", { name: "detail.propertiesHeading" })
        .closest(".p-surface") as HTMLElement;
      expect(within(section).getByText("detail.ticketIdFull").tagName).toBe("DT");
      expect(within(section).getByText("ticket-1")).toHaveAttribute("dir", "ltr");
    });

    it("keeps the outline at one h1 with every section an h2", () => {
      const { container } = renderLoaded();

      const levels = [...container.querySelectorAll("h1, h2, h3, h4")].map((h) => h.tagName);
      expect(levels.filter((l) => l === "H1")).toHaveLength(1);
      expect(levels[0]).toBe("H1");
    });

    it("makes the inspector sticky and independently scrollable from lg", () => {
      renderLoaded();

      const inspector = screen
        .getByRole("heading", { name: "detail.propertiesHeading" })
        .closest(".p-surface")!.parentElement!;
      expect(inspector).toHaveClass("lg:sticky", "lg:overflow-y-auto");
    });
  });

  /**
   * Story 204 (RD-3.4, recon TW-08) — the assignee field is a searchable
   * Combobox: keyboard-only assignment through the same updateAssignee
   * request and toast; presence as text; the current agent first.
   */
  describe("assignee picker (Story 204)", () => {
    function renderPicker() {
      const mutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      });
      vi.mocked(useUpdateTicketMutation).mockReturnValue({
        mutate,
        isPending: false,
        isError: false,
        error: null,
      } as never);
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useUsersQuery).mockReturnValue(
        queryResult({
          data: [
            { id: "user-1", fullName: "Jane Online" },
            { id: "agent-1", fullName: "Ada Agent" },
            { id: "user-2", fullName: "John Offline" },
          ],
          isSuccess: true,
        }) as never,
      );
      vi.mocked(useAgentPresence).mockReturnValue({ "user-1": "online" });
      render(<TicketDetailView ticketId="ticket-1" />);
      return mutate;
    }

    it("lists the current agent first, marked as you, with presence as text", async () => {
      const ue = userEvent.setup();
      renderPicker();

      await ue.click(screen.getByRole("combobox", { name: "detail.assignedAgent" }));

      const options = screen.getAllByRole("option");
      expect(options[0]).toHaveTextContent("Ada Agent (detail.assigneeYou)");
      expect(screen.getByRole("option", { name: /Jane Online\s*detail\.presenceOnline/ })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /John Offline\s*detail\.presenceOffline/ })).toBeInTheDocument();
    });

    it("assigns with the keyboard alone, through the assignee field's own request and toast", async () => {
      const ue = userEvent.setup();
      const mutate = renderPicker();

      screen.getByRole("combobox", { name: "detail.assignedAgent" }).focus();
      await ue.keyboard("{ArrowDown}");
      await ue.keyboard("john");
      await ue.keyboard("{Enter}");

      expect(mutate).toHaveBeenCalledWith({ assignedToUserId: "user-2" }, expect.any(Object));
      expect(mockedShowSuccessToast).toHaveBeenCalledWith(
        'detail.assignedAgentUpdateSuccess:{"agent":"John Offline"}',
      );
    });

    it("offers no unassign option — the PATCH does not accept null (recon)", async () => {
      const ue = userEvent.setup();
      renderPicker();

      await ue.click(screen.getByRole("combobox", { name: "detail.assignedAgent" }));

      expect(screen.getAllByRole("option")).toHaveLength(3);
      expect(screen.queryByRole("option", { name: /list\.unassigned/ })).not.toBeInTheDocument();
    });
  });

  // Story 208 (RD-3.8, recon TW-06) — the AI card and the composer, wired.
  describe("AI reply insert (Story 208)", () => {
    it("puts a suggested reply into the reply draft without sending it", async () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
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
      const sendMessage = vi.fn();
      vi.mocked(useCreateTicketMessageMutation).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: sendMessage,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<TicketDetailView ticketId="ticket-1" />);
      fireEvent.click(screen.getByText("detail.aiSuggestReply"));
      fireEvent.click(await screen.findByRole("button", { name: "detail.aiInsertIntoReply" }));

      const reply = screen.getByRole("textbox", { name: "detail.composerReplyLabel" });
      expect(reply).toHaveValue("Please try resetting your password.");
      await vi.waitFor(() => expect(reply).toHaveFocus());
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  // Story 209 (RD-3.9) — AI assist in the inspector, its summary pinned.
  describe("AI assist panel (Story 209)", () => {
    // Demo hardening — the inspector leads with the customer context; AI
    // assist, an optional tool, follows it.
    it("places AI assist in the inspector, after Properties and the customer context", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      render(<TicketDetailView ticketId="ticket-1" />);

      const properties = screen.getByRole("heading", { name: "detail.propertiesHeading" });
      const ai = screen.getByRole("heading", { name: "detail.aiHeading" });
      const context = screen.getByRole("heading", { name: "detail.contextPanelHeading" });
      expect(
        properties.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(context.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Out of the main column: the conversation no longer sits above it.
      expect(properties.closest(".lg\\:sticky")).toContainElement(ai);
    });

    it("pins a successful summary at the top of the conversation", async () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
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
            outputText: "Customer cannot log in since Monday.",
            errorMessage: null,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          isSuccess: true,
        }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);
      fireEvent.click(screen.getByText("detail.aiSummarize"));

      const pinned = await screen.findByRole("region", { name: "detail.aiSummaryPinned" });
      const chat = screen.getByRole("heading", { name: "detail.chatHeading" }).closest(".p-surface")!;
      expect(chat).toContainElement(pinned);
      expect(within(pinned).getByText("Customer cannot log in since Monday.")).toBeInTheDocument();
    });
  });

  // Story 219 (PR-3.4, RD-3.10) — KB references are an inspector section.
  describe("ticket detail v2 (Story 219)", () => {
    it("places knowledge-base references in the inspector, after the customer context", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      render(<TicketDetailView ticketId="ticket-1" />);

      const context = screen.getByRole("heading", { name: "detail.contextPanelHeading" });
      const kb = screen.getByRole("heading", { name: "detail.kbReferencesHeading" });
      expect(context.compareDocumentPosition(kb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(context.closest(".lg\\:sticky")).toContainElement(kb);
    });
  });

  // Story 220 (PR-3.5, RD-3.12 / RD-3.14) — mobile panels and the way back.
  describe("ticket detail mobile and navigation (Story 220)", () => {
    function renderLoaded() {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      return render(<TicketDetailView ticketId="ticket-1" />);
    }

    it("switches between the conversation and the details below lg", () => {
      searchParamsString = "";
      renderLoaded();
      const switcher = screen.getByRole("radiogroup", { name: "detail.panelSwitcher" });
      const conversation = screen.getByRole("heading", { name: "detail.chatHeading" });
      const properties = screen.getByRole("heading", { name: "detail.propertiesHeading" });
      const mainColumn = conversation.closest(".lg\\:col-span-2")!;
      const inspector = properties.closest(".lg\\:sticky")!;
      expect(mainColumn).not.toHaveClass("max-lg:hidden");
      expect(inspector).toHaveClass("max-lg:hidden");

      fireEvent.click(within(switcher).getByRole("radio", { name: "detail.panel.details" }));
      expect(mainColumn).toHaveClass("max-lg:hidden");
      expect(inspector).not.toHaveClass("max-lg:hidden");
    });

    it("goes back to the board or list view, with its filters, it was opened from", () => {
      searchParamsString = "from=board&search=vat";
      renderLoaded();
      expect(screen.getByRole("link", { name: "detail.backToList" })).toHaveAttribute(
        "href",
        "/en/tickets?view=board&search=vat",
      );
      searchParamsString = "";
    });
  });
});
