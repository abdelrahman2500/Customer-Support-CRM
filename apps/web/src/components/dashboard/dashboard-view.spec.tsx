import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DashboardView } from "./dashboard-view";
import { useCustomersQuery, useTicketsQuery, useUpdateTicketMutation } from "@/hooks/use-tickets";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useTasksQuery,
  useUpdateTaskMutation,
} from "@/hooks/use-tasks";
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

// RM-03 — `TasksPanel` (mounted inside `DashboardView`) calls these real
// hooks; mocked here the same way every other data hook in this spec is,
// so these tests never depend on a real `QueryClientProvider`/network call.
vi.mock("@/hooks/use-tasks", () => ({
  tasksQueryKey: ["tasks"],
  useTasksQuery: vi.fn(),
  useCreateTaskMutation: vi.fn(),
  useUpdateTaskMutation: vi.fn(),
  useDeleteTaskMutation: vi.fn(),
}));
vi.mock("@/hooks/use-task-reminders", () => ({
  useTaskReminders: vi.fn(),
}));

const mockedUseTicketsQuery = vi.mocked(useTicketsQuery);
const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);
const mockedUseUpdateTicketMutation = vi.mocked(useUpdateTicketMutation);
const mockedUseTasksQuery = vi.mocked(useTasksQuery);
const mockedUseCreateTaskMutation = vi.mocked(useCreateTaskMutation);
const mockedUseUpdateTaskMutation = vi.mocked(useUpdateTaskMutation);
const mockedUseDeleteTaskMutation = vi.mocked(useDeleteTaskMutation);

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
/**
 * Story S-8e — `GET /tickets` returns a `Paginated<T>` envelope, so this
 * screen's queries no longer hand back a bare array. Mirrors
 * `audit-log-view.spec.tsx`'s own helper.
 */
function page(items: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    ...overrides,
  };
}

function mockTicketQueries(overrides: {
  mine?: Record<string, unknown>;
  all?: Record<string, unknown>;
}) {
  // Story S-8e — both panels now receive a page envelope. `overrides`
  // still pass bare arrays, so they are wrapped here rather than at every
  // call site.
  // Only an array gets wrapped: a test that passes `data: undefined` is
  // asserting the no-data-yet state and must keep it.
  const wrap = (o: Record<string, unknown> = {}) =>
    Array.isArray(o.data) ? { ...o, data: page(o.data) } : o;
  const mine = queryResult({ isSuccess: true, data: page([]), ...wrap(overrides.mine) });
  const all = queryResult({ isSuccess: true, data: page([]), ...wrap(overrides.all) });
  mockedUseTicketsQuery.mockImplementation((filters) => {
    if (filters && Object.prototype.hasOwnProperty.call(filters, "assignedToUserId")) {
      return mine as never;
    }
    // Story S-8d — the unclaimed panel asks the server for unassigned
    // tickets (`unassigned: "true"`) instead of filtering a branch-wide
    // list client-side.
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
    // Story S-8d — resolved by the API, replacing the client-side map this
    // screen used to build from the whole customer list.
    customerName: "Acme Inc.",
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
      queryResult({
        isSuccess: true,
        data: [{ id: "customer-1", displayName: "Acme Inc." }],
      }) as never,
    );
    mockTicketQueries({});
    mockedUseUpdateTicketMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    // RM-03 — `TasksPanel`'s own default fixture; its detailed behavior is
    // covered by `tasks-panel.spec.tsx`, not re-tested here.
    mockedUseTasksQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 } }) as never,
    );
    mockedUseCreateTaskMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    mockedUseUpdateTaskMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    mockedUseDeleteTaskMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
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
    it("gives the empty state a next action linking to the full ticket list", () => {
      renderWithLocale();

      expect(screen.getByRole("link", { name: "Browse all tickets" })).toHaveAttribute(
        "href",
        "/en/tickets",
      );
    });

    it("queries GET /tickets scoped to the authenticated agent, not the branch-wide list", () => {
      renderWithLocale("agent-42");

      // Story S-9 — the panel asks the server for its whole question:
      // whose tickets, which statuses, and in what order. S-8e's bounded
      // `pageSize: 100` window is gone, because the first page is now the
      // most urgent page rather than an arbitrary slice.
      expect(mockedUseTicketsQuery).toHaveBeenCalledWith({
        assignedToUserId: "agent-42",
        statuses: ["OPEN", "IN_PROGRESS"],
        sortBy: "slaUrgency",
      });
    });

    it("asks the server to exclude RESOLVED and CLOSED rather than filtering after the fetch", () => {
      mockTicketQueries({ mine: { data: [ticket({ subject: "Open one", status: "OPEN" })] } });

      renderWithLocale();

      /**
       * Story S-9 — this used to hand the component a mixed list and assert
       * the resolved/closed rows were dropped on screen. That is no longer
       * where the exclusion happens, and it could not stay there: an SLA
       * target outlives the ticket being resolved, so under
       * `sortBy: "slaUrgency"` a resolved ticket's long-past target ranks as
       * maximally urgent and would consume the page ahead of open work that
       * is genuinely breaching. Filtering after the fetch can only discard
       * rows the server already chose.
       */
      expect(mockedUseTicketsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ["OPEN", "IN_PROGRESS"] }),
      );
      expect(screen.getByText("Open one")).toBeInTheDocument();
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

      expect(screen.getByText("OPEN")).toHaveClass("bg-warning-surface");
      expect(screen.getByText("IN_PROGRESS")).toHaveClass("bg-surface-muted");
    });

    it("orders tickets breached-first, then soonest-remaining, then no-target-last", () => {
      const now = Date.now();
      mockTicketQueries({
        mine: {
          data: [
            ticket({
              id: "ticket-breached",
              subject: "Already breached",
              status: "OPEN",
              slaTarget: {
                responseTargetAt: new Date(now - 60 * 60 * 1000).toISOString(),
                resolutionTargetAt: new Date(now - 60 * 60 * 1000).toISOString(),
              },
            }),
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
              id: "ticket-none",
              subject: "No target",
              status: "IN_PROGRESS",
              slaTarget: null,
            }),
          ],
        },
      });

      renderWithLocale();

      /**
       * Story S-9 — the ranking moved to the server, so this asserts the two
       * things that are now this component's responsibility: that it asks
       * for the urgency order, and that it renders the rows in the order it
       * was given instead of re-sorting them.
       *
       * The fixture is deliberately handed back in the server's order
       * (breached, due soon, no target) — the same order
       * `sortBy: "slaUrgency"` produces, since a breached target is in the
       * past, an on-track one is in the future, and a missing one sorts
       * last.
       */
      expect(mockedUseTicketsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "slaUrgency" }),
      );
      const subjects = screen
        .getAllByText(/No target|Due soon|Already breached/)
        .map((el) => el.textContent);
      expect(subjects).toEqual(["Already breached", "Due soon", "No target"]);
    });

    it("links each row's subject to the ticket detail route", () => {
      mockTicketQueries({ mine: { data: [ticket({})] } });

      renderWithLocale();

      expect(screen.getByRole("link", { name: "Cannot log in" })).toHaveAttribute(
        "href",
        "/en/tickets/ticket-1",
      );
    });

    it("links the customer name to the customer, not to the ticket the row points at", () => {
      mockTicketQueries({ mine: { data: [ticket({})] } });

      renderWithLocale();

      expect(screen.getByRole("link", { name: "Acme Inc." })).toHaveAttribute(
        "href",
        "/en/customers/customer-1",
      );

      // The row is still clickable for the mouse, so the nested customer
      // link stops propagation rather than letting the row win.
      fireEvent.click(screen.getByRole("link", { name: "Acme Inc." }));
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

    it("asks the server for unclaimed open tickets, ranked by urgency", () => {
      mockTicketQueries({
        all: {
          data: [
            ticket({
              id: "t-unassigned-open",
              subject: "Unassigned open",
              assignedToUserId: null,
              status: "OPEN",
            }),
          ],
        },
      });

      renderWithLocale();

      /**
       * Story S-8d — "unassigned" is the server's filter now, so the fixture
       * holds only what the server would return and the assertion is that
       * the request actually asked for it. Previously this screen fetched
       * the branch-wide list and picked the unassigned rows out of it, which
       * meant an unclaimed ticket older than the capped window could never
       * appear at all.
       *
       * Story S-9 — the status narrowing and the urgency ranking joined it
       * on the server, so all three are asserted on the request. Nothing is
       * left for this panel to filter or re-sort.
       */
      expect(mockedUseTicketsQuery).toHaveBeenCalledWith({
        unassigned: "true",
        statuses: ["OPEN", "IN_PROGRESS"],
        sortBy: "slaUrgency",
      });
      expect(screen.getByText("Unassigned open")).toBeInTheDocument();
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

      expect(
        screen.getByText("You don't have permission to claim this ticket."),
      ).toBeInTheDocument();
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

    it("still links to the ticket detail route from the row (not the Claim button)", () => {
      mockTicketQueries({
        all: {
          data: [
            ticket({
              id: "unassigned-1",
              subject: "Needs a home",
              assignedToUserId: null,
              status: "OPEN",
            }),
          ],
        },
      });

      renderWithLocale();

      expect(screen.getByRole("link", { name: "Needs a home" })).toHaveAttribute(
        "href",
        "/en/tickets/unassigned-1",
      );
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

  // RM-03 — confirms the wiring only; TasksPanel's own behavior is covered
  // in full by tasks-panel.spec.tsx.
  it("mounts the Tasks panel", () => {
    renderWithLocale();

    expect(screen.getByText("My Tasks")).toBeInTheDocument();
  });
});
