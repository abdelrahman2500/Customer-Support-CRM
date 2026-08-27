import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CreateTicketView } from "./create-ticket-view";
import { useCreateTicketMutation, useCustomersQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useCreateTicketMutation: vi.fn(),
  useCustomersQuery: vi.fn(),
}));

const mockedUseCreateTicketMutation = vi.mocked(useCreateTicketMutation);
const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);

function renderWithLocale(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CreateTicketView />
    </NextIntlClientProvider>,
  );
}

describe("CreateTicketView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCustomersQuery.mockReturnValue({
      data: [{ id: "customer-1", displayName: "Acme Inc." }],
    } as never);
  });

  it("renders the form with the existing customer list in the picker (English)", () => {
    mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderWithLocale("en");

    expect(screen.getByText("New ticket")).toBeInTheDocument();
    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
  });

  it("renders the form (Arabic)", () => {
    mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderWithLocale("ar");

    expect(screen.getByText("تذكرة جديدة")).toBeInTheDocument();
  });

  it("disables submit until a customer is selected", () => {
    mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderWithLocale("en");

    expect(screen.getByRole("button", { name: "Create ticket" })).toBeDisabled();
  });

  it("submits only { customerId, subject, category?, priority? } — never contactId/departmentId/assignedToUserId — and navigates to the new ticket", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "ticket-42" });
    mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.click(screen.getByText("Select a customer"));
    fireEvent.click(await screen.findByRole("option", { name: "Acme Inc." }));
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Cannot log in" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "billing" } });
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        customerId: "customer-1",
        subject: "Cannot log in",
        category: "billing",
      }),
    );
    expect(push).toHaveBeenCalledWith("/en/tickets/ticket-42");
  });

  it("renders the backend's own message inline on a rejected submission", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Customer not found", 404));
    mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.click(screen.getByText("Select a customer"));
    fireEvent.click(await screen.findByRole("option", { name: "Acme Inc." }));
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    expect(await screen.findByText("Customer not found")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
