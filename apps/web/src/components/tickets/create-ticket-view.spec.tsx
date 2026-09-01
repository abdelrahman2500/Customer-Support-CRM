import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CreateTicketView } from "./create-ticket-view";
import {
  useCreateTicketMutation,
  useCustomerQuery,
  useCustomersQuery,
  useDepartmentsQuery,
  useUsersQuery,
} from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";
import { showSuccessToast } from "@/lib/toast-store";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const push = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/toast-store", () => ({
  showSuccessToast: vi.fn(),
}));

const mockedShowSuccessToast = vi.mocked(showSuccessToast);

vi.mock("@/hooks/use-tickets", () => ({
  useCreateTicketMutation: vi.fn(),
  useCustomersQuery: vi.fn(),
  useCustomerQuery: vi.fn(),
  useDepartmentsQuery: vi.fn(),
  useUsersQuery: vi.fn(),
}));

const mockedUseCreateTicketMutation = vi.mocked(useCreateTicketMutation);
const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);
const mockedUseCustomerQuery = vi.mocked(useCustomerQuery);
const mockedUseDepartmentsQuery = vi.mocked(useDepartmentsQuery);
const mockedUseUsersQuery = vi.mocked(useUsersQuery);

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    ...overrides,
  };
}

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
    mockSearchParams = new URLSearchParams();
    mockedUseCustomersQuery.mockReturnValue({
      data: [{ id: "customer-1", displayName: "Acme Inc." }],
    } as never);
    mockedUseCustomerQuery.mockReturnValue(queryResult({ data: undefined }) as never);
    mockedUseDepartmentsQuery.mockReturnValue(queryResult({ data: [] }) as never);
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [] }) as never);
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

  it("submits only { customerId, subject, category?, priority? } when contact/department/assignee are left unset (Story 43 base case), and navigates to the new ticket", async () => {
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

  // Story 94 — success feedback.
  it("shows a translated success toast, and only after the mutation actually resolves", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "ticket-42" });
    mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.click(screen.getByText("Select a customer"));
    fireEvent.click(await screen.findByRole("option", { name: "Acme Inc." }));
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Cannot log in" } });
    expect(mockedShowSuccessToast).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    await waitFor(() => expect(mockedShowSuccessToast).toHaveBeenCalledWith("Ticket created."));
  });

  it("never shows a success toast when the mutation is rejected", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Customer not found", 404));
    mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithLocale("en");

    fireEvent.click(screen.getByText("Select a customer"));
    fireEvent.click(await screen.findByRole("option", { name: "Acme Inc." }));
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    await screen.findByText("Customer not found");
    expect(mockedShowSuccessToast).not.toHaveBeenCalled();
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

  // Story 27 — customerId query-parameter prefill.
  describe("customerId query-parameter prefill (Story 27)", () => {
    it("pre-selects the customer when the query parameter matches a loaded customer", () => {
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
      mockSearchParams = new URLSearchParams({ customerId: "customer-1" });

      renderWithLocale("en");

      // The submit button is disabled purely on `!customerId` (independent
      // of subject) — an enabled button here proves the picker was seeded
      // from the query parameter, without depending on Radix's internal
      // trigger-label rendering.
      expect(screen.getByRole("button", { name: "Create ticket" })).not.toBeDisabled();
    });

    it("leaves the picker unselected when the query parameter does not match any loaded customer", () => {
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
      mockSearchParams = new URLSearchParams({ customerId: "unknown-customer" });

      renderWithLocale("en");

      expect(screen.getByRole("button", { name: "Create ticket" })).toBeDisabled();
      expect(screen.getByText("Select a customer")).toBeInTheDocument();
    });

    it("leaves the picker unselected (unchanged existing behavior) when no query parameter is present", () => {
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
      mockSearchParams = new URLSearchParams();

      renderWithLocale("en");

      expect(screen.getByRole("button", { name: "Create ticket" })).toBeDisabled();
      expect(screen.getByText("Select a customer")).toBeInTheDocument();
    });

    it("still lets the agent change the pre-selected customer before submitting", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "ticket-42" });
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync, isPending: false } as never);
      mockedUseCustomersQuery.mockReturnValue({
        data: [
          { id: "customer-1", displayName: "Acme Inc." },
          { id: "customer-2", displayName: "Widgets Co." },
        ],
      } as never);
      mockSearchParams = new URLSearchParams({ customerId: "customer-1" });

      renderWithLocale("en");

      // Pre-selected — submit is already enabled from the query param alone.
      expect(screen.getByRole("button", { name: "Create ticket" })).not.toBeDisabled();

      // Open the picker via its combobox role (robust to whatever label the
      // trigger currently shows) and pick the other customer instead.
      const customerCombobox = screen.getAllByRole("combobox")[0] as HTMLElement;
      fireEvent.click(customerCombobox);
      fireEvent.click(await screen.findByRole("option", { name: "Widgets Co." }));
      fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Billing question" } });
      fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

      await waitFor(() =>
        expect(mutateAsync).toHaveBeenCalledWith({
          customerId: "customer-2",
          subject: "Billing question",
        }),
      );
    });
  });

  // Story 43 — contact/department/assignee at creation.
  describe("contact/department/assignee at creation (Story 43)", () => {
    it("does not render the contact picker before a customer is selected", () => {
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

      renderWithLocale("en");

      expect(screen.queryByText("Contact")).not.toBeInTheDocument();
    });

    it("reveals the contact picker, populated with the selected customer's real contacts, once a customer is chosen", async () => {
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          data: {
            id: "customer-1",
            displayName: "Acme Inc.",
            isActive: true,
            contacts: [{ id: "contact-1", fullName: "Jane Doe", email: null, phone: null, isPrimary: true }],
          },
          isSuccess: true,
        }) as never,
      );

      renderWithLocale("en");
      fireEvent.click(screen.getByText("Select a customer"));
      fireEvent.click(await screen.findByRole("option", { name: "Acme Inc." }));

      expect(screen.getByText("Contact")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    it("shows only the no-specific-contact option for a customer with zero contacts", async () => {
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          data: { id: "customer-1", displayName: "Acme Inc.", isActive: true, contacts: [] },
          isSuccess: true,
        }) as never,
      );

      renderWithLocale("en");
      fireEvent.click(screen.getByText("Select a customer"));
      fireEvent.click(await screen.findByRole("option", { name: "Acme Inc." }));

      // Scoped to the contact trigger's own button (index 1: customer,
      // contact, once a customer is selected) — Radix also mirrors this
      // same label into a visually-hidden, sibling native `<option>` for
      // form semantics, so an unscoped `getByText` would be ambiguous.
      const contactCombobox = screen.getAllByRole("combobox")[1] as HTMLElement;
      expect(within(contactCombobox).getByText("No specific contact")).toBeInTheDocument();
    });

    it("resets any previously chosen contact when the customer selection changes", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "ticket-42" });
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync, isPending: false } as never);
      mockedUseCustomersQuery.mockReturnValue({
        data: [
          { id: "customer-1", displayName: "Acme Inc." },
          { id: "customer-2", displayName: "Widgets Co." },
        ],
      } as never);
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          data: {
            id: "customer-1",
            displayName: "Acme Inc.",
            isActive: true,
            contacts: [{ id: "contact-1", fullName: "Jane Doe", email: null, phone: null, isPrimary: true }],
          },
          isSuccess: true,
        }) as never,
      );

      renderWithLocale("en");

      fireEvent.click(screen.getByText("Select a customer"));
      fireEvent.click(await screen.findByRole("option", { name: "Acme Inc." }));

      const contactCombobox = screen.getAllByRole("combobox")[1] as HTMLElement;
      fireEvent.click(contactCombobox);
      fireEvent.click(await screen.findByRole("option", { name: "Jane Doe" }));
      expect(within(contactCombobox).getByText("Jane Doe")).toBeInTheDocument();

      const customerCombobox = screen.getAllByRole("combobox")[0] as HTMLElement;
      fireEvent.click(customerCombobox);
      fireEvent.click(await screen.findByRole("option", { name: "Widgets Co." }));

      expect(within(contactCombobox).getByText("No specific contact")).toBeInTheDocument();
    });

    it("submits the chosen contact/department/assignee alongside the base fields", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "ticket-42" });
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync, isPending: false } as never);
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          data: {
            id: "customer-1",
            displayName: "Acme Inc.",
            isActive: true,
            contacts: [{ id: "contact-1", fullName: "Jane Doe", email: null, phone: null, isPrimary: true }],
          },
          isSuccess: true,
        }) as never,
      );
      mockedUseDepartmentsQuery.mockReturnValue(
        queryResult({
          data: [{ id: "dept-1", branchId: "branch-1", name: "Billing" }],
          isSuccess: true,
        }) as never,
      );
      mockedUseUsersQuery.mockReturnValue(
        queryResult({
          data: [{ id: "user-1", email: "agent@example.com", fullName: "Ada Lovelace", isActive: true, roles: [] }],
          isSuccess: true,
        }) as never,
      );

      renderWithLocale("en");

      fireEvent.click(screen.getByText("Select a customer"));
      fireEvent.click(await screen.findByRole("option", { name: "Acme Inc." }));
      fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Cannot log in" } });

      // Indices, once a customer is selected: 0 customer, 1 contact,
      // 2 priority, 3 department, 4 assignee.
      const comboboxes = screen.getAllByRole("combobox");

      fireEvent.click(comboboxes[1]!);
      fireEvent.click(await screen.findByRole("option", { name: "Jane Doe" }));

      fireEvent.click(comboboxes[3]!);
      fireEvent.click(await screen.findByRole("option", { name: "Billing" }));

      fireEvent.click(comboboxes[4]!);
      fireEvent.click(await screen.findByRole("option", { name: "Ada Lovelace" }));

      fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

      await waitFor(() =>
        expect(mutateAsync).toHaveBeenCalledWith({
          customerId: "customer-1",
          subject: "Cannot log in",
          contactId: "contact-1",
          departmentId: "dept-1",
          assignedToUserId: "user-1",
        }),
      );
    });

    it("renders an inline error for each picker when its own query fails, independently of the others", async () => {
      mockedUseCreateTicketMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
      mockedUseCustomerQuery.mockReturnValue(queryResult({ isError: true }) as never);
      mockedUseDepartmentsQuery.mockReturnValue(queryResult({ isError: true }) as never);
      mockedUseUsersQuery.mockReturnValue(queryResult({ isError: true }) as never);

      renderWithLocale("en");
      fireEvent.click(screen.getByText("Select a customer"));
      fireEvent.click(await screen.findByRole("option", { name: "Acme Inc." }));

      expect(screen.getByText("Couldn't load this customer's contacts.")).toBeInTheDocument();
      expect(screen.getByText("Couldn't load departments.")).toBeInTheDocument();
      expect(screen.getByText("Couldn't load agents.")).toBeInTheDocument();
    });
  });
});
