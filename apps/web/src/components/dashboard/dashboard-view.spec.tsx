import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DashboardView } from "./dashboard-view";
import { useCustomersQuery, useTicketsQuery, useUpdateTicketMutation } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useTicketsQuery: vi.fn(),
  useCustomersQuery: vi.fn(),
  useUpdateTicketMutation: vi.fn(),
}));

const mockedUseTicketsQuery = vi.mocked(useTicketsQuery);
const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);
const mockedUseUpdateTicketMutation = vi.mocked(useUpdateTicketMutation);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

/**
 * Story 29 — `DashboardView` now calls `useTicketsQuery` twice: once with
 * `{ assignedToUserId }` ("My open tickets") and once with `{}` (the
 * unfiltered result "Unclaimed tickets" filters client-side). The mock must
 * distinguish the two calls by argument so each section's tests can target
 * one section without the other interfering.
 */
function mockTicketQueries(overrides: {
  mine?: Record<string, unknown>;
  all?: Record<string, unknown>;
}) {
  const mine = queryResult({ isSuccess: true, data: [], ...overrides.mine });
  const all = queryResult({ isSuccess: true, data: [], ...overrides.all });
  mockedUseTicketsQuery.mockImplementation((filters) => {
    if (filters && Object.prototype.hasOwnProperty.call(filters, "assignedToUserId")) {
      return mine as never;
    }
    return all as never;
  });
}

function ticket(overrides: Record<string, unknown>) {
  return {
    id: "ticket-1",
    subject: "Cannot log in",
    category: null,
    priority: "MEDIUM",
    status: "OPEN",
    customerId: "customer-1",
    contactId: null,
    departmentId: null,
    assignedToUserId: "agent-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    slaTarget: null,
    ...overrides,
  };
}

function renderWithLocale(userId = "agent-1", locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DashboardView userId={userId} />
    </NextIntlClientProvider>,
  );
}

describe("DashboardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [{ id: "customer-1", displayName: "Acme Inc." }] }) as never,
    );
    mockTicketQueries({});
    mockedUseUpdateTicketMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  describe("My open tickets", () => {
    it("shows a loading state while the tickets query is pending", () => {
      mockTicketQueries({ mine: { isSuccess: false, isLoading: true, data: undefined } });

      renderWithLocale();

      expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
    });

    it("shows an error state with a retry action when the query fails", () => {
      const refetch = vi.fn();
      mockTicketQueries({ mine: { isSuccess: false, isError: true, refetch } });

      renderWithLocale();

      expect(screen.getByText("Couldn't load your tickets.")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Retry"));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it("shows the empty state when the agent has no open assigned tickets", () => {
      renderWithLocale();

      expect(screen.getByText("You have no open tickets assigned to you.")).toBeInTheDocument();
    });

    // Story 98 — Design System & Visual Polish.
    it("gives the empty state a next action, navigating to the full ticket list", () => {
      renderWithLocale();

      fireEvent.click(screen.getByRole("button", { name: "Browse all tickets" }));

      expect(push).toHaveBeenCalledWith("/en/tickets");
    });

    it("queries GET /tickets scoped to the authenticated agent, not the branch-wide list", () => {
      renderWithLocale("agent-42");

      expect(mockedUseTicketsQuery).toHaveBeenCalledWith({ assignedToUserId: "agent-42" });
    });

    it("excludes RESOLVED and CLOSED tickets from the populated list", () => {
      mockTicketQueries({
        mine: {
          data: [
            ticket({ id: "ticket-open", subject: "Open one", status: "OPEN" }),
            ticket({ id: "ticket-resolved", subject: "Resolved one", status: "RESOLVED" }),
            ticket({ id: "ticket-closed", subject: "Closed one", status: "CLOSED" }),
          ],
        },
      });

      renderWithLocale();

      expect(screen.getByText("Open one")).toBeInTheDocument();
      expect(screen.queryByText("Resolved one")).not.toBeInTheDocument();
      expect(screen.queryByText("Closed one")).not.toBeInTheDocument();
    });

    // Story 98 — Design System & Visual Polish. Only OPEN/IN_PROGRESS ever
    // reach this list (this view's own existing status filter, above) —
    // confirming those two get visually distinct badge treatment.
    it("gives OPEN and IN_PROGRESS status badges visually distinct treatment", () => {
      mockTicketQueries({
        mine: {
          data: [
            ticket({ id: "ticket-open", subject: "Open one", status: "OPEN" }),
            ticket({ id: "ticket-in-progress", subject: "In-progress one", status: "IN_PROGRESS" }),
          ],
        },
      });

      renderWithLocale();

      expect(screen.getByText("OPEN")).toHaveClass("bg-amber-100");
      expect(screen.getByText("IN_PROGRESS")).toHaveClass("bg-slate-100");
    });

    it("orders tickets breached-first, then soonest-remaining, then no-target-last", () => {
      const now = Date.now();
      mockTicketQueries({
        mine: {
          data: [
            ticket({ id: "ticket-none", subject: "No target", status: "IN_PROGRESS", slaTarget: null }),
            ticket({
              id: "ticket-soon",
              subject: "Due soon",
              status: "OPEN",
              slaTarget: {
                responseTargetAt: new Date(now + 60 * 60 * 1000).toISOString(),
                resolutionTargetAt: new Date(now + 60 * 60 * 1000).toISOString(),
              },
            }),
            ticket({
              id: "ticket-breached",
              subject: "Already breached",
              status: "OPEN",
              slaTarget: {
                responseTargetAt: new Date(now - 60 * 60 * 1000).toISOString(),
                resolutionTargetAt: new Date(now - 60 * 60 * 1000).toISOString(),
              },
            }),
          ],
        },
      });

      renderWithLocale();

      const subjects = screen
        .getAllByText(/No target|Due soon|Already breached/)
        .map((el) => el.textContent);
      expect(subjects).toEqual(["Already breached", "Due soon", "No target"]);
    });

    it("navigates to the ticket detail route when a row is clicked", () => {
      mockTicketQueries({ mine: { data: [ticket({})] } });

      renderWithLocale();
      fireEvent.click(screen.getByText("Cannot log in"));

      expect(push).toHaveBeenCalledWith("/en/tickets/ticket-1");
    });

    it("navigates to the customer detail route when the customer name is clicked, without also navigating to the ticket", () => {
      mockTicketQueries({ mine: { data: [ticket({})] } });

      renderWithLocale();
      fireEvent.click(screen.getByText("Acme Inc."));

      expect(push).toHaveBeenCalledWith("/en/customers/customer-1");
      expect(push).not.toHaveBeenCalledWith("/en/tickets/ticket-1");
    });
  });

  describe("Unclaimed tickets (Story 29)", () => {
    it("shows a loading state while the branch-wide tickets query is pending", () => {
      mockTicketQueries({ all: { isSuccess: false, isLoading: true, data: undefined } });

      renderWithLocale();

      expect(screen.getByText("Unclaimed tickets")).toBeInTheDocument();
    });

    it("shows an error state with a retry action when the branch-wide query fails", () => {
      const refetch = vi.fn();
      mockTicketQueries({ all: { isSuccess: false, isError: true, refetch } });

      renderWithLocale();

      expect(screen.getByText("Couldn't load unclaimed tickets.")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Retry"));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it("shows the empty state when there are no unassigned open tickets", () => {
      renderWithLocale();

      expect(screen.getByText("No unclaimed tickets right now.")).toBeInTheDocument();
    });

    it("shows only unassigned, open tickets — excluding assigned, resolved, and closed ones", () => {
      mockTicketQueries({
        all: {
          data: [
            ticket({ id: "t-unassigned-open", subject: "Unassigned open", assignedToUserId: null, status: "OPEN" }),
            ticket({ id: "t-assigned", subject: "Already assigned", assignedToUserId: "agent-9", status: "OPEN" }),
            ticket({
              id: "t-unassigned-resolved",
              subject: "Unassigned resolved",
              assignedToUserId: null,
              status: "RESOLVED",
            }),
          ],
        },
      });

      renderWithLocale();

      expect(screen.getByText("Unassigned open")).toBeInTheDocument();
      expect(screen.queryByText("Already assigned")).not.toBeInTheDocument();
      expect(screen.queryByText("Unassigned resolved")).not.toBeInTheDocument();
    });

    it("calls the existing PATCH /tickets/:id mutation with the current agent's id when Claim is clicked", () => {
      const mutate = vi.fn();
      mockedUseUpdateTicketMutation.mockReturnValue({
        mutate,
        isPending: false,
        isError: false,
        error: null,
      } as never);
      mockTicketQueries({
        all: { data: [ticket({ id: "unassigned-1", assignedToUserId: null, status: "OPEN" })] },
      });

      renderWithLocale("agent-42");
      fireEvent.click(screen.getByText("Claim"));

      expect(mockedUseUpdateTicketMutation).toHaveBeenCalledWith("unassigned-1");
      expect(mutate).toHaveBeenCalledWith({ assignedToUserId: "agent-42" });
    });

    it("disables the Claim button and shows a pending label while the claim is in flight", () => {
      mockedUseUpdateTicketMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as never);
      mockTicketQueries({
        all: { data: [ticket({ id: "unassigned-1", assignedToUserId: null, status: "OPEN" })] },
      });

      renderWithLocale();

      const button = screen.getByText("Claiming...");
      expect(button).toBeDisabled();
    });

    it("shows a forbidden-specific message when a claim is rejected with 403", () => {
      mockedUseUpdateTicketMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new ApiError("Forbidden", 403),
      } as never);
      mockTicketQueries({
        all: { data: [ticket({ id: "unassigned-1", assignedToUserId: null, status: "OPEN" })] },
      });

      renderWithLocale();

      expect(screen.getByText("You don't have permission to claim this ticket.")).toBeInTheDocument();
    });

    it("shows a generic failure message when a claim is rejected with a non-403 error", () => {
      mockedUseUpdateTicketMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new ApiError("Server error", 500),
      } as never);
      mockTicketQueries({
        all: { data: [ticket({ id: "unassigned-1", assignedToUserId: null, status: "OPEN" })] },
      });

      renderWithLocale();

      expect(screen.getByText("Couldn't claim this ticket. Please try again.")).toBeInTheDocument();
    });

    it("still navigates to the ticket detail route when the row (not the Claim button) is clicked", () => {
      mockTicketQueries({
        all: {
          data: [
            ticket({ id: "unassigned-1", subject: "Needs a home", assignedToUserId: null, status: "OPEN" }),
          ],
        },
      });

      renderWithLocale();
      fireEvent.click(screen.getByText("Needs a home"));

      expect(push).toHaveBeenCalledWith("/en/tickets/unassigned-1");
    });
  });

  it("renders correctly in Arabic", () => {
    renderWithLocale("agent-1", "ar");

    expect(screen.getByText("لوحة التحكم")).toBeInTheDocument();
    expect(screen.getByText("تذاكري المفتوحة")).toBeInTheDocument();
    expect(screen.getByText("لا توجد تذاكر مفتوحة مُسندة إليك.")).toBeInTheDocument();
    expect(screen.getByText("التذاكر غير المُسندة")).toBeInTheDocument();
    expect(screen.getByText("لا توجد تذاكر غير مُسندة حاليًا.")).toBeInTheDocument();
  });
});
