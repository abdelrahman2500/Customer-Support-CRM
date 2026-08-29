import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CreateArticleView } from "./create-article-view";
import { useCreateArticleMutation } from "@/hooks/use-knowledge-base";
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

const mockedUseCreateArticleMutation = vi.mocked(useCreateArticleMutation);

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
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "account" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Step-by-step..." } });
    fireEvent.click(screen.getByRole("button", { name: "Create article" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        title: "How to reset a password",
        body: "Step-by-step...",
        category: "account",
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

  it("shows the generic create-failed fallback for a non-ApiError failure", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
    mockedUseCreateArticleMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "How to reset a password" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "Step-by-step..." } });
    fireEvent.click(screen.getByRole("button", { name: "Create article" }));

    expect(await screen.findByText("Couldn't create the article. Please try again.")).toBeInTheDocument();
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
