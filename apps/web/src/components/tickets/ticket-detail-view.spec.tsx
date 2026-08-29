import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketDetailView } from "./ticket-detail-view";
import {
  useCustomersQuery,
  useDepartmentsQuery,
  useTicketEscalationsQuery,
  useTicketHistoryQuery,
  useTicketQuery,
  useTicketSlaTargetQuery,
  useUpdateTicketMutation,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";

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
  useCustomersQuery: vi.fn(),
  useUsersQuery: vi.fn(),
  useDepartmentsQuery: vi.fn(),
  useUpdateTicketMutation: vi.fn(),
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
  category: "billing",
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
      queryResult({ data: [{ id: "customer-1", displayName: "Acme Inc." }], isSuccess: true }) as never,
    );
    vi.mocked(useUsersQuery).mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    vi.mocked(useDepartmentsQuery).mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    vi.mocked(useTicketHistoryQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useTicketSlaTargetQuery).mockReturnValue(
      queryResult({ data: null, isSuccess: true }) as never,
    );
    vi.mocked(useTicketEscalationsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUpdateTicketMutation).mockReturnValue({
      mutate: vi.fn(),
      isError: false,
      error: null,
    } as never);
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

    it("renders an inline error when departments fail to load", () => {
      vi.mocked(useTicketQuery).mockReturnValue(
        queryResult({ data: baseTicket, isSuccess: true }) as never,
      );
      vi.mocked(useDepartmentsQuery).mockReturnValue(queryResult({ isError: true }) as never);

      render(<TicketDetailView ticketId="ticket-1" />);

      expect(screen.getByText("detail.departmentLoadError")).toBeInTheDocument();
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
});
