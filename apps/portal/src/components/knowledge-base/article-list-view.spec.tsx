import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArticleListView } from "./article-list-view";
import { usePublishedArticlesQuery } from "@/hooks/use-portal-knowledge-base";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-knowledge-base", () => ({
  usePublishedArticlesQuery: vi.fn(),
}));

const mockedUsePublishedArticlesQuery = vi.mocked(usePublishedArticlesQuery);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    // Story S-7 — see the agent workspace's list specs: `isPending` is the
    // "nothing to show yet" signal once placeholder data is in play.
    isPending: false,
    isPlaceholderData: false,
    isLoading: false,
    isError: false,
    isSuccess: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

/**
 * Story S-8c — `GET /portal/knowledge-base/articles` returns a
 * `Paginated<PortalArticleSummary>` envelope. Defaults to one full page so
 * the existing tests read as they did before.
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

const baseArticle = {
  id: "article-1",
  branchId: "branch-1",
  title: "How to reset your password",
  body: "Step-by-step instructions...",
  categoryId: "category-1",
  categoryName: "account",
  status: "PUBLISHED" as const,
  publishedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ArticleListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the articles query is pending", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(queryResult({ isPending: true }) as never);

    const { container } = render(<ArticleListView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows an error state with a retry action when the query fails", () => {
    const refetch = vi.fn();
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ isError: true, refetch }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("list.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are no articles", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("renders a row per article linking to its locale-correct detail route", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: page([baseArticle]), isSuccess: true }) as never,
    );

    render(<ArticleListView />);

    // Story S-6: a real link, so the destination is assertable and the row
    // can be middle-clicked or opened in a new tab.
    const link = screen.getByRole("link", { name: "How to reset your password" });
    expect(link).toHaveAttribute("href", "/en/knowledge-base/article-1");
  });

  it("falls back to the placeholder label for an unscoped category", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({
        data: page([{ ...baseArticle, categoryId: null, categoryName: null }]),
        isSuccess: true,
      }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.noCategory")).toBeInTheDocument();
  });

  // Story 64 — Article Search.
  it("passes the typed search text through to usePublishedArticlesQuery", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: page([baseArticle]), isSuccess: true }) as never,
    );

    render(<ArticleListView />);
    fireEvent.change(screen.getByPlaceholderText("list.searchPlaceholder"), {
      target: { value: "password" },
    });

    // Story S-8c — the hook takes `(search, locale, page)`; typing resets
    // the page.
    expect(mockedUsePublishedArticlesQuery).toHaveBeenLastCalledWith("password", "EN", undefined);
  });

  // Story 109 — Multi-locale content.
  it("passes the active locale, uppercased, through to usePublishedArticlesQuery", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: page([baseArticle]), isSuccess: true }) as never,
    );

    render(<ArticleListView />);

    expect(mockedUsePublishedArticlesQuery).toHaveBeenCalledWith("", "EN", undefined);
  });

  it("shows a distinct no-results state (not the browse-prompting empty state) when a search yields nothing", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );

    render(<ArticleListView />);
    fireEvent.change(screen.getByPlaceholderText("list.searchPlaceholder"), {
      target: { value: "no-such-article" },
    });

    expect(screen.getByText("list.noResults")).toBeInTheDocument();
    expect(screen.queryByText("list.empty")).not.toBeInTheDocument();
  });

  /**
   * Story S-8c — paging the published library. The portal keeps its own
   * error/empty markup (see the view), so what is added here is the pager
   * and the S-7 fetch semantics around it, not a QueryStateCard migration.
   */
  describe("pagination (Story S-8c)", () => {
    const middlePage = { total: 60, page: 2, pageSize: 25, totalPages: 3 };

    beforeEach(() => {
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([baseArticle], middlePage) }) as never,
      );
    });

    it("renders no pager when the published library fits on one page", () => {
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([baseArticle]) }) as never,
      );

      render(<ArticleListView />);

      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("renders the pager and page indicator once there is more than one page", () => {
      render(<ArticleListView />);

      expect(screen.getByRole("navigation", { name: "pagination.label" })).toBeInTheDocument();
      expect(
        // This spec's `useTranslations` mock returns the bare key, ignoring
        // interpolation vars - unlike the agent workspace's, which echoes them.
        screen.getByText("pagination.indicator"),
      ).toBeInTheDocument();
    });

    it("requests the next page, keeping search and locale", () => {
      render(<ArticleListView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));

      expect(mockedUsePublishedArticlesQuery).toHaveBeenLastCalledWith("", "EN", 3);
    });

    it("requests the previous page", () => {
      render(<ArticleListView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.previous" }));

      expect(mockedUsePublishedArticlesQuery).toHaveBeenLastCalledWith("", "EN", 1);
    });

    it("disables previous on the first page", () => {
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([baseArticle], { ...middlePage, page: 1 }),
        }) as never,
      );

      render(<ArticleListView />);

      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.next" })).toBeEnabled();
    });

    it("disables next on the last page", () => {
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([baseArticle], { ...middlePage, page: 3 }),
        }) as never,
      );

      render(<ArticleListView />);

      expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeEnabled();
    });

    it("keeps the previous page's rows on screen while the next one loads", () => {
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([baseArticle], middlePage),
        }) as never,
      );

      const { container } = render(<ArticleListView />);

      expect(screen.getByText("How to reset your password")).toBeInTheDocument();
      expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    });

    it("shows a polite fetch indicator while a page change is in flight", () => {
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([baseArticle], middlePage),
        }) as never,
      );

      render(<ArticleListView />);

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("updating");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("blocks both controls while a page change is in flight", () => {
      mockedUsePublishedArticlesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([baseArticle], middlePage),
        }) as never,
      );

      render(<ArticleListView />);

      expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    });

    it("resets to page 1 when the search term changes, in the same update", () => {
      render(<ArticleListView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));
      expect(mockedUsePublishedArticlesQuery).toHaveBeenLastCalledWith("", "EN", 3);

      fireEvent.change(screen.getByLabelText("list.searchLabel"), {
        target: { value: "reset" },
      });

      expect(mockedUsePublishedArticlesQuery).toHaveBeenLastCalledWith("reset", "EN", undefined);
    });
  });
});
