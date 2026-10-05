import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketsView } from "./tickets-view";

const replace = vi.fn();
let searchParamsString = "";
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/en/tickets",
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/tickets/ticket-list-view", () => ({
  TicketListView: ({ viewSwitcher }: { viewSwitcher: React.ReactNode }) => (
    <div data-testid="list">{viewSwitcher}</div>
  ),
}));
vi.mock("@/components/tickets/board/ticket-board-view", () => ({
  TicketBoardView: ({ viewSwitcher }: { viewSwitcher: React.ReactNode }) => (
    <div data-testid="board">{viewSwitcher}</div>
  ),
}));

/** Story 216 (PR-3.1, decision PD-3) — board by default, list on request. */
beforeEach(() => {
  vi.clearAllMocks();
  searchParamsString = "";
  window.localStorage.clear();
});

describe("TicketsView", () => {
  it("opens on the board by default", () => {
    render(<TicketsView />);
    expect(screen.getByTestId("board")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "views.board" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("honours ?view=list, and the URL wins over the remembered choice", () => {
    window.localStorage.setItem("crm.tickets.view", "board");
    searchParamsString = "view=list";
    render(<TicketsView />);
    expect(screen.getByTestId("list")).toBeInTheDocument();
  });

  it("remembers the last choice when the URL has none", () => {
    window.localStorage.setItem("crm.tickets.view", "list");
    render(<TicketsView />);
    expect(screen.getByTestId("list")).toBeInTheDocument();
  });

  it("switches views from the segmented control, remembering and reflecting it in the URL", async () => {
    const user = userEvent.setup();
    render(<TicketsView />);
    await user.click(screen.getByRole("radio", { name: "views.list" }));
    expect(window.localStorage.getItem("crm.tickets.view")).toBe("list");
    expect(replace.mock.calls.at(-1)?.[0]).toBe("/en/tickets?view=list");
    expect(screen.getByTestId("list")).toBeInTheDocument();
  });
});
