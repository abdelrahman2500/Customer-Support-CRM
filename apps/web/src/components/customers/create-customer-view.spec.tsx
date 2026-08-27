import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CreateCustomerView } from "./create-customer-view";
import { useCreateCustomerMutation } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useCreateCustomerMutation: vi.fn(),
}));

const mockedUseCreateCustomerMutation = vi.mocked(useCreateCustomerMutation);

function renderWithLocale(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CreateCustomerView />
    </NextIntlClientProvider>,
  );
}

describe("CreateCustomerView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form (English)", () => {
    mockedUseCreateCustomerMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    renderWithLocale("en");

    expect(screen.getByText("New customer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create customer" })).toBeInTheDocument();
  });

  it("renders the form (Arabic)", () => {
    mockedUseCreateCustomerMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    renderWithLocale("ar");

    expect(screen.getByText("عميل جديد")).toBeInTheDocument();
  });

  it("submits the exact { displayName } payload and shows a success confirmation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "customer-1", displayName: "Acme Inc." });
    mockedUseCreateCustomerMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Customer name"), {
      target: { value: "Acme Inc." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create customer" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ displayName: "Acme Inc." }));
    expect(await screen.findByText(/Customer "Acme Inc\." was created\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a ticket for them" })).toHaveAttribute(
      "href",
      "/en/tickets/new",
    );
  });

  it("renders the backend's own message inline on a rejected submission", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("displayName must not be empty", 400));
    mockedUseCreateCustomerMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.change(screen.getByLabelText("Customer name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create customer" }));

    expect(await screen.findByText("displayName must not be empty")).toBeInTheDocument();
  });

  it("disables the submit button while the mutation is pending", () => {
    mockedUseCreateCustomerMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as never);

    renderWithLocale("en");

    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });
});
