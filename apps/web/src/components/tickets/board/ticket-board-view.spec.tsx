import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketBoardView } from "./ticket-board-view";
import { useTicketBoardColumnQuery } from "@/hooks/use-ticket-board";
import { useCurrentUserQuery, useUsersQuery } from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import type { TicketListItem, TicketStatus } from "@/lib/tickets-api";

const replace = vi.fn();
let searchParamsString = "";
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/en/tickets",
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));
vi.mock("@/hooks/use-ticket-board", () => ({ useTicketBoardColumnQuery: vi.fn() }));
vi.mock("@/hooks/use-tickets", () => ({ useCurrentUserQuery: vi.fn(), useUsersQuery: vi.fn() }));
vi.mock("@/hooks/use-ticket-categories", () => ({ useTicketCategoriesQuery: vi.fn() }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useIsFetching: () => 0,
}));
const mutate = vi.fn();
vi.mock("@/hooks/use-move-ticket", () => ({ useMoveTicketMutation: () => ({ mutate }) }));
vi.mock("@/hooks/use-error-message", () => ({
  useErrorMessage: () => (error: unknown, copy: { forbidden: string; generic: string }) =>
    (error as { status?: number }).status === 403 ? copy.forbidden : copy.generic,
}));

/** Story 216 (PR-3.1, tickets-kanban-ux.md) — the board view. */
function card(id: string, status: TicketStatus, subject: string): TicketListItem {
  return {
    id,
    subject,
    status,
    priority: "MEDIUM",
    categoryId: null,
    categoryName: null,
    customerId: "c1",
    customerName: "Desert Rose Hotels",
    contactId: null,
    departmentId: null,
    assignedToUserId: null,
    createdAt: "2026-10-05T08:00:00Z",
    updatedAt: "2026-10-05T09:00:00Z",
    slaTarget: null,
  } as TicketListItem;
}

type ColumnState = { items?: TicketListItem[]; total?: number; error?: boolean; pending?: boolean };
let columns: Partial<Record<TicketStatus, ColumnState>> = {};
const fetchNextPage = vi.fn();
const refetch = vi.fn();

function mockColumns() {
  vi.mocked(useTicketBoardColumnQuery).mockImplementation((status) => {
    const state = columns[status] ?? { items: [] };
    return {
      data:
        state.pending || state.error
          ? undefined
          : {
              pages: [
                {
                  items: state.items ?? [],
                  total: state.total ?? state.items?.length ?? 0,
                  page: 1,
                  pageSize: 25,
                  totalPages: 1,
                },
              ],
            },
      isPending: !!state.pending,
      isError: !!state.error,
      isFetchingNextPage: false,
      fetchNextPage,
      refetch,
    } as never;
  });
}

function setDesktop(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: desktop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsString = "";
  window.localStorage.clear();
  setDesktop(true);
  columns = {
    OPEN: { items: [card("t1", "OPEN", "Invoice shows the old price")], total: 42 },
    IN_PROGRESS: { items: [card("t2", "IN_PROGRESS", "Webhook deliveries failing")], total: 31 },
    RESOLVED: { items: [], total: 0 },
    CLOSED: { items: [card("t3", "CLOSED", "Old shipment")], total: 5 },
  };
  mockColumns();
  vi.mocked(useCurrentUserQuery).mockReturnValue({ data: { id: "me" } } as never);
  vi.mocked(useUsersQuery).mockReturnValue({
    data: [{ id: "me", fullName: "Sara Al-Harbi" }],
  } as never);
  vi.mocked(useTicketCategoriesQuery).mockReturnValue({ data: [] } as never);
});

describe("TicketBoardView", () => {
  it("renders one titled page with four status columns in order, each with its count", () => {
    render(<TicketBoardView />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const board = screen.getByRole("region", { name: "boardLabel" });
    const names = within(board)
      .getAllByRole("region")
      .map((column) => column.getAttribute("aria-label"));
    expect(names).toEqual([
      'columnLabel:{"status":"ticketStatus.OPEN","count":42}',
      'columnLabel:{"status":"ticketStatus.IN_PROGRESS","count":31}',
      'columnLabel:{"status":"ticketStatus.RESOLVED","count":0}',
      'columnLabel:{"status":"ticketStatus.CLOSED","count":5}',
    ]);
    expect(screen.getByRole("link", { name: "Invoice shows the old price" })).toBeInTheDocument();
  });

  it("sums the column totals into a polite summary", () => {
    render(<TicketBoardView />);
    // Story 217: dnd-kit adds its own (empty) role=status region, so the
    // summary is found by its text and must still sit in a status region.
    expect(screen.getByText('summary:{"count":78}').closest('[role="status"]')).not.toBeNull();
  });

  it("folds the Closed column by default and remembers it when expanded", () => {
    render(<TicketBoardView />);
    expect(screen.queryByRole("link", { name: "Old shipment" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /expandColumn/ }));
    expect(screen.getByRole("link", { name: "Old shipment" })).toBeInTheDocument();
    expect(window.localStorage.getItem("crm.tickets.board.closedCollapsed")).toBe("false");
  });

  it("shows each column's own empty message, error with retry and Show more", () => {
    columns.RESOLVED = { items: [], total: 0 };
    columns.IN_PROGRESS = { error: true };
    columns.OPEN = { items: [card("t1", "OPEN", "A")], total: 42 };
    mockColumns();
    render(<TicketBoardView />);

    expect(screen.getByText("empty.RESOLVED")).toBeInTheDocument();
    expect(screen.getByText(/columnError/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(refetch).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: 'showMore:{"count":25}' }));
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it("puts quick views and filters in the URL, keeping the list's search behaviour", async () => {
    const user = userEvent.setup();
    render(<TicketBoardView />);

    await user.click(screen.getByRole("radio", { name: "quick.mine" }));
    await vi.waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(
        expect.stringContaining("assignedToUserId=me"),
        expect.anything(),
      ),
    );

    const search = screen.getByPlaceholderText("searchPlaceholder");
    fireEvent.change(search, { target: { value: "invoice" } });
    fireEvent.blur(search);
    await vi.waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(
        expect.stringContaining("search=invoice"),
        expect.anything(),
      ),
    );
  });

  it("replaces the board with one empty state when filters match nothing", () => {
    searchParamsString = "search=nothing";
    columns = {
      OPEN: { items: [], total: 0 },
      IN_PROGRESS: { items: [], total: 0 },
      RESOLVED: { items: [], total: 0 },
      CLOSED: { items: [], total: 0 },
    };
    mockColumns();
    render(<TicketBoardView />);
    expect(screen.getByText("filteredEmpty")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "boardLabel" })).not.toBeInTheDocument();
  });

  it("scopes the At risk view to the loaded cards that are breached or at risk", () => {
    searchParamsString = "risk=1";
    const breached = {
      ...card("t9", "OPEN", "Breached one"),
      slaTarget: {
        responseTargetAt: "2020-01-01T00:00:00Z",
        resolutionTargetAt: "2020-01-02T00:00:00Z",
        onHoldSince: null,
      },
    } as TicketListItem;
    columns.OPEN = { items: [card("t1", "OPEN", "Calm one"), breached], total: 2 };
    mockColumns();
    render(<TicketBoardView />);
    expect(screen.getByRole("link", { name: "Breached one" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Calm one" })).not.toBeInTheDocument();
  });

  it("shows one column at a time on phones, chosen with a status switcher", async () => {
    setDesktop(false);
    const user = userEvent.setup();
    render(<TicketBoardView />);

    const switcher = screen.getByRole("radiogroup", { name: "columnSwitcher" });
    expect(within(switcher).getAllByRole("radio")).toHaveLength(4);
    const openColumn = screen.getByRole("region", { name: /ticketStatus\.OPEN/ });
    const progressColumn = screen.getByRole("region", { name: /ticketStatus\.IN_PROGRESS/ });
    expect(openColumn).not.toHaveClass("hidden");
    expect(progressColumn).toHaveClass("hidden");

    await user.click(within(switcher).getByRole("radio", { name: /ticketStatus\.IN_PROGRESS/ }));
    expect(screen.getByRole("region", { name: /ticketStatus\.IN_PROGRESS/ })).not.toHaveClass(
      "hidden",
    );
    // Closed is shown unfolded on phones.
    await user.click(within(switcher).getByRole("radio", { name: /ticketStatus\.CLOSED/ }));
    expect(screen.getByRole("link", { name: "Old shipment" })).toBeInTheDocument();
  });
});

/** Story 217 (PR-3.2, tickets-kanban-ux.md §5) — moving cards. */
describe("TicketBoardView moves", () => {
  const liveRegion = () => document.querySelector('[aria-live="polite"][aria-atomic="true"]')!;

  async function openMenu(user: ReturnType<typeof userEvent.setup>, subject: string) {
    await user.click(
      screen.getByRole("button", { name: `cardActions:${JSON.stringify({ subject })}` }),
    );
    return screen.getByRole("menu");
  }

  it("offers the other statuses in the card's Move to menu and moves Open → In progress at once", async () => {
    const user = userEvent.setup();
    render(<TicketBoardView />);
    const menu = await openMenu(user, "Invoice shows the old price");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["ticketStatus.IN_PROGRESS", "ticketStatus.RESOLVED", "ticketStatus.CLOSED"]);
    await user.click(within(menu).getByRole("menuitem", { name: "ticketStatus.IN_PROGRESS" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [input, options] = mutate.mock.calls[0]!;
    expect(input).toMatchObject({ ticket: { id: "t1" }, to: "IN_PROGRESS" });
    options.onSuccess();
    await vi.waitFor(() => expect(liveRegion()).toHaveTextContent(/announce\.moved/));
  });

  it("asks before resolving, with focus on Resolve; Cancel sends nothing and announces it", async () => {
    const user = userEvent.setup();
    render(<TicketBoardView />);
    await user.click(
      within(await openMenu(user, "Invoice shows the old price")).getByRole("menuitem", {
        name: "ticketStatus.RESOLVED",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("confirm.RESOLVED.question");
    expect(dialog).toHaveTextContent("confirm.notified");
    await vi.waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "confirm.RESOLVED.action" })).toHaveFocus(),
    );
    await user.click(within(dialog).getByRole("button", { name: "confirm.cancel" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent("announce.cancelled");
  });

  it("closes the confirm on Escape without a request, and moves on confirm", async () => {
    const user = userEvent.setup();
    render(<TicketBoardView />);
    await user.click(
      within(await openMenu(user, "Webhook deliveries failing")).getByRole("menuitem", {
        name: "ticketStatus.CLOSED",
      }),
    );
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    await user.click(
      within(await openMenu(user, "Webhook deliveries failing")).getByRole("menuitem", {
        name: "ticketStatus.CLOSED",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "confirm.CLOSED.action" }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ ticket: expect.objectContaining({ id: "t2" }), to: "CLOSED" }),
      expect.anything(),
    );
  });

  it("explains a failed move by its error and announces it", async () => {
    const user = userEvent.setup();
    render(<TicketBoardView />);
    await user.click(
      within(await openMenu(user, "Invoice shows the old price")).getByRole("menuitem", {
        name: "ticketStatus.IN_PROGRESS",
      }),
    );
    const [, options] = mutate.mock.calls[0]!;
    options.onError(Object.assign(new Error("nope"), { status: 403 }));
    await vi.waitFor(() =>
      expect(liveRegion()).toHaveTextContent(/announce\.failed.*moveErrors\.forbidden/),
    );
  });

  it("gives desktop cards a named drag handle, and phones only the menu — following the moved card", async () => {
    const { unmount } = render(<TicketBoardView />);
    expect(
      screen.getByRole("button", {
        name: `moveHandle:${JSON.stringify({ subject: "Invoice shows the old price" })}`,
      }),
    ).toBeInTheDocument();
    unmount();

    setDesktop(false);
    const user = userEvent.setup();
    render(<TicketBoardView />);
    expect(screen.queryByRole("button", { name: /moveHandle/ })).not.toBeInTheDocument();
    await user.click(
      within(await openMenu(user, "Invoice shows the old price")).getByRole("menuitem", {
        name: "ticketStatus.IN_PROGRESS",
      }),
    );
    const switcher = screen.getByRole("radiogroup", { name: "columnSwitcher" });
    expect(
      within(switcher).getByRole("radio", { name: /ticketStatus\.IN_PROGRESS/ }),
    ).toBeChecked();
  });
});
