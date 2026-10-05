import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTicketCsatQuery } from "./use-tickets";
import { getTicketCsat } from "@/lib/tickets-api";

vi.mock("@/lib/tickets-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets-api")>()),
  getTicketCsat: vi.fn(),
}));

/**
 * Story 219 — a ticket without feedback (`204 No Content` → `undefined`) is
 * a successful, empty result, not a load error: TanStack Query v5 rejects
 * `undefined` data, which had turned every such ticket's CSAT section red.
 */
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useTicketCsatQuery", () => {
  it("treats no feedback yet as an empty success", async () => {
    vi.mocked(getTicketCsat).mockResolvedValue(undefined);
    const { result } = renderHook(() => useTicketCsatQuery("ticket-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("returns submitted feedback as it is", async () => {
    const csat = { rating: 5, comment: "Great", submittedAt: "2026-10-05T10:00:00Z" };
    vi.mocked(getTicketCsat).mockResolvedValue(csat as never);
    const { result } = renderHook(() => useTicketCsatQuery("ticket-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(csat);
  });
});
