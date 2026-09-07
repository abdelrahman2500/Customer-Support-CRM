import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketKbReferencesCard } from "./ticket-kb-references-card";
import {
  useCreateTicketKbReferenceMutation,
  useDeleteTicketKbReferenceMutation,
  useTicketKbReferencesQuery,
} from "@/hooks/use-ticket-kb-references";
import { usePublishedArticleSearchQuery } from "@/hooks/use-knowledge-base";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-ticket-kb-references", () => ({
  useTicketKbReferencesQuery: vi.fn(),
  useCreateTicketKbReferenceMutation: vi.fn(),
  useDeleteTicketKbReferenceMutation: vi.fn(),
}));

vi.mock("@/hooks/use-knowledge-base", () => ({
  usePublishedArticleSearchQuery: vi.fn(),
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

function page(items: unknown[]) {
  return { items, total: items.length, page: 1, pageSize: 5, totalPages: 1 };
}

describe("TicketKbReferencesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePublishedArticleSearchQuery).mockReturnValue(queryResult({}) as never);
    vi.mocked(useCreateTicketKbReferenceMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "reference-new" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useDeleteTicketKbReferenceMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ id: "reference-1" }),
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it("renders a skeleton while references are loading", () => {
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TicketKbReferencesCard ticketId="ticket-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders an inline error when references fail to load", () => {
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketKbReferencesCard ticketId="ticket-1" />);

    expect(screen.getByText("detail.kbReferencesError")).toBeInTheDocument();
  });

  it("renders the empty message when there are no references", () => {
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<TicketKbReferencesCard ticketId="ticket-1" />);

    expect(screen.getByText("detail.kbReferencesEmpty")).toBeInTheDocument();
  });

  it("renders each referenced article's title", () => {
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({
        data: [
          {
            id: "reference-1",
            ticketId: "ticket-1",
            articleId: "article-1",
            articleTitle: "How to reset a password",
            referencedByUserId: "user-1",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<TicketKbReferencesCard ticketId="ticket-1" />);

    expect(screen.getByText("How to reset a password")).toBeInTheDocument();
  });

  it("removes a reference on click, with no confirmation dialog", () => {
    const mutate = vi.fn();
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({
        data: [
          {
            id: "reference-1",
            ticketId: "ticket-1",
            articleId: "article-1",
            articleTitle: "How to reset a password",
            referencedByUserId: "user-1",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        isSuccess: true,
      }) as never,
    );
    vi.mocked(useDeleteTicketKbReferenceMutation).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<TicketKbReferencesCard ticketId="ticket-1" />);
    fireEvent.click(screen.getByText("detail.kbReferencesRemove"));

    expect(mutate).toHaveBeenCalledWith("reference-1", expect.objectContaining({}));
  });

  it("shows the backend's own error message when removing a reference fails", () => {
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({
        data: [
          {
            id: "reference-1",
            ticketId: "ticket-1",
            articleId: "article-1",
            articleTitle: "How to reset a password",
            referencedByUserId: "user-1",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        isSuccess: true,
      }) as never,
    );
    vi.mocked(useDeleteTicketKbReferenceMutation).mockReturnValue({
      mutate: (_id: string, options: { onError: (error: unknown) => void }) =>
        options.onError(new ApiError("Reference not found", 404)),
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<TicketKbReferencesCard ticketId="ticket-1" />);
    fireEvent.click(screen.getByText("detail.kbReferencesRemove"));

    expect(screen.getByText("Reference not found")).toBeInTheDocument();
  });

  it("does not search until the agent types something", () => {
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<TicketKbReferencesCard ticketId="ticket-1" />);

    expect(usePublishedArticleSearchQuery).toHaveBeenLastCalledWith("");
    expect(screen.queryByText("detail.kbReferencesSearchEmpty")).not.toBeInTheDocument();
  });

  it("shows matching published articles once the agent searches, and attaches one on click", async () => {
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(usePublishedArticleSearchQuery).mockReturnValue(
      queryResult({
        data: page([{ id: "article-1", title: "How to reset a password" }]),
        isSuccess: true,
      }) as never,
    );
    const mutateAsync = vi.fn().mockResolvedValue({ id: "reference-new" });
    vi.mocked(useCreateTicketKbReferenceMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<TicketKbReferencesCard ticketId="ticket-1" />);
    fireEvent.change(screen.getByPlaceholderText("detail.kbReferencesSearchPlaceholder"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByText("detail.kbReferencesAttach"));

    await Promise.resolve();
    await Promise.resolve();

    expect(mutateAsync).toHaveBeenCalledWith({ articleId: "article-1" });
  });

  it("shows the empty-search message when a search matches no published article", () => {
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(usePublishedArticleSearchQuery).mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );

    render(<TicketKbReferencesCard ticketId="ticket-1" />);
    fireEvent.change(screen.getByPlaceholderText("detail.kbReferencesSearchPlaceholder"), {
      target: { value: "nonexistent" },
    });

    expect(screen.getByText("detail.kbReferencesSearchEmpty")).toBeInTheDocument();
  });

  it("shows the backend's own error message when attaching an article fails", async () => {
    vi.mocked(useTicketKbReferencesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(usePublishedArticleSearchQuery).mockReturnValue(
      queryResult({
        data: page([{ id: "article-1", title: "Draft-adjacent article" }]),
        isSuccess: true,
      }) as never,
    );
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Article not found", 404));
    vi.mocked(useCreateTicketKbReferenceMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<TicketKbReferencesCard ticketId="ticket-1" />);
    fireEvent.change(screen.getByPlaceholderText("detail.kbReferencesSearchPlaceholder"), {
      target: { value: "draft" },
    });
    fireEvent.click(screen.getByText("detail.kbReferencesAttach"));

    expect(await screen.findByText("Article not found")).toBeInTheDocument();
  });
});
