import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArticleDetailSkeleton, ArticleDetailView } from "./article-detail-view";
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
  categoryId: "category-1",
  categoryName: "account",
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
    vi.mocked(usePublishedArticleQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<ArticleDetailView articleId="article-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  // Story 109 — Multi-locale content.
  it("passes the active locale, uppercased, through to usePublishedArticleQuery", () => {
    vi.mocked(usePublishedArticleQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<ArticleDetailView articleId="article-1" />);

    expect(usePublishedArticleQuery).toHaveBeenCalledWith("article-1", "EN");
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
      queryResult({
        data: { ...baseArticle, categoryId: null, categoryName: null },
        isSuccess: true,
      }) as never,
    );

    expect(() => render(<ArticleDetailView articleId="article-1" />)).not.toThrow();
  });

  // Story 165 — the early-return loading state announces itself. The
  // announcement lives at the call site, never inside the shared skeleton:
  // route-level `loading.tsx` renders that same component and deliberately
  // does not announce (see `RouteLoadingSkeleton`).
  // `placeholderHidden={false}` here: ArticleDetailSkeleton already carries
  // `aria-hidden` on its own root, so the wrapper must not add a second.
  it("announces the detail loading state while the skeleton hides itself", () => {
    vi.mocked(usePublishedArticleQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<ArticleDetailView articleId="article-1" />);

    const status = screen.getByRole("status", { name: "loading" });
    expect(status).toHaveAttribute("aria-busy", "true");

    // The wrapper adds no aria-hidden of its own...
    expect(status.firstElementChild).not.toHaveAttribute("aria-hidden");
    // ...because the skeleton already hides its whole subtree.
    expect(status.querySelector("[aria-hidden='true']")).toBeInTheDocument();

    // The skeleton's own visuals are unchanged.
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  // Story 165 — the skeleton is decorative, and its two siblings
  // (TicketDetailSkeleton, CustomerDetailSkeleton) always hid themselves.
  // This also covers the route-level `loading.tsx` path, which renders the
  // skeleton on its own and deliberately does not announce.
  it("hides the article detail skeleton from assistive technology", () => {
    const { container } = render(<ArticleDetailSkeleton />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    // Unchanged visually: same wrapper classes, same two bars.
    expect(root).toHaveClass("flex", "flex-col", "gap-3");
    expect(root?.querySelectorAll(".animate-pulse")).toHaveLength(2);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
