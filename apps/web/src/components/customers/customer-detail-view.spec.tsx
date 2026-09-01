import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { CustomerDetailView } from "./customer-detail-view";
import {
  useCreateContactMutation,
  useCustomerQuery,
  useSetContactPortalPasswordMutation,
  useTicketsQuery,
  useUpdateContactMutation,
  useUpdateCustomerMutation,
} from "@/hooks/use-tickets";
import { useAttachmentsQuery, useUploadAttachmentMutation } from "@/hooks/use-attachments";
import { ApiError } from "@/lib/api";

const push = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useCustomerQuery: vi.fn(),
  useTicketsQuery: vi.fn(),
  useUpdateCustomerMutation: vi.fn(),
  useCreateContactMutation: vi.fn(),
  useUpdateContactMutation: vi.fn(),
  useSetContactPortalPasswordMutation: vi.fn(),
}));

vi.mock("@/hooks/use-attachments", () => ({
  useAttachmentsQuery: vi.fn(),
  useUploadAttachmentMutation: vi.fn(),
}));

const mockedUseCustomerQuery = vi.mocked(useCustomerQuery);
const mockedUseTicketsQuery = vi.mocked(useTicketsQuery);
const mockedUseUpdateCustomerMutation = vi.mocked(useUpdateCustomerMutation);
const mockedUseCreateContactMutation = vi.mocked(useCreateContactMutation);
const mockedUseUpdateContactMutation = vi.mocked(useUpdateContactMutation);
const mockedUseSetContactPortalPasswordMutation = vi.mocked(useSetContactPortalPasswordMutation);
const mockedUseAttachmentsQuery = vi.mocked(useAttachmentsQuery);
const mockedUseUploadAttachmentMutation = vi.mocked(useUploadAttachmentMutation);

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

function idleMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

describe("CustomerDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every render path calls `useTicketsQuery({})` (Story 27); default to
    // an empty, successful result so pre-existing tests (which only assert
    // on the customer/contacts sections) are unaffected.
    mockedUseTicketsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [] }) as never,
    );
    mockedUseUpdateCustomerMutation.mockReturnValue(idleMutation() as never);
    mockedUseCreateContactMutation.mockReturnValue(idleMutation() as never);
    mockedUseUpdateContactMutation.mockReturnValue(idleMutation() as never);
    mockedUseSetContactPortalPasswordMutation.mockReturnValue(idleMutation() as never);
    // Story 67 — every render path also calls `useAttachmentsQuery` (the
    // new Attachments card); default to an empty, successful result so
    // pre-existing tests are unaffected.
    mockedUseAttachmentsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);
    mockedUseUploadAttachmentMutation.mockReturnValue(idleMutation() as never);
  });

  it("shows a loading state while the customer query is pending", () => {
    mockedUseCustomerQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("renders a not-found message when the customer lookup 404s", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<CustomerDetailView customerId="missing" />);

    expect(screen.getByText("detail.notFound")).toBeInTheDocument();
  });

  it("renders a generic load error for a non-404 failure", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getByText("detail.loadError")).toBeInTheDocument();
  });

  it("renders the customer's name, status, and contacts", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: {
          id: "customer-1",
          displayName: "Acme Inc.",
          isActive: true,
          contacts: [
            { id: "contact-1", fullName: "Jane Doe", email: "jane@acme.test", phone: null, isPrimary: true },
          ],
        },
      }) as never,
    );

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getByDisplayValue("Acme Inc.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jane Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("jane@acme.test")).toBeInTheDocument();
    // "detail.primaryContact" also labels the add-contact form's checkbox —
    // scope to the contacts list to assert the row's own primary badge.
    expect(within(screen.getByRole("list")).getByText("detail.primaryContact")).toBeInTheDocument();
  });

  it("renders an empty-contacts message when the customer has no contacts", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { id: "customer-1", displayName: "Acme Inc.", isActive: false, contacts: [] },
      }) as never,
    );

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getByText("detail.contactsEmpty")).toBeInTheDocument();
  });

  // Story 27 — Related tickets section + "New ticket" action.
  describe("related tickets (Story 27)", () => {
    beforeEach(() => {
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: { id: "customer-1", displayName: "Acme Inc.", isActive: true, contacts: [] },
        }) as never,
      );
    });

    it("shows a loading state while the tickets query is pending", () => {
      mockedUseTicketsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.ticketsHeading")).toBeInTheDocument();
    });

    it("shows an error state when the tickets query fails", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.ticketsError")).toBeInTheDocument();
    });

    it("shows an empty-state message when the customer has no tickets", () => {
      mockedUseTicketsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.ticketsEmpty")).toBeInTheDocument();
    });

    it("lists only tickets whose customerId matches this customer, filtered client-side", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [
            {
              id: "ticket-1",
              subject: "Cannot log in",
              status: "OPEN",
              priority: "HIGH",
              customerId: "customer-1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "ticket-2",
              subject: "Unrelated ticket",
              status: "OPEN",
              priority: "LOW",
              customerId: "customer-other",
              createdAt: "2026-01-02T00:00:00.000Z",
            },
          ],
        }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("Cannot log in")).toBeInTheDocument();
      expect(screen.queryByText("Unrelated ticket")).not.toBeInTheDocument();
    });

    it("navigates to the ticket detail route when a related ticket row is clicked", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: [
            {
              id: "ticket-1",
              subject: "Cannot log in",
              status: "OPEN",
              priority: "HIGH",
              customerId: "customer-1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);
      fireEvent.click(screen.getByText("Cannot log in"));

      expect(push).toHaveBeenCalledWith("/en/tickets/ticket-1");
    });

    it("navigates to tickets/new with the current customerId when 'New ticket' is clicked", () => {
      mockedUseTicketsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      fireEvent.click(screen.getByText("detail.newTicketButton"));

      expect(push).toHaveBeenCalledWith("/en/tickets/new?customerId=customer-1");
    });
  });

  // Story 30 — customer field editing + contact CRUD.
  describe("customer editing (Story 30)", () => {
    beforeEach(() => {
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: { id: "customer-1", displayName: "Acme Inc.", isActive: true, contacts: [] },
        }) as never,
      );
    });

    it("commits a changed display name on blur via the real PATCH /customers/:id mutation", () => {
      const mutate = vi.fn();
      mockedUseUpdateCustomerMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      const input = screen.getByDisplayValue("Acme Inc.");
      fireEvent.change(input, { target: { value: "Acme Corp." } });
      fireEvent.blur(input);

      expect(mutate).toHaveBeenCalledWith({ displayName: "Acme Corp." });
    });

    it("does not commit when the display name is blurred unchanged", () => {
      const mutate = vi.fn();
      mockedUseUpdateCustomerMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      const input = screen.getByDisplayValue("Acme Inc.");
      fireEvent.blur(input);

      expect(mutate).not.toHaveBeenCalled();
    });

    it("toggles isActive via the real PATCH /customers/:id mutation", async () => {
      const mutate = vi.fn();
      mockedUseUpdateCustomerMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      fireEvent.click(screen.getByText("list.active"));
      fireEvent.click(await screen.findByRole("option", { name: "list.inactive" }));

      expect(mutate).toHaveBeenCalledWith({ isActive: false });
    });

    it("shows a forbidden-specific message when a customer edit is rejected with 403", () => {
      mockedUseUpdateCustomerMutation.mockReturnValue(
        idleMutation({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.actionForbidden")).toBeInTheDocument();
    });

    it("shows a generic failure message when a customer edit is rejected with a non-403 error", () => {
      mockedUseUpdateCustomerMutation.mockReturnValue(
        idleMutation({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.actionFailed")).toBeInTheDocument();
    });
  });

  describe("contact editing (Story 30)", () => {
    beforeEach(() => {
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: {
            id: "customer-1",
            displayName: "Acme Inc.",
            isActive: true,
            contacts: [
              { id: "contact-1", fullName: "Jane Doe", email: "jane@acme.test", phone: null, isPrimary: false },
            ],
          },
        }) as never,
      );
    });

    it("commits a changed contact full name on blur via the real PATCH contact mutation", () => {
      const mutate = vi.fn();
      mockedUseUpdateContactMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      const input = screen.getByDisplayValue("Jane Doe");
      fireEvent.change(input, { target: { value: "Jane Smith" } });
      fireEvent.blur(input);

      expect(mockedUseUpdateContactMutation).toHaveBeenCalledWith("customer-1", "contact-1");
      expect(mutate).toHaveBeenCalledWith({ fullName: "Jane Smith" });
    });

    it("toggles a contact's primary flag via the real PATCH contact mutation", () => {
      const mutate = vi.fn();
      mockedUseUpdateContactMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      fireEvent.click(screen.getByText("detail.setPrimary"));

      expect(mutate).toHaveBeenCalledWith({ isPrimary: true });
    });

    it("shows a forbidden-specific message when a contact edit is rejected with 403", () => {
      mockedUseUpdateContactMutation.mockReturnValue(
        idleMutation({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.actionForbidden")).toBeInTheDocument();
    });

    it("submits a new contact via the real POST /customers/:id/contacts mutation and clears the form on success", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "contact-2" });
      mockedUseCreateContactMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      // "detail.contactFullNameLabel"/"detail.contactEmailLabel" also label
      // each existing contact row's inline-edit fields — scope to the
      // add-contact form itself (found via its own submit button).
      const form = screen.getByText("detail.addContactSubmit").closest("form") as HTMLFormElement;
      fireEvent.change(within(form).getByLabelText("detail.contactFullNameLabel"), {
        target: { value: "New Contact" },
      });
      fireEvent.change(within(form).getByLabelText("detail.contactEmailLabel"), {
        target: { value: "new@acme.test" },
      });
      fireEvent.click(within(form).getByText("detail.addContactSubmit"));

      await waitFor(() =>
        expect(mutateAsync).toHaveBeenCalledWith({ fullName: "New Contact", email: "new@acme.test" }),
      );
      await waitFor(() =>
        expect(within(form).getByLabelText("detail.contactFullNameLabel")).toHaveValue(""),
      );
    });

    it("renders the backend's own message inline when adding a contact fails", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Email already in use", 409));
      mockedUseCreateContactMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      const form = screen.getByText("detail.addContactSubmit").closest("form") as HTMLFormElement;
      fireEvent.change(within(form).getByLabelText("detail.contactFullNameLabel"), {
        target: { value: "New Contact" },
      });
      fireEvent.click(within(form).getByText("detail.addContactSubmit"));

      expect(await screen.findByText("Email already in use")).toBeInTheDocument();
    });
  });

  // Story 52 — Customer Portal — Contact Authentication Foundation.
  describe("set contact portal password (Story 52)", () => {
    beforeEach(() => {
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: {
            id: "customer-1",
            displayName: "Acme Inc.",
            isActive: true,
            contacts: [
              { id: "contact-1", fullName: "Jane Doe", email: "jane@acme.test", phone: null, isPrimary: false },
            ],
          },
        }) as never,
      );
    });

    it("keeps the submit button disabled until the draft is at least 8 characters", () => {
      render(<CustomerDetailView customerId="customer-1" />);

      const input = screen.getByPlaceholderText("detail.portalPasswordPlaceholder");
      const submit = screen.getByText("detail.portalPasswordSubmit");
      expect(submit).toBeDisabled();

      fireEvent.change(input, { target: { value: "short1" } });
      expect(submit).toBeDisabled();

      fireEvent.change(input, { target: { value: "longenough1" } });
      expect(submit).not.toBeDisabled();
    });

    it("does not commit on blur, and clicking submit opens a confirmation dialog rather than committing immediately", () => {
      const mutate = vi.fn();
      mockedUseSetContactPortalPasswordMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      const input = screen.getByPlaceholderText("detail.portalPasswordPlaceholder");
      fireEvent.change(input, { target: { value: "newpassword1" } });
      fireEvent.blur(input);
      expect(mutate).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "detail.portalPasswordSubmit" }));

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(mutate).not.toHaveBeenCalled();
    });

    it("commits with the exact { newPassword } payload only once the confirmation dialog's own submit button is clicked", () => {
      const mutate = vi.fn();
      mockedUseSetContactPortalPasswordMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      const input = screen.getByPlaceholderText("detail.portalPasswordPlaceholder");
      fireEvent.change(input, { target: { value: "newpassword1" } });
      fireEvent.click(screen.getByRole("button", { name: "detail.portalPasswordSubmit" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "detail.portalPasswordSubmit" }));

      expect(mockedUseSetContactPortalPasswordMutation).toHaveBeenCalledWith(
        "customer-1",
        "contact-1",
      );
      expect(mutate).toHaveBeenCalledWith(
        { newPassword: "newpassword1" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("clears the field and shows a success message when the mutation succeeds", () => {
      let capturedOnSuccess: (() => void) | undefined;
      const mutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => {
        capturedOnSuccess = options?.onSuccess;
      });
      mockedUseSetContactPortalPasswordMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      const input = screen.getByPlaceholderText("detail.portalPasswordPlaceholder");
      fireEvent.change(input, { target: { value: "newpassword1" } });
      fireEvent.click(screen.getByRole("button", { name: "detail.portalPasswordSubmit" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "detail.portalPasswordSubmit" }));
      act(() => {
        capturedOnSuccess?.();
      });

      expect(input).toHaveValue("");
      expect(screen.getByText("detail.portalPasswordSuccess")).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("renders the backend's own message inline when the mutation fails", () => {
      mockedUseSetContactPortalPasswordMutation.mockReturnValue(
        idleMutation({
          isError: true,
          error: new ApiError("Another contact already has portal access with this email address", 409),
        }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(
        screen.getByText("Another contact already has portal access with this email address"),
      ).toBeInTheDocument();
    });
  });

  describe("Attachments card (Story 67)", () => {
    beforeEach(() => {
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: { id: "customer-1", displayName: "Acme Inc.", isActive: true, contacts: [] },
        }) as never,
      );
    });

    it("renders the empty message when there are no attachments", () => {
      mockedUseAttachmentsQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.attachmentsEmpty")).toBeInTheDocument();
    });

    it("renders an inline error when attachments fail to load", () => {
      mockedUseAttachmentsQuery.mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.attachmentsError")).toBeInTheDocument();
    });

    it("uploads the selected file, scoped to this customer", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "attachment-new" });
      mockedUseAttachmentsQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      mockedUseUploadAttachmentMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      const file = new File(["hello"], "contract.txt", { type: "text/plain" });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledWith(file);
      });
    });
  });

  // Story 97 — Loading & Skeleton UX.
  describe("loading & skeleton UX (Story 97)", () => {
    it("renders a shaped skeleton — not the customer content — while the customer itself is loading", () => {
      mockedUseCustomerQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      const { container } = render(<CustomerDetailView customerId="customer-1" />);

      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(3);
    });
  });
});
