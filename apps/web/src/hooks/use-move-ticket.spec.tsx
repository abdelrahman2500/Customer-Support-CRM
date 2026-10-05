import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMoveTicketMutation } from "./use-move-ticket";
import { getTicket, updateTicket, type TicketListItem } from "@/lib/tickets-api";
import { ApiError } from "@/lib/api";
import type { ColumnPages } from "@/components/tickets/board/board-moves";

vi.mock("@/lib/tickets-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets-api")>()),
  updateTicket: vi.fn(),
  getTicket: vi.fn(),
}));

/** Story 217 (PR-3.2, tickets-kanban-ux.md §5 "Data flow") — optimistic moves. */
const filters = { sort: "slaUrgency" as const };
const openKey = ["tickets", "board", "OPEN", filters];
const progressKey = ["tickets", "board", "IN_PROGRESS", filters];

function card(id: string, status: TicketListItem["status"]): TicketListItem {
  return {
    id,
    subject: id,
    status,
    priority: "MEDIUM",
    createdAt: "2026-10-05T08:00:00Z",
    updatedAt: "2026-10-05T08:00:00Z",
    slaTarget: null,
  } as TicketListItem;
}

function column(items: TicketListItem[], total: number): ColumnPages {
  return { pageParams: [1], pages: [{ items, total, page: 1, pageSize: 25, totalPages: 1 }] };
}

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const idsOf = (key: unknown[]) =>
  client.getQueryData<ColumnPages>(key)!.pages[0]!.items.map((item) => item.id);
const totalOf = (key: unknown[]) => client.getQueryData<ColumnPages>(key)!.pages[0]!.total;

beforeEach(() => {
  vi.clearAllMocks();
  // By default the server still has what the card showed: no collision.
  vi.mocked(getTicket).mockImplementation(async (id) =>
    card(id, id === "c" ? "IN_PROGRESS" : "OPEN"),
  );
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(openKey, column([card("a", "OPEN"), card("b", "OPEN")], 2));
  client.setQueryData(progressKey, column([card("c", "IN_PROGRESS")], 1));
});

describe("useMoveTicketMutation", () => {
  it("reports a collision when someone else changed the ticket since the board loaded (Story 218)", async () => {
    vi.mocked(updateTicket).mockResolvedValue({ id: "a" });
    const { result } = renderHook(() => useMoveTicketMutation(), { wrapper });
    act(() => result.current.mutate({ ticket: card("a", "OPEN"), to: "IN_PROGRESS" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ collided: false });

    vi.mocked(getTicket).mockResolvedValue({ ...card("a", "RESOLVED") });
    act(() => result.current.mutate({ ticket: card("a", "OPEN"), to: "IN_PROGRESS" }));
    await waitFor(() => expect(result.current.data).toEqual({ collided: true }));
    // Last write wins: the move is still sent.
    expect(updateTicket).toHaveBeenLastCalledWith("a", { status: "IN_PROGRESS" });
  });

  it("moves the card between the cached columns at once and sends the status PATCH", async () => {
    let resolve!: (value: { id: string }) => void;
    vi.mocked(updateTicket).mockReturnValue(new Promise((r) => (resolve = r)));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMoveTicketMutation(), { wrapper });

    act(() => result.current.mutate({ ticket: card("a", "OPEN"), to: "IN_PROGRESS" }));
    await waitFor(() => expect(idsOf(progressKey)).toContain("a"));
    expect(idsOf(openKey)).toEqual(["b"]);
    expect(totalOf(openKey)).toBe(1);
    expect(totalOf(progressKey)).toBe(2);
    expect(updateTicket).toHaveBeenCalledWith("a", { status: "IN_PROGRESS" });

    await act(async () => resolve({ id: "a" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tickets"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ticket", "a"] });
  });

  it("rolls both columns back when the PATCH fails", async () => {
    vi.mocked(updateTicket).mockRejectedValue(new ApiError("Forbidden", 403));
    const { result } = renderHook(() => useMoveTicketMutation(), { wrapper });
    act(() => result.current.mutate({ ticket: card("a", "OPEN"), to: "IN_PROGRESS" }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(idsOf(openKey)).toEqual(["a", "b"]);
    expect(idsOf(progressKey)).toEqual(["c"]);
    expect(totalOf(openKey)).toBe(2);
  });

  it("drops the card everywhere when the ticket no longer exists (404)", async () => {
    vi.mocked(updateTicket).mockRejectedValue(new ApiError("Not found", 404));
    const { result } = renderHook(() => useMoveTicketMutation(), { wrapper });
    act(() => result.current.mutate({ ticket: card("a", "OPEN"), to: "IN_PROGRESS" }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(idsOf(openKey)).toEqual(["b"]);
    expect(idsOf(progressKey)).toEqual(["c"]);
  });
});
