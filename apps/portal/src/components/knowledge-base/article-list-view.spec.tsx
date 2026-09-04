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
    isLoading: false,
    isError: false,
    isSuccess: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

const baseArticle = {
  id: "article-1",
  branchId: "branch-1",
  title: "How to reset your password",
  body: "Step-by-step instructions...",
  category: "account",
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
    mockedUsePublishedArticlesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

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
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
  });

  it("renders a row per article linking to its locale-correct detail route", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: [baseArticle], isSuccess: true }) as never,
    );

    render(<ArticleListView />);

    // Story S-6: a real link, so the destination is assertable and the row
    // can be middle-clicked or opened in a new tab.
    const link = screen.getByRole("link", { name: "How to reset your password" });
    expect(link).toHaveAttribute("href", "/en/knowledge-base/article-1");
  });

  it("falls back to the placeholder label for an unscoped category", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: [{ ...baseArticle, category: null }], isSuccess: true }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.noCategory")).toBeInTheDocument();
  });

  // Story 64 — Article Search.
  it("passes the typed search text through to usePublishedArticlesQuery", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: [baseArticle], isSuccess: true }) as never,
    );

    render(<ArticleListView />);
    fireEvent.change(screen.getByPlaceholderText("list.searchPlaceholder"), {
      target: { value: "password" },
    });

    expect(mockedUsePublishedArticlesQuery).toHaveBeenLastCalledWith("password", "EN");
  });

  // Story 109 — Multi-locale content.
  it("passes the active locale, uppercased, through to usePublishedArticlesQuery", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: [baseArticle], isSuccess: true }) as never,
    );

    render(<ArticleListView />);

    expect(mockedUsePublishedArticlesQuery).toHaveBeenCalledWith("", "EN");
  });

  it("shows a distinct no-results state (not the browse-prompting empty state) when a search yields nothing", () => {
    mockedUsePublishedArticlesQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<ArticleListView />);
    fireEvent.change(screen.getByPlaceholderText("list.searchPlaceholder"), {
      target: { value: "no-such-article" },
    });

    expect(screen.getByText("list.noResults")).toBeInTheDocument();
    expect(screen.queryByText("list.empty")).not.toBeInTheDocument();
  });
});
