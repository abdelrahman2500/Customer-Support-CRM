import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortalHomeView } from "./portal-home-view";
import { useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import { usePublishedArticlesQuery } from "@/hooks/use-portal-knowledge-base";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-tickets", () => ({
  useMyTicketsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-portal-knowledge-base", () => ({
  usePublishedArticlesQuery: vi.fn(),
}));

const mockedUseMyTicketsQuery = vi.mocked(useMyTicketsQuery);
const mockedUsePublishedArticlesQuery = vi.mocked(usePublishedArticlesQuery);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    isSuccess: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

/** Mirrors `ticket-list-view.spec.tsx`'s own `ticketPage()` helper: both
 * queries resolve a `PaginatedResponse<T>` envelope, not a flat array. */
function page(items: unknown[], overrides: Record<string, unknown> = {}) {
  return { items, total: items.length, page: 1, pageSize: 25, totalPages: 1, ...overrides };
}

function ticket(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    subject: `Subject ${id}`,
    categoryId: null,
    categoryName: null,
    priority: "MEDIUM",
    status: "OPEN",
    customerId: "customer-1",
    contactId: "contact-1",
    departmentId: null,
    assignedToUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function article(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    branchId: "branch-1",
    title: `Article ${id}`,
    body: "body",
    categoryId: null,
    categoryName: null,
    status: "PUBLISHED",
    publishedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Both panels idle-successful-and-empty, so a test can override just the one
 * it is about without the other panel's branches interfering. */
function bothEmpty() {
  mockedUseMyTicketsQuery.mockReturnValue(
    queryResult({ data: page([]), isSuccess: true }) as never,
  );
  mockedUsePublishedArticlesQuery.mockReturnValue(
    queryResult({ data: page([]), isSuccess: true }) as never,
  );
}

/**
 * Story 136 — the portal's real landing page.
 *
 * Assertions are on translation KEYS, not English copy: the mocked
 * `useTranslations` above returns the key it is given, which is the
 * convention every other portal component spec in this app follows.
 */
describe("PortalHomeView (Story 136)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bothEmpty();
  });

  it("renders no placeholder copy", () => {
    render(<PortalHomeView />);

    expect(screen.queryByText("placeholder")).not.toBeInTheDocument();
  });

  it("renders the welcome heading as the page's only h1, with panel h2s below", () => {
    render(<PortalHomeView />);

    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("welcomeHeading");
    expect(screen.getByRole("heading", { level: 2, name: "tickets.heading" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "knowledgeBase.heading" }),
    ).toBeInTheDocument();
  });

  it("does not render an unread-notification count", () => {
    render(<PortalHomeView />);

    // Deliberately absent — PortalHeader already shows it on every page.
    expect(screen.queryByText(/unread/i)).not.toBeInTheDocument();
  });

  describe("ticket panel", () => {
    it("renders a skeleton while pending", () => {
      mockedUseMyTicketsQuery.mockReturnValue(queryResult({ isPending: true }) as never);

      const { container } = render(<PortalHomeView />);

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders the shared error copy and retries on click", () => {
      const refetch = vi.fn();
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({ isError: true, refetch }) as never,
      );

      render(<PortalHomeView />);
      expect(screen.getByText("list.error")).toBeInTheDocument();

      fireEvent.click(screen.getByText("list.retry"));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it("renders the empty copy, and not the error copy, for a customer with no tickets", () => {
      render(<PortalHomeView />);

      expect(screen.getByText("tickets.empty")).toBeInTheDocument();
      expect(screen.queryByText("list.error")).not.toBeInTheDocument();
    });

    it("caps the list at 5 rows and reports the envelope's own total", () => {
      const items = ["t1", "t2", "t3", "t4", "t5", "t6", "t7"].map((id) => ticket(id));
      mockedUseMyTicketsQuery.mockReturnValue(
        // `total` deliberately larger than `items.length`: the figure shown
        // must come from the envelope, never from the sliced list.
        queryResult({ data: page(items, { total: 42, totalPages: 2 }), isSuccess: true }) as never,
      );

      render(<PortalHomeView />);

      expect(screen.getByText("Subject t5")).toBeInTheDocument();
      expect(screen.queryByText("Subject t6")).not.toBeInTheDocument();
      expect(screen.queryByText("Subject t7")).not.toBeInTheDocument();
      expect(screen.getByText("tickets.total")).toBeInTheDocument();
    });

    it("links each ticket to its existing detail route and badges its status", () => {
      mockedUseMyTicketsQuery.mockReturnValue(
        queryResult({
          data: page([ticket("ticket-1", { status: "RESOLVED" })]),
          isSuccess: true,
        }) as never,
      );

      render(<PortalHomeView />);

      expect(screen.getByText("Subject ticket-1").closest("a")).toHaveAttribute(
        "href",
        "/en/tickets/ticket-1",
      );
      expect(screen.getByText("RESOLVED")).toBeInTheDocument();
    });
  });

  describe("knowledge-base panel", () => {
    it("renders a skeleton while pending", () => {
      mockedUsePublishedArticlesQuery.mockReturnValue(queryResult({ isPending: true }) as never);

      const { container } = render(<PortalHomeView />);

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders the shared error copy and retries on click", () => {
      const refetch = vi.fn();
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({ isError: true, refetch }) as never,
      );

      render(<PortalHomeView />);
      expect(screen.getByText("list.error")).toBeInTheDocument();

      fireEvent.click(screen.getByText("list.retry"));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it("renders the empty copy when nothing is published", () => {
      render(<PortalHomeView />);

      expect(screen.getByText("list.empty")).toBeInTheDocument();
    });

    it("caps the list at 5 articles", () => {
      const items = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"].map((id) => article(id));
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({ data: page(items, { total: 7 }), isSuccess: true }) as never,
      );

      render(<PortalHomeView />);

      expect(screen.getByText("Article a5")).toBeInTheDocument();
      expect(screen.queryByText("Article a6")).not.toBeInTheDocument();
      expect(screen.queryByText("Article a7")).not.toBeInTheDocument();
    });

    it("links each article to its existing detail route", () => {
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({ data: page([article("kb-1")]), isSuccess: true }) as never,
      );

      render(<PortalHomeView />);

      expect(screen.getByText("Article kb-1").closest("a")).toHaveAttribute(
        "href",
        "/en/knowledge-base/kb-1",
      );
    });
  });

  it("renders each panel independently — one failing does not blank the other", () => {
    mockedUseMyTicketsQuery.mockReturnValue(queryResult({ isError: true }) as never);
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: page([article("kb-1")]), isSuccess: true }) as never,
    );

    render(<PortalHomeView />);

    expect(screen.getByText("list.error")).toBeInTheDocument();
    expect(screen.getByText("Article kb-1")).toBeInTheDocument();
  });

  it("links to the four existing portal destinations and adds no new route", () => {
    render(<PortalHomeView />);

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => href !== null);

    expect(hrefs).toContain("/en/tickets");
    expect(hrefs).toContain("/en/knowledge-base");
    expect(hrefs).toContain("/en/chat");
    expect(hrefs).toContain("/en/notifications");
    // Every destination is one that already existed before this story.
    const known = /^\/en\/(tickets|knowledge-base|chat|notifications)(\/|$)/;
    expect(hrefs.every((href) => known.test(href))).toBe(true);
  });
});
