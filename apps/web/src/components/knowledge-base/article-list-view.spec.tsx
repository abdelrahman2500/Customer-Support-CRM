import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ArticleListView } from "./article-list-view";
import { useArticlesQuery, useUpdateArticleMutation } from "@/hooks/use-knowledge-base";
import { ApiError } from "@/lib/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-knowledge-base", () => ({
  useArticlesQuery: vi.fn(),
  useUpdateArticleMutation: vi.fn(),
}));

const mockedUseArticlesQuery = vi.mocked(useArticlesQuery);
const mockedUseUpdateArticleMutation = vi.mocked(useUpdateArticleMutation);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
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

const baseArticle = {
  id: "article-1",
  branchId: "branch-1",
  title: "How to reset a password",
  body: "Step-by-step instructions...",
  category: "account",
  status: "DRAFT" as const,
  publishedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ArticleListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdateArticleMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the articles query is pending", () => {
    mockedUseArticlesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

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
    mockedUseArticlesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<ArticleListView />);

    expect(screen.getByText("list.empty")).toBeInTheDocument();
    expect(screen.getAllByText("list.createButton").length).toBeGreaterThan(0);
  });

  it("navigates to the create route when a create button is clicked", () => {
    mockedUseArticlesQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<ArticleListView />);
    fireEvent.click(screen.getAllByText("list.createButton")[0] as HTMLElement);

    expect(push).toHaveBeenCalledWith("/en/knowledge-base/new");
  });

  it("renders a row per article once the query succeeds", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseArticle] }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("How to reset a password")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
    expect(screen.getByText("list.draft")).toBeInTheDocument();
    expect(screen.getByText("list.publish")).toBeInTheDocument();
  });

  it("navigates to the detail route when an article title is clicked", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseArticle] }) as never,
    );

    render(<ArticleListView />);
    fireEvent.click(screen.getByText("How to reset a password"));

    expect(push).toHaveBeenCalledWith("/en/knowledge-base/article-1");
  });

  it("falls back to the placeholder label for an unscoped category", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [{ ...baseArticle, category: null }] }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.noCategory")).toBeInTheDocument();
  });

  it("publishes a draft article via the publish button", () => {
    const mutate = vi.fn();
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseArticle] }) as never,
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
        data: [{ ...baseArticle, status: "PUBLISHED", publishedAt: "2026-01-02T00:00:00.000Z" }],
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
        data: [{ ...baseArticle, status: "PUBLISHED", publishedAt: "2026-01-02T00:00:00.000Z" }],
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
      queryResult({ isSuccess: true, data: [baseArticle] }) as never,
    );
    mockedUseUpdateArticleMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<ArticleListView />);

    expect(screen.getByText("list.actionForbidden")).toBeInTheDocument();
  });

  it("renders a generic action-failed message for a non-403 mutation error", () => {
    mockedUseArticlesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseArticle] }) as never,
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
      queryResult({ isSuccess: true, data: [baseArticle] }) as never,
    );

    render(<ArticleListView />);
    fireEvent.change(screen.getByPlaceholderText("list.searchPlaceholder"), {
      target: { value: "password" },
    });

    expect(mockedUseArticlesQuery).toHaveBeenLastCalledWith("password");
  });

  it("shows a distinct no-results state (not the create-prompting empty state) when a search yields nothing", () => {
    mockedUseArticlesQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);

    render(<ArticleListView />);
    fireEvent.change(screen.getByPlaceholderText("list.searchPlaceholder"), {
      target: { value: "no-such-article" },
    });

    expect(screen.getByText("list.noResults")).toBeInTheDocument();
    expect(screen.queryByText("list.empty")).not.toBeInTheDocument();
  });
});
