import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TicketNeighbours,
  parseListFilters,
  ticketContextOf,
  ticketHref,
  ticketsBackHref,
} from "./ticket-neighbours";
import { useTicketsQuery } from "@/hooks/use-tickets";
import { useTicketBoardColumnQuery } from "@/hooks/use-ticket-board";
import type { TicketListItem } from "@/lib/tickets-api";

let searchParamsString = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));
vi.mock("@/hooks/use-tickets", () => ({ useTicketsQuery: vi.fn() }));
vi.mock("@/hooks/use-ticket-board", () => ({ useTicketBoardColumnQuery: vi.fn() }));

/** Story 220 (PR-3.5, RD-3.14 minus shortcuts) — previous/next in the view's order. */
const item = (id: string) => ({ id, subject: `Subject ${id}` }) as TicketListItem;

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsString = "";
  vi.mocked(useTicketBoardColumnQuery).mockReturnValue({
    data: {
      pages: [
        {
          items: [item("a"), item("b"), item("c")],
          total: 12,
          page: 1,
          pageSize: 25,
          totalPages: 1,
        },
      ],
    },
  } as never);
  vi.mocked(useTicketsQuery).mockReturnValue({
    data: { items: [item("x"), item("y")], total: 30, page: 2, pageSize: 25, totalPages: 2 },
  } as never);
});

describe("ticket context", () => {
  it("puts the view and its filters on the ticket link, and reads them back", () => {
    const href = ticketHref("en", "t1", {
      from: "board",
      query: new URLSearchParams("view=board&search=vat&sort=newest"),
    });
    expect(href).toBe("/en/tickets/t1?from=board&search=vat&sort=newest");
    const context = ticketContextOf(new URLSearchParams(href.split("?")[1]));
    expect(context?.from).toBe("board");
    expect(context?.query.toString()).toBe("search=vat&sort=newest");
    expect(ticketHref("en", "t1")).toBe("/en/tickets/t1");
    expect(ticketContextOf(new URLSearchParams("from=elsewhere"))).toBeNull();
  });

  it("sends Back to the same view and filters", () => {
    expect(ticketsBackHref("en", new URLSearchParams("from=list&status=OPEN&page=2"))).toBe(
      "/en/tickets?view=list&status=OPEN&page=2",
    );
    expect(ticketsBackHref("ar", new URLSearchParams(""))).toBe("/ar/tickets");
  });

  it("parses the list's URL with its defaults", () => {
    expect(parseListFilters(new URLSearchParams("status=OPEN&page=3"))).toEqual({
      sortBy: "createdAt",
      sortDir: "desc",
      status: "OPEN",
      page: 3,
    });
  });
});

describe("TicketNeighbours", () => {
  it("shows nothing without a context (a shared link, a notification)", () => {
    const { container } = render(<TicketNeighbours ticketId="b" status="OPEN" locale="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links the board column's previous and next card, keeping the context", () => {
    searchParamsString = "from=board&search=vat";
    render(<TicketNeighbours ticketId="b" status="OPEN" locale="en" />);

    expect(useTicketBoardColumnQuery).toHaveBeenCalledWith(
      "OPEN",
      expect.objectContaining({ search: "vat" }),
    );
    expect(screen.getByRole("navigation", { name: "label" })).toHaveTextContent(
      'position:{"index":2,"total":12}',
    );
    expect(screen.getByRole("link", { name: 'previous:{"subject":"Subject a"}' })).toHaveAttribute(
      "href",
      "/en/tickets/a?from=board&search=vat",
    );
    expect(screen.getByRole("link", { name: 'next:{"subject":"Subject c"}' })).toHaveAttribute(
      "href",
      "/en/tickets/c?from=board&search=vat",
    );
  });

  it("disables the arrow at either end", () => {
    searchParamsString = "from=board";
    render(<TicketNeighbours ticketId="a" status="OPEN" locale="en" />);
    expect(screen.getByRole("button", { name: "previousNone" })).toBeDisabled();
    expect(screen.getByRole("link", { name: /next:/ })).toBeInTheDocument();
  });

  it("counts the list position across pages", () => {
    searchParamsString = "from=list&page=2";
    render(<TicketNeighbours ticketId="y" status="OPEN" locale="en" />);
    expect(screen.getByRole("navigation")).toHaveTextContent('position:{"index":27,"total":30}');
    expect(screen.getByRole("link", { name: /previous:/ })).toHaveAttribute(
      "href",
      "/en/tickets/x?from=list&page=2",
    );
  });

  it("shows nothing when the ticket is not in the loaded order", () => {
    searchParamsString = "from=board";
    const { container } = render(<TicketNeighbours ticketId="zzz" status="OPEN" locale="en" />);
    expect(container).toBeEmptyDOMElement();
  });
});
