import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArticleDetailView } from "./article-detail-view";
import {
  useArticleQuery,
  useArticleTranslationsQuery,
  useArticleVersionsQuery,
  useSetArticleTranslationMutation,
  useUpdateArticleMutation,
} from "@/hooks/use-knowledge-base";
import { useKbCategoriesQuery } from "@/hooks/use-kb-categories";
import { useAttachmentsQuery, useUploadAttachmentMutation } from "@/hooks/use-attachments";
import { ApiError } from "@/lib/api";

// Version-history dates are formatted with the active locale (same
// convention as `audit-log-view.spec.tsx`, which mocks this identically).
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-knowledge-base", () => ({
  useArticleQuery: vi.fn(),
  useArticleTranslationsQuery: vi.fn(),
  useArticleVersionsQuery: vi.fn(),
  useSetArticleTranslationMutation: vi.fn(),
  useUpdateArticleMutation: vi.fn(),
}));

// Story 137 — the Arabic panel's success feedback. Mocked at the package
// boundary so the toast store isn't exercised here; `success-toaster.spec`
// in `packages/ui` owns that behaviour.
const showSuccessToast = vi.fn();
vi.mock("@crm/ui", async () => ({
  ...(await vi.importActual<typeof import("@crm/ui")>("@crm/ui")),
  showSuccessToast: (...args: unknown[]) => showSuccessToast(...args),
}));

vi.mock("@/hooks/use-kb-categories", () => ({
  useKbCategoriesQuery: vi.fn(),
}));

// RM-28 — AttachmentsCard's own hooks; its behavior is covered in its own
// dedicated spec (attachments-card.spec.tsx), so this file only needs
// enough of a mock for ArticleDetailView to render it cleanly.
vi.mock("@/hooks/use-attachments", () => ({
  useAttachmentsQuery: vi.fn(),
  useUploadAttachmentMutation: vi.fn(),
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
  categoryId: "category-1",
  categoryName: "account",
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
    // Story 65 — default: version history query still pending, matching
    // every pre-existing test's own expectation of not asserting on it.
    vi.mocked(useArticleVersionsQuery).mockReturnValue(queryResult({ isLoading: true }) as never);
    // RM-27 — the category picker's own query.
    vi.mocked(useKbCategoriesQuery).mockReturnValue(
      queryResult({
        data: [{ id: "category-1", branchId: "branch-1", name: "account", isActive: true }],
        isSuccess: true,
      }) as never,
    );
    // RM-28 — AttachmentsCard's own hooks.
    vi.mocked(useAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadAttachmentMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "attachment-new" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    // Story 137 — the Arabic panel's own hooks. Defaults are "no
    // translation set yet", the state every pre-existing test would see if
    // it ever opened that tab (none do — `defaultValue="en"`).
    vi.mocked(useArticleTranslationsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useSetArticleTranslationMutation).mockReturnValue({
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

    // Story 159 — the title is a visible heading, editable behind an
    // explicit Edit affordance rather than being a permanent input.
    expect(
      screen.getByRole("heading", { level: 1, name: "How to reset a password" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "detail.titleEdit" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("How to reset a password")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "detail.categoryLabel" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Step-by-step instructions...")).toBeInTheDocument();
    expect(screen.getByText("list.draft")).toBeInTheDocument();
    expect(screen.getByText("list.publish")).toBeInTheDocument();
  });

  // Batch 3 (UX audit) — mirrors the portal's own equivalent link, which
  // this screen never had.
  it("renders a back-to-list link to the Knowledge Base list", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );

    render(<ArticleDetailView articleId="article-1" />);

    expect(screen.getByRole("link", { name: /detail.backToList/ })).toHaveAttribute(
      "href",
      "/en/knowledge-base",
    );
  });

  // RM-27 — the free-text category Input became a Select.
  it("commits a category change immediately on selection", async () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );
    vi.mocked(useKbCategoriesQuery).mockReturnValue(
      queryResult({
        data: [
          { id: "category-1", branchId: "branch-1", name: "account", isActive: true },
          { id: "category-2", branchId: "branch-1", name: "billing", isActive: true },
        ],
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

    fireEvent.click(screen.getByRole("combobox", { name: "detail.categoryLabel" }));
    fireEvent.click(await screen.findByRole("option", { name: "billing" }));

    expect(mutate).toHaveBeenCalledWith({ categoryId: "category-2" });
  });

  // NAV-2 — this page had no heading landmark at all (the title is an
  // editable Input, not static text a plain <h1> could reuse).
  it("gives the page a level-1 heading landmark matching the article's title", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );

    render(<ArticleDetailView articleId="article-1" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "How to reset a password" }),
    ).toBeInTheDocument();
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

    // Story 159 — editing is an explicit mode now.
    fireEvent.click(screen.getByRole("button", { name: "detail.titleEdit" }));
    const input = screen.getByDisplayValue("How to reset a password");
    fireEvent.change(input, { target: { value: "How to reset your password" } });
    fireEvent.blur(input);

    // Batch 5 (UX audit) — the mutation now also carries an `onError`
    // revert callback (second arg), mirroring `SlaPolicyRow`'s pattern.
    expect(mutate).toHaveBeenCalledWith(
      { title: "How to reset your password" },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("reverts the title field to the server value when the mutation is rejected", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "detail.titleEdit" }));
    const input = screen.getByDisplayValue("How to reset a password");
    fireEvent.change(input, { target: { value: "How to reset your password" } });
    fireEvent.blur(input);

    const onError = mutate.mock.calls[0]![1].onError as () => void;
    act(() => onError());

    // Story 159 — blur also leaves edit mode, so the reverted draft is
    // observed by reopening the field, not by reading a still-open input.
    fireEvent.click(screen.getByRole("button", { name: "detail.titleEdit" }));
    expect(screen.getByDisplayValue("How to reset a password")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "detail.titleEdit" }));
    fireEvent.blur(screen.getByDisplayValue("How to reset a password"));

    expect(mutate).not.toHaveBeenCalled();
  });

  // Story 159 — matches ticket detail's own Escape behaviour.
  it("abandons a title edit on Escape without committing it", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "detail.titleEdit" }));
    const input = screen.getByDisplayValue("How to reset a password");
    fireEvent.change(input, { target: { value: "How to reset your password" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { level: 1, name: "How to reset a password" }),
    ).toBeInTheDocument();

    // Reopening starts from the server's value, never the abandoned draft.
    fireEvent.click(screen.getByRole("button", { name: "detail.titleEdit" }));
    expect(screen.getByDisplayValue("How to reset a password")).toBeInTheDocument();
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

  it("does not unpublish immediately — clicking unpublish opens a confirmation dialog first", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "list.unpublish" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("unpublishes a published article via the unpublish button's confirmation dialog", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "list.unpublish" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "list.unpublish" }));

    expect(mutate).toHaveBeenCalledWith(
      { status: "DRAFT" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
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

  // Story 65 — Article Version History.
  it("renders a row per version once the version history query succeeds", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );
    vi.mocked(useArticleVersionsQuery).mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          {
            id: "version-2",
            articleId: "article-1",
            versionNumber: 2,
            title: "How to reset your password",
            body: "Revised instructions...",
            category: "account",
            publishedAt: "2026-01-03T00:00:00.000Z",
            createdAt: "2026-01-03T00:00:00.000Z",
          },
          {
            id: "version-1",
            articleId: "article-1",
            versionNumber: 1,
            title: "How to reset a password",
            body: "Step-by-step instructions...",
            category: "account",
            publishedAt: "2026-01-02T00:00:00.000Z",
            createdAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      }) as never,
    );

    render(<ArticleDetailView articleId="article-1" />);

    // Story 159 — version history is a `SectionCard` now, so its heading
    // is the `h2` `SectionCard` renders rather than a bare styled span.
    expect(
      screen.getByRole("heading", { level: 2, name: "detail.versions.title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("How to reset your password")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows an empty state when the article has never been published", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );
    vi.mocked(useArticleVersionsQuery).mockReturnValue(
      queryResult({ isSuccess: true, data: [] }) as never,
    );

    render(<ArticleDetailView articleId="article-1" />);

    expect(screen.getByText("detail.versions.empty")).toBeInTheDocument();
  });

  it("shows an error state when the version history query fails", () => {
    vi.mocked(useArticleQuery).mockReturnValue(
      queryResult({ data: baseArticle, isSuccess: true }) as never,
    );
    vi.mocked(useArticleVersionsQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<ArticleDetailView articleId="article-1" />);

    expect(screen.getByText("detail.versions.error")).toBeInTheDocument();
  });

  /**
   * Story 137 — Arabic locale-tab editing. The English tab is
   * `defaultValue`, so every test above renders exactly as it did before
   * this story; these cover the Arabic panel specifically.
   */
  describe("Arabic translation tab (Story 137)", () => {
    const arTranslation = {
      id: "translation-1",
      articleId: "article-1",
      locale: "AR" as const,
      title: "كيفية إعادة تعيين كلمة المرور",
      body: "تعليمات خطوة بخطوة...",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    beforeEach(() => {
      vi.mocked(useArticleQuery).mockReturnValue(
        queryResult({ data: baseArticle, isSuccess: true }) as never,
      );
    });

    /** Radix activates a tab through real pointer events; a bare
     * `fireEvent.click` leaves the panel hidden in jsdom. `userEvent` is
     * what `packages/ui/src/components/tabs.spec.tsx` already uses. */
    async function openArabicTab() {
      const user = userEvent.setup();
      await user.click(screen.getByRole("tab", { name: "detail.locales.ar" }));
    }

    it("renders an English and an Arabic tab, with English active by default", async () => {
      render(<ArticleDetailView articleId="article-1" />);

      expect(screen.getByRole("tab", { name: "detail.locales.en" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByRole("tab", { name: "detail.locales.ar" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
      // The base editor is what renders on mount.
      expect(screen.getByDisplayValue("Step-by-step instructions...")).toBeInTheDocument();
    });

    it("shows the Arabic translation editor once the Arabic tab is selected", async () => {
      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      expect(screen.getByText("detail.translations.heading")).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "detail.translations.titleLabel" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "detail.translations.bodyLabel" }),
      ).toBeInTheDocument();
    });

    it("renders a skeleton while the translations query is loading", async () => {
      vi.mocked(useArticleTranslationsQuery).mockReturnValue(
        queryResult({ isLoading: true }) as never,
      );

      const { container } = render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("treats an empty translations array as 'none yet', not an error", async () => {
      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      expect(screen.getByText("detail.translations.none")).toBeInTheDocument();
      expect(screen.queryByText("detail.translations.loadError")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "detail.translations.titleLabel" })).toHaveValue(
        "",
      );
    });

    it("prefills the fields from an existing AR translation, found by locale not position", async () => {
      vi.mocked(useArticleTranslationsQuery).mockReturnValue(
        queryResult({
          // An EN row deliberately sits first, so a positional lookup would
          // pick the wrong one.
          data: [{ ...arTranslation, id: "translation-en", locale: "EN" }, arTranslation],
          isSuccess: true,
        }) as never,
      );

      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      expect(screen.getByRole("textbox", { name: "detail.translations.titleLabel" })).toHaveValue(
        arTranslation.title,
      );
      expect(screen.getByRole("textbox", { name: "detail.translations.bodyLabel" })).toHaveValue(
        arTranslation.body,
      );
      expect(screen.queryByText("detail.translations.none")).not.toBeInTheDocument();
    });

    it("renders the Arabic fields right-to-left", async () => {
      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      expect(
        screen.getByRole("textbox", { name: "detail.translations.titleLabel" }),
      ).toHaveAttribute("dir", "rtl");
      expect(
        screen.getByRole("textbox", { name: "detail.translations.bodyLabel" }),
      ).toHaveAttribute("dir", "rtl");
    });

    it("saves both trimmed fields together in one request", async () => {
      const mutate = vi.fn();
      vi.mocked(useSetArticleTranslationMutation).mockReturnValue({
        mutate,
        isPending: false,
        isError: false,
        error: null,
      } as never);

      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      fireEvent.change(screen.getByRole("textbox", { name: "detail.translations.titleLabel" }), {
        target: { value: "  عنوان  " },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "detail.translations.bodyLabel" }), {
        target: { value: "  نص  " },
      });
      fireEvent.click(screen.getByText("detail.translations.save"));

      expect(mutate).toHaveBeenCalledOnce();
      // Both fields, trimmed, in a single request — the PUT replaces the
      // translation wholesale, so a partial payload is never correct.
      expect(mutate).toHaveBeenCalledWith(
        { title: "عنوان", body: "نص" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("fires the success toast once a save resolves", async () => {
      const mutate = vi.fn((_input, options?: { onSuccess?: () => void }) =>
        options?.onSuccess?.(),
      );
      vi.mocked(useSetArticleTranslationMutation).mockReturnValue({
        mutate,
        isPending: false,
        isError: false,
        error: null,
      } as never);
      vi.mocked(useArticleTranslationsQuery).mockReturnValue(
        queryResult({ data: [arTranslation], isSuccess: true }) as never,
      );

      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();
      fireEvent.click(screen.getByText("detail.translations.save"));

      expect(showSuccessToast).toHaveBeenCalledWith("detail.translations.saveSuccess");
    });

    it("disables save while the mutation is pending", async () => {
      vi.mocked(useArticleTranslationsQuery).mockReturnValue(
        queryResult({ data: [arTranslation], isSuccess: true }) as never,
      );
      vi.mocked(useSetArticleTranslationMutation).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as never);

      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      expect(screen.getByText("detail.translations.saving").closest("button")).toBeDisabled();
    });

    it("disables save when either field is empty or whitespace-only", async () => {
      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      // Both empty (no translation yet).
      expect(screen.getByText("detail.translations.save").closest("button")).toBeDisabled();

      // Title filled, body still empty.
      fireEvent.change(screen.getByRole("textbox", { name: "detail.translations.titleLabel" }), {
        target: { value: "عنوان" },
      });
      expect(screen.getByText("detail.translations.save").closest("button")).toBeDisabled();

      // Body whitespace-only — passes the backend's MinLength(1) but is
      // meaningless, so the client must still refuse it.
      fireEvent.change(screen.getByRole("textbox", { name: "detail.translations.bodyLabel" }), {
        target: { value: "   " },
      });
      expect(screen.getByText("detail.translations.save").closest("button")).toBeDisabled();

      // Both genuinely filled.
      fireEvent.change(screen.getByRole("textbox", { name: "detail.translations.bodyLabel" }), {
        target: { value: "نص" },
      });
      expect(screen.getByText("detail.translations.save").closest("button")).toBeEnabled();
    });

    it("renders a generic error when the save fails", async () => {
      vi.mocked(useSetArticleTranslationMutation).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new ApiError("Server error", 500),
      } as never);

      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      expect(screen.getByText("detail.translations.saveFailed")).toBeInTheDocument();
    });

    it("maps a 403 save rejection to the shared permission message", async () => {
      vi.mocked(useSetArticleTranslationMutation).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new ApiError("Forbidden", 403),
      } as never);

      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      expect(screen.getByText("detail.actionForbidden")).toBeInTheDocument();
    });

    it("renders a destructive alert when the translations query fails", async () => {
      vi.mocked(useArticleTranslationsQuery).mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();

      expect(screen.getByText("detail.translations.loadError")).toBeInTheDocument();
      expect(
        screen.queryByRole("textbox", { name: "detail.translations.titleLabel" }),
      ).not.toBeInTheDocument();
    });

    it("leaves the base article content untouched when switching back to English", async () => {
      vi.mocked(useArticleTranslationsQuery).mockReturnValue(
        queryResult({ data: [arTranslation], isSuccess: true }) as never,
      );

      render(<ArticleDetailView articleId="article-1" />);
      await openArabicTab();
      fireEvent.change(screen.getByRole("textbox", { name: "detail.translations.bodyLabel" }), {
        target: { value: "نص معدّل" },
      });

      await userEvent.setup().click(screen.getByRole("tab", { name: "detail.locales.en" }));

      expect(screen.getByDisplayValue("Step-by-step instructions...")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 1, name: "How to reset a password" }),
      ).toBeInTheDocument();
    });
  });
});
