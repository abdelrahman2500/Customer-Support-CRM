import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArticleDetailView } from "./article-detail-view";
import { usePublishedArticleQuery } from "@/hooks/use-portal-knowledge-base";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-knowledge-base", () => ({
  usePublishedArticleQuery: vi.fn(),
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
  title: "How to reset your password",
  body: "Step-by-step instructions...",
  category: "account",
  status: "PUBLISHED" as const,
  publishedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ArticleDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading skeleton while the article query is pending", () => {
    vi.mocked(usePublishedArticleQuery).mockReturnValue(
      queryResult({ isLoading: true }) as never,
    );

    const { container } = render(<ArticleDetailView articleId="article-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders a not-found message when the article lookup 404s", () => {
    vi.mocked(usePublishedArticleQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<ArticleDetailView articleId="missing" />);

    expect(screen.getByText("detail.notFound")).toBeInTheDocument();
  });

  it("renders a generic load error for a non-404 failure", () => {
    vi.mocked(usePublishedArticleQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<ArticleDetailView articleId="article-1" />);

    expect(screen.getByText("detail.loadError")).toBeInTheDocument();
  });

  it("renders the article's title, category, and body", () => {
    vi.mocked(usePublishedArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );

    render(<ArticleDetailView articleId="article-1" />);

    expect(screen.getByText("How to reset your password")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
    expect(screen.getByText("Step-by-step instructions...")).toBeInTheDocument();
  });

  it("renders without a category label when the article has none", () => {
    vi.mocked(usePublishedArticleQuery).mockReturnValue(
      queryResult({ data: { ...baseArticle, category: null }, isSuccess: true }) as never,
    );

    expect(() => render(<ArticleDetailView articleId="article-1" />)).not.toThrow();
  });
});
