import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
  useUsersQuery,
} from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import { useAttachmentsQuery, useUploadAttachmentMutation } from "@/hooks/use-attachments";
import {
  useCreateTicketMessageMutation,
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

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn() }),
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
vi.mock("@/hooks/use-ticket-messages", () => ({
  useTicketMessagesQuery: vi.fn(),
  useCreateTicketMessageMutation: vi.fn(),
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

    // Story 42 — subject is now an editable input, not static text.
    expect(screen.getByDisplayValue("Cannot log in")).toBeInTheDocument();
    expect(screen.getByText(/Acme Inc\./)).toBeInTheDocument();
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

      const input = screen.getByDisplayValue("Cannot log in");
      fireEvent.change(input, { target: { value: "Cannot log in anymore" } });
      fireEvent.blur(input);

      expect(mutate).toHaveBeenCalledWith({ subject: "Cannot log in anymore" });
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

      const input = screen.getByDisplayValue("Cannot log in");
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.blur(input);

      expect(mutate).not.toHaveBeenCalled();
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

      expect(mutate).toHaveBeenCalledWith({ departmentId: "dept-1" });
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
      fireEvent.click(screen.getByText("OPEN"));
      fireEvent.click(await screen.findByRole("option", { name: "IN_PROGRESS" }));

      expect(mockedShowSuccessToast).toHaveBeenCalledWith(
        'detail.statusUpdateSuccess:{"status":"IN_PROGRESS"}',
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
      fireEvent.click(screen.getByText("HIGH"));
      fireEvent.click(await screen.findByRole("option", { name: "URGENT" }));

      expect(mockedShowSuccessToast).toHaveBeenCalledWith(
        'detail.priorityUpdateSuccess:{"priority":"URGENT"}',
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
      fireEvent.click(screen.getByText("OPEN"));
      fireEvent.click(await screen.findByRole("option", { name: "IN_PROGRESS" }));

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

      const heading = screen.getByText("detail.escalationsHeading");
      const card = heading.parentElement as HTMLElement;
      expect(card.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders an inline error when escalations fail to load", () => {
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.escalationsError")).toBeInTheDocument();
    });

    it("renders the empty message when there are no escalations", () => {
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

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

      expect(
        screen.getByText(new Date(escalations[0]!.escalatedAt).toLocaleString("en")),
      ).toBeInTheDocument();
      expect(
        screen.getByText(new Date(escalations[1]!.escalatedAt).toLocaleString("en")),
      ).toBeInTheDocument();
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

    it("does not interfere with the SLA card's own rendering", () => {
      vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
        queryResult({ data: null, isSuccess: true }) as never,
      );
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("sla.none")).toBeInTheDocument();
      expect(screen.getByText("detail.escalationsEmpty")).toBeInTheDocument();
    });

    it("does not interfere with the History card's own rendering", () => {
      vi.mocked(useTicketHistoryQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.historyEmpty")).toBeInTheDocument();
      expect(screen.getByText("detail.escalationsEmpty")).toBeInTheDocument();
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

      const heading = screen.getByText("detail.notesHeading");
      const card = heading.parentElement as HTMLElement;
      expect(card.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders an inline error when notes fail to load", () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.notesError")).toBeInTheDocument();
    });

    it("renders the empty message when there are no notes", () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

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
      expect(
        screen.getByText(new Date(notes[0]!.createdAt).toLocaleString("en")),
      ).toBeInTheDocument();
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

    it("disables the submit button until the note body is non-empty", () => {
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

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

      fireEvent.change(screen.getByPlaceholderText("detail.notesPlaceholder"), {
        target: { value: "A new note" },
      });
      fireEvent.click(screen.getByText("detail.notesSubmit"));

      expect(await screen.findByText("errors.network")).toBeInTheDocument();
    });

    it("does not interfere with the History card's own rendering", () => {
      vi.mocked(useTicketHistoryQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.historyEmpty")).toBeInTheDocument();
      expect(screen.getByText("detail.notesEmpty")).toBeInTheDocument();
    });

    it("does not interfere with the Escalations card's own rendering", () => {
      vi.mocked(useTicketEscalationsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.escalationsEmpty")).toBeInTheDocument();
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

        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
      });

      it("shows matching agents once @ is typed, filtered as the query narrows", () => {
        render(<TicketDetailView ticketId="ticket-1" />);
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
        const textarea = screen.getByPlaceholderText("detail.notesPlaceholder");

        fireEvent.change(textarea, { target: { value: "user@J" } });

        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
      });

      it("closes the suggestions once the query no longer matches anyone", () => {
        render(<TicketDetailView ticketId="ticket-1" />);
        const textarea = screen.getByPlaceholderText("detail.notesPlaceholder");

        fireEvent.change(textarea, { target: { value: "@Nobody Like This" } });

        expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
        expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
      });

      it("inserts the full name and closes the dropdown when a suggestion is picked", () => {
        render(<TicketDetailView ticketId="ticket-1" />);
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

      const heading = screen.getByText("detail.csatHeading");
      const card = heading.parentElement as HTMLElement;
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

    it("does not interfere with the Notes card's own rendering", () => {
      vi.mocked(useTicketCsatQuery).mockReturnValue(
        queryResult({ data: undefined, isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.csatEmpty")).toBeInTheDocument();
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
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
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
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await screen.findByText("File type not allowed");
    });

    it("does not interfere with the Notes card's own rendering", () => {
      vi.mocked(useAttachmentsQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      vi.mocked(useTicketNotesQuery).mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.attachmentsEmpty")).toBeInTheDocument();
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
});
