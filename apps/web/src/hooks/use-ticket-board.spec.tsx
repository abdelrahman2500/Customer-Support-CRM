import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BOARD_REFRESH_MS, useTicketBoardColumnQuery } from "./use-ticket-board";
import { listTickets } from "@/lib/tickets-api";

vi.mock("@/lib/tickets-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets-api")>()),
  listTickets: vi.fn(),
}));

/** Story 218 (PR-3.3, tickets-kanban-ux.md §6) — board freshness without realtime. */
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const filters = { sort: "slaUrgency" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(listTickets).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  });
  // The app's provider turns focus refetching off globally; the board opts in.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
});

afterEach(() => {
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe("useTicketBoardColumnQuery freshness", () => {
  it("refetches every 30 seconds while the tab is visible", async () => {
    renderHook(() => useTicketBoardColumnQuery("OPEN", filters), { wrapper });
    await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(1));
    await act(async () => vi.advanceTimersByTime(BOARD_REFRESH_MS + 50));
    await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(2));
  });

  it("does not refetch in the background, and refetches when the window regains focus", async () => {
    renderHook(() => useTicketBoardColumnQuery("OPEN", filters), { wrapper });
    await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(1));
    act(() => focusManager.setFocused(false));
    await act(async () => vi.advanceTimersByTime(BOARD_REFRESH_MS * 2 + 50));
    expect(listTickets).toHaveBeenCalledTimes(1);
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(2));
  });

  it("holds refetching while a card is being dragged", async () => {
    renderHook(() => useTicketBoardColumnQuery("OPEN", filters, { paused: true }), { wrapper });
    await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(1));
    await act(async () => vi.advanceTimersByTime(BOARD_REFRESH_MS * 2 + 50));
    expect(listTickets).toHaveBeenCalledTimes(1);
  });
});
