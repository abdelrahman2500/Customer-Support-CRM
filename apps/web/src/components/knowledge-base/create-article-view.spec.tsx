import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CreateArticleView } from "./create-article-view";
import { useCreateArticleMutation } from "@/hooks/use-knowledge-base";
import { useKbCategoriesQuery } from "@/hooks/use-kb-categories";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/use-knowledge-base", () => ({
  useCreateArticleMutation: vi.fn(),
}));

vi.mock("@/hooks/use-kb-categories", () => ({
  useKbCategoriesQuery: vi.fn(),
}));

const mockedUseCreateArticleMutation = vi.mocked(useCreateArticleMutation);
const mockedUseKbCategoriesQuery = vi.mocked(useKbCategoriesQuery);

function renderWithLocale(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CreateArticleView />
    </NextIntlClientProvider>,
  );
}

describe("CreateArticleView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseKbCategoriesQuery.mockReturnValue({
      data: [{ id: "category-1", branchId: "branch-1", name: "account", isActive: true }],
      isSuccess: true,
    } as never);
  });

  it("renders the form (English)", () => {
    mockedUseCreateArticleMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    renderWithLocale("en");

    expect(screen.getByText("New article")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create article" })).toBeInTheDocument();
  });

  it("renders the form (Arabic)", () => {
    mockedUseCreateArticleMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    renderWithLocale("ar");

    expect(screen.getByText("مقالة جديدة")).toBeInTheDocument();
  });

  it("disables submit until both title and body are entered", () => {
    mockedUseCreateArticleMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    renderWithLocale("en");

    expect(screen.getByRole("button", { name: "Create article" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "How to reset a password" } });
    expect(screen.getByRole("button", { name: "Create article" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Step-by-step..." } });
    expect(screen.getByRole("button", { name: "Create article" })).not.toBeDisabled();
  });

  it("submits the exact payload including optional category, and navigates to the list", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "article-1" });
    mockedUseCreateArticleMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "How to reset a password" } });
    fireEvent.click(within(screen.getByText("Category").closest("label")!).getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "account" }));
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Step-by-step..." } });
    fireEvent.click(screen.getByRole("button", { name: "Create article" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        title: "How to reset a password",
        body: "Step-by-step...",
        categoryId: "category-1",
      }),
    );
    expect(push).toHaveBeenCalledWith("/en/knowledge-base");
  });

  it("submits with no category when left blank", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "article-1" });
    mockedUseCreateArticleMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "How to reset a password" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Step-by-step..." } });
    fireEvent.click(screen.getByRole("button", { name: "Create article" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        title: "How to reset a password",
        body: "Step-by-step...",
      }),
    );
  });

  it("renders the backend's own message inline and preserves entered values on a rejected submission", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Title already exists", 400));
    mockedUseCreateArticleMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "How to reset a password" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Step-by-step..." } });
    fireEvent.click(screen.getByRole("button", { name: "Create article" }));

    expect(await screen.findByText("Title already exists")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toHaveValue("How to reset a password");
    expect(screen.getByLabelText("Body")).toHaveValue("Step-by-step...");
  });

  it("shows the shared network-error fallback for a non-ApiError failure", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
    mockedUseCreateArticleMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "How to reset a password" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Step-by-step..." } });
    fireEvent.click(screen.getByRole("button", { name: "Create article" }));

    // Batch 1 (UX audit) — a non-`ApiError` rejection is a network failure,
    // never this feature's own generic create-failed text.
    expect(
      await screen.findByText("Couldn't reach the server. Check your connection and try again."),
    ).toBeInTheDocument();
  });

  it("disables the submit button while the mutation is pending", () => {
    mockedUseCreateArticleMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "How to reset a password" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Step-by-step..." } });

    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });
});
