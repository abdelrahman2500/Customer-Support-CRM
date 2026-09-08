import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ArticleListView } from "./article-list-view";
import { useArticlesQuery, useUpdateArticleMutation } from "@/hooks/use-knowledge-base";
import { useKbCategoriesQuery } from "@/hooks/use-kb-categories";
import { ApiError } from "@/lib/api";

const push = vi.fn();
const replace = vi.fn();
// Batch 4 (UX audit) — filters now live in the URL via `useUrlFilters`;
// mutable so the dedicated "URL state (Batch 4)" describe block can
// exercise it, every other test in this file leaves it at "".
let searchParamsString = "";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push, replace }),
  usePathname: () => "/en/knowledge-base",
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-knowledge-base", () => ({
  useArticlesQuery: vi.fn(),
  useUpdateArticleMutation: vi.fn(),
}));

vi.mock("@/hooks/use-kb-categories", () => ({
  useKbCategoriesQuery: vi.fn(),
}));

const mockedUseArticlesQuery = vi.mocked(useArticlesQuery);
const mockedUseUpdateArticleMutation = vi.mocked(useUpdateArticleMutation);
const mockedUseKbCategoriesQuery = vi.mocked(useKbCategoriesQuery);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    // Story S-7 — `isPending` is what the views branch on now: with
    // `placeholderData: keepPreviousData` a query only reports `pending`
    // when it has no data at all, which is exactly "show the skeleton".
    // `isPlaceholderData` marks rows that are about to be replaced.
    isPending: false,
    isPlaceholderData: false,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function mutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

/**
 * Story S-8c — `GET /knowledge-base/articles` returns a
 * `Paginated<ArticleSummary>` envelope, so the query's `data` is no longer
 * a bare array. Defaults to one full page so the existing tests read as
 * they did before.
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
  title: "How to reset a password",
  body: "Step-by-step instructions...",
  categoryId: "category-1",
  categoryName: "account",
  status: "DRAFT" as const,
  publishedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ArticleListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsString = "";
    mockedUseUpdateArticleMutation.mockReturnValue(mutationResult() as never);
    mockedUseKbCategoriesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
  });

  it("shows a loading state while the articles query is pending", () => {
    mockedUseArticlesQuery.mockReturnValue(queryResult({ isPending: true }) as never);

    render(<ArticleListView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows an error state with a retry action when the query fails", () => {
    const refetch = vi.fn();
    mockedUseArticlesQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<ArticleListView />);

    expect(screen.getByText("list.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("list.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state with a prominent create action when the query succeeds with zero articles", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
    expect(screen.getAllByText("list.createButton").length).toBeGreaterThan(0);
  });

  it("links every create affordance to the create route", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );

    render(<ArticleListView />);

    // Both the header button and the empty-state CTA are Button asChild +
    // Link, so each is a real, middle-clickable anchor.
    const links = screen.getAllByRole("link", { name: "list.createButton" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/en/knowledge-base/new");
    }
  });

  it("renders a row per article once the query succeeds", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseArticle]) }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("How to reset a password")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
    expect(screen.getByText("list.draft")).toBeInTheDocument();
    expect(screen.getByText("list.publish")).toBeInTheDocument();
  });

  it("navigates to the detail route when an article title is clicked", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseArticle]) }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByRole("link", { name: "How to reset a password" })).toHaveAttribute(
      "href",
      "/en/knowledge-base/article-1",
    );
  });

  it("falls back to the placeholder label for an unscoped category", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: page([{ ...baseArticle, categoryId: null, categoryName: null }]),
      }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.noCategory")).toBeInTheDocument();
  });

  it("publishes a draft article via the publish button", () => {
    const mutate = vi.fn();
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseArticle]) }) as never,
    );
    mockedUseUpdateArticleMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<ArticleListView />);
    fireEvent.click(screen.getByText("list.publish"));

    expect(mutate).toHaveBeenCalledWith({ status: "PUBLISHED" });
  });

  it("does not unpublish immediately — clicking unpublish opens a confirmation dialog first", () => {
    const mutate = vi.fn();
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: page([
          { ...baseArticle, status: "PUBLISHED", publishedAt: "2026-01-02T00:00:00.000Z" },
        ]),
      }) as never,
    );
    mockedUseUpdateArticleMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<ArticleListView />);
    fireEvent.click(screen.getByRole("button", { name: "list.unpublish" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("unpublishes a published article via the unpublish button's confirmation dialog", () => {
    const mutate = vi.fn();
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: page([
          { ...baseArticle, status: "PUBLISHED", publishedAt: "2026-01-02T00:00:00.000Z" },
        ]),
      }) as never,
    );
    mockedUseUpdateArticleMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<ArticleListView />);
    fireEvent.click(screen.getByRole("button", { name: "list.unpublish" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "list.unpublish" }));

    expect(mutate).toHaveBeenCalledWith(
      { status: "DRAFT" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("renders an inline permission error when a mutation is rejected with 403", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseArticle]) }) as never,
    );
    mockedUseUpdateArticleMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.actionForbidden")).toBeInTheDocument();
  });

  it("renders a generic action-failed message for a non-403 mutation error", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseArticle]) }) as never,
    );
    mockedUseUpdateArticleMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.actionFailed")).toBeInTheDocument();
  });

  // Story 64 — Article Search.
  it("passes the typed search text through to useArticlesQuery", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([baseArticle]) }) as never,
    );

    render(<ArticleListView />);
    fireEvent.change(screen.getByPlaceholderText("list.searchPlaceholder"), {
      target: { value: "password" },
    });

    // Story S-8c — the hook takes `(search, page)`; typing resets the page.
    expect(mockedUseArticlesQuery).toHaveBeenLastCalledWith("password", undefined, undefined);
  });

  it("shows a distinct no-results state (not the create-prompting empty state) when a search yields nothing", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: page([]) }) as never,
    );

    render(<ArticleListView />);
    fireEvent.change(screen.getByPlaceholderText("list.searchPlaceholder"), {
      target: { value: "no-such-article" },
    });

    expect(screen.getByText("list.noResults")).toBeInTheDocument();
    expect(screen.queryByText("list.empty")).not.toBeInTheDocument();
  });

  /**
   * Story S-8c — paging the article library. `page` joins `search` in the
   * query key, so a page change inherits Story S-7's row preservation.
   */
  describe("pagination (Story S-8c)", () => {
    const middlePage = { total: 60, page: 2, pageSize: 25, totalPages: 3 };

    beforeEach(() => {
      mockedUseArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([baseArticle], middlePage) }) as never,
      );
    });

    it("renders no pager when the library fits on one page", () => {
      mockedUseArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([baseArticle]) }) as never,
      );

      render(<ArticleListView />);

      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("renders the pager and page indicator once there is more than one page", () => {
      render(<ArticleListView />);

      expect(screen.getByRole("navigation", { name: "pagination.label" })).toBeInTheDocument();
      expect(
        screen.getByText('pagination.indicator:{"page":2,"totalPages":3}'),
      ).toBeInTheDocument();
    });

    it("requests the next page, keeping the current search term", () => {
      render(<ArticleListView />);

      fireEvent.change(screen.getByLabelText("list.searchLabel"), {
        target: { value: "password" },
      });
      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));

      expect(mockedUseArticlesQuery).toHaveBeenLastCalledWith("password", 3, undefined);
    });

    it("requests the previous page", () => {
      render(<ArticleListView />);

      fireEvent.click(screen.getByRole("button", { name: "pagination.previous" }));

      expect(mockedUseArticlesQuery).toHaveBeenLastCalledWith("", 1, undefined);
    });

    it("disables previous on the first page", () => {
      mockedUseArticlesQuery.mockReturnValue(
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
      mockedUseArticlesQuery.mockReturnValue(
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
      mockedUseArticlesQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          isPlaceholderData: true,
          data: page([baseArticle], middlePage),
        }) as never,
      );

      const { container } = render(<ArticleListView />);

      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    });

    it("shows a polite fetch indicator while a page change is in flight", () => {
      mockedUseArticlesQuery.mockReturnValue(
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
      mockedUseArticlesQuery.mockReturnValue(
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

      // Move off page 1 first, so the reset is observable.
      fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));
      expect(mockedUseArticlesQuery).toHaveBeenLastCalledWith("", 3, undefined);

      fireEvent.change(screen.getByLabelText("list.searchLabel"), {
        target: { value: "reset" },
      });

      // `undefined` rather than 1: the same request, and it keeps the query
      // key identical to a first visit.
      expect(mockedUseArticlesQuery).toHaveBeenLastCalledWith("reset", undefined, undefined);
    });

    it("still shows the empty state for a genuinely empty page", () => {
      mockedUseArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([], { total: 0, totalPages: 1 }) }) as never,
      );

      render(<ArticleListView />);

      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  // Batch 4 (UX audit).
  describe("category filter", () => {
    it("passes the selected category through to useArticlesQuery", async () => {
      mockedUseArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([]) }) as never,
      );
      mockedUseKbCategoriesQuery.mockReturnValue(
        queryResult({
          data: [{ id: "category-1", branchId: "branch-1", name: "account", isActive: true }],
          isSuccess: true,
        }) as never,
      );

      render(<ArticleListView />);
      fireEvent.click(screen.getByRole("combobox", { name: "list.filterCategory" }));
      fireEvent.click(await screen.findByRole("option", { name: "account" }));

      expect(mockedUseArticlesQuery).toHaveBeenLastCalledWith(
        "",
        undefined,
        "category-1",
      );
    });

    it("resets to page 1 when the category changes, in the same update", async () => {
      mockedUseArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([], { total: 60, page: 3, totalPages: 3 }) }) as never,
      );
      mockedUseKbCategoriesQuery.mockReturnValue(
        queryResult({
          data: [{ id: "category-1", branchId: "branch-1", name: "account", isActive: true }],
          isSuccess: true,
        }) as never,
      );

      render(<ArticleListView />);
      fireEvent.click(screen.getByRole("combobox", { name: "list.filterCategory" }));
      fireEvent.click(await screen.findByRole("option", { name: "account" }));

      expect(mockedUseArticlesQuery).toHaveBeenLastCalledWith("", undefined, "category-1");
    });
  });

  // Batch 4 (UX audit) — filters/search/category/page now live in the URL,
  // so a filtered list survives navigating into an article and back.
  describe("URL state (Batch 4)", () => {
    it("initializes filters from the URL's own query string on first render", () => {
      searchParamsString = "search=reset&categoryId=category-1&page=2";
      mockedUseArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([]) }) as never,
      );

      render(<ArticleListView />);

      expect(mockedUseArticlesQuery).toHaveBeenLastCalledWith("reset", 2, "category-1");
    });

    it("writes a search change to the URL via router.replace, not push", () => {
      mockedUseArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([]) }) as never,
      );

      render(<ArticleListView />);
      fireEvent.change(screen.getByLabelText("list.searchLabel"), {
        target: { value: "reset" },
      });

      expect(replace).toHaveBeenCalledWith("/en/knowledge-base?search=reset", { scroll: false });
      expect(push).not.toHaveBeenCalled();
    });

    it("writes no query string for the default, unfiltered list", () => {
      mockedUseArticlesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([]) }) as never,
      );

      render(<ArticleListView />);

      expect(replace).not.toHaveBeenCalled();
    });
  });
});
