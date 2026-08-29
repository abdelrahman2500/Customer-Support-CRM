import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArticleDetailView } from "./article-detail-view";
import { useArticleQuery, useUpdateArticleMutation } from "@/hooks/use-knowledge-base";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-knowledge-base", () => ({
  useArticleQuery: vi.fn(),
  useUpdateArticleMutation: vi.fn(),
}));

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
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

describe("ArticleDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateArticleMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it("renders a loading skeleton while the article query is pending", () => {
    vi.mocked(useArticleQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<ArticleDetailView articleId="article-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders a not-found message when the article lookup 404s", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<ArticleDetailView articleId="missing" />);

    expect(screen.getByText("detail.notFound")).toBeInTheDocument();
  });

  it("renders a generic load error for a non-404 failure", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<ArticleDetailView articleId="article-1" />);

    expect(screen.getByText("detail.loadError")).toBeInTheDocument();
  });

  it("renders the article's title, category, body, and draft status", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );

    render(<ArticleDetailView articleId="article-1" />);

    expect(screen.getByDisplayValue("How to reset a password")).toBeInTheDocument();
    expect(screen.getByDisplayValue("account")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Step-by-step instructions...")).toBeInTheDocument();
    expect(screen.getByText("list.draft")).toBeInTheDocument();
    expect(screen.getByText("list.publish")).toBeInTheDocument();
  });

  it("commits a title edit on blur when the value changed", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );
    const mutate = vi.fn();
    vi.mocked(useUpdateArticleMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<ArticleDetailView articleId="article-1" />);

    const input = screen.getByDisplayValue("How to reset a password");
    fireEvent.change(input, { target: { value: "How to reset your password" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith({ title: "How to reset your password" });
  });

  it("does not commit the title when blurred unchanged", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );
    const mutate = vi.fn();
    vi.mocked(useUpdateArticleMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<ArticleDetailView articleId="article-1" />);
    fireEvent.blur(screen.getByDisplayValue("How to reset a password"));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("publishes a draft article via the publish button", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );
    const mutate = vi.fn();
    vi.mocked(useUpdateArticleMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<ArticleDetailView articleId="article-1" />);
    fireEvent.click(screen.getByText("list.publish"));

    expect(mutate).toHaveBeenCalledWith({ status: "PUBLISHED" });
  });

  it("unpublishes a published article via the unpublish button", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({
        data: { ...baseArticle, status: "PUBLISHED", publishedAt: "2026-01-02T00:00:00.000Z" },
        isSuccess: true,
      }) as never,
    );
    const mutate = vi.fn();
    vi.mocked(useUpdateArticleMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<ArticleDetailView articleId="article-1" />);
    fireEvent.click(screen.getByText("list.unpublish"));

    expect(mutate).toHaveBeenCalledWith({ status: "DRAFT" });
  });

  it("renders an inline permission error when a mutation is rejected with 403", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );
    vi.mocked(useUpdateArticleMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError("Forbidden", 403),
    } as never);

    render(<ArticleDetailView articleId="article-1" />);

    expect(screen.getByText("detail.actionForbidden")).toBeInTheDocument();
  });

  it("renders a generic action-failed message for a non-403 mutation error", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );
    vi.mocked(useUpdateArticleMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError("Server error", 500),
    } as never);

    render(<ArticleDetailView articleId="article-1" />);

    expect(screen.getByText("detail.actionFailed")).toBeInTheDocument();
  });
});
