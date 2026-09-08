import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { CustomerDetailView } from "./customer-detail-view";
import {
  useCreateContactMutation,
  useCreateCustomerNoteMutation,
  useCustomerNotesQuery,
  useCustomerQuery,
  useRevokeContactPortalAccessMutation,
  useSetContactPortalPasswordMutation,
  useTicketsQuery,
  useUpdateContactMutation,
  useUpdateCustomerMutation,
  useUsersQuery,
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
  useRevokeContactPortalAccessMutation: vi.fn(),
  useCustomerNotesQuery: vi.fn(),
  useCreateCustomerNoteMutation: vi.fn(),
  useUsersQuery: vi.fn(),
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
const mockedUseRevokeContactPortalAccessMutation = vi.mocked(useRevokeContactPortalAccessMutation);
const mockedUseAttachmentsQuery = vi.mocked(useAttachmentsQuery);
const mockedUseUploadAttachmentMutation = vi.mocked(useUploadAttachmentMutation);
const mockedUseCustomerNotesQuery = vi.mocked(useCustomerNotesQuery);
const mockedUseCreateCustomerNoteMutation = vi.mocked(useCreateCustomerNoteMutation);
const mockedUseUsersQuery = vi.mocked(useUsersQuery);

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

/**
 * Story S-8e — `GET /tickets` and `GET /customers` return a
 * `Paginated<T>` envelope, so these queries' `data` is no longer a bare
 * array. Builds one, defaulting to a single full page so the existing
 * tests read exactly as they did before. Mirrors
 * `audit-log-view.spec.tsx`'s own helper.
 */
function page(items: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 25,
    totalPages: 1,
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
      queryResult({ isSuccess: true, data: page([]) }) as never,
    );
    mockedUseUpdateCustomerMutation.mockReturnValue(idleMutation() as never);
    mockedUseCreateContactMutation.mockReturnValue(idleMutation() as never);
    mockedUseUpdateContactMutation.mockReturnValue(idleMutation() as never);
    mockedUseSetContactPortalPasswordMutation.mockReturnValue(idleMutation() as never);
    mockedUseRevokeContactPortalAccessMutation.mockReturnValue(idleMutation() as never);
    // Story 67 — every render path also calls `useAttachmentsQuery` (the
    // new Attachments card); default to an empty, successful result so
    // pre-existing tests are unaffected.
    mockedUseAttachmentsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);
    mockedUseUploadAttachmentMutation.mockReturnValue(idleMutation() as never);
    // RM-02 — every render path also calls `useCustomerNotesQuery`/
    // `useUsersQuery` (the new Notes card); default to an empty, successful
    // result so pre-existing tests are unaffected.
    mockedUseCustomerNotesQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);
    mockedUseUsersQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);
    mockedUseCreateCustomerNoteMutation.mockReturnValue(idleMutation() as never);
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
            {
              id: "contact-1",
              fullName: "Jane Doe",
              email: "jane@acme.test",
              phone: null,
              isPrimary: true,
            },
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

  // Batch 3 (UX audit) — mirrors the portal's own equivalent link, which
  // this screen never had.
  it("renders a back-to-list link to the customer list", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { id: "customer-1", displayName: "Acme Inc.", isActive: true, contacts: [] },
      }) as never,
    );

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getByRole("link", { name: /detail.backToList/ })).toHaveAttribute(
      "href",
      "/en/customers",
    );
  });

  // NAV-2 — this page had no heading landmark at all (the name is an
  // editable Input, not static text a plain <h1> could reuse).
  it("gives the page a level-1 heading landmark matching the customer's name", () => {
    mockedUseCustomerQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: { id: "customer-1", displayName: "Acme Inc.", isActive: true, contacts: [] },
      }) as never,
    );

    render(<CustomerDetailView customerId="customer-1" />);

    expect(screen.getByRole("heading", { level: 1, name: "Acme Inc." })).toBeInTheDocument();
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
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([]) }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.ticketsEmpty")).toBeInTheDocument();
    });

    it("asks the server for this customer's tickets, rather than filtering a branch-wide list", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([
            {
              id: "ticket-1",
              subject: "Cannot log in",
              status: "OPEN",
              priority: "HIGH",
              customerId: "customer-1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
        }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      /**
       * Story S-8d — the screen used to fetch the branch-wide list and keep
       * the rows whose `customerId` matched, which meant a customer whose
       * tickets fell outside the capped window appeared to have none. The
       * filter is the server's job now, so what matters is that the request
       * carries it - and that the returned rows are rendered as given.
       */
      // Story S-8e — the card carries its own page state, so the request
      // names the page it wants.
      expect(mockedUseTicketsQuery).toHaveBeenLastCalledWith({
        customerId: "customer-1",
        page: 1,
      });
      expect(screen.getByText("Cannot log in")).toBeInTheDocument();
    });

    // Story 98 — Design System & Visual Polish.
    it("gives each related ticket's status badge a distinct visual treatment", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([
            {
              id: "ticket-1",
              subject: "Open ticket",
              status: "OPEN",
              priority: "LOW",
              customerId: "customer-1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "ticket-2",
              subject: "Resolved ticket",
              status: "RESOLVED",
              priority: "LOW",
              customerId: "customer-1",
              createdAt: "2026-01-02T00:00:00.000Z",
            },
          ]),
        }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("OPEN")).toHaveClass("bg-warning-surface");
      expect(screen.getByText("RESOLVED")).toHaveClass("bg-success-surface");
    });

    it("navigates to the ticket detail route when a related ticket row is clicked", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: page([
            {
              id: "ticket-1",
              subject: "Cannot log in",
              status: "OPEN",
              priority: "HIGH",
              customerId: "customer-1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ]),
        }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      // Story S-6: a real link, so the destination is assertable and the
      // row can be middle-clicked or opened in a new tab.
      expect(screen.getByRole("link", { name: "Cannot log in" })).toHaveAttribute(
        "href",
        "/en/tickets/ticket-1",
      );
    });

    it("links 'New ticket' to tickets/new, carrying the current customerId", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([]) }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      // Still styled as a button, but a real link underneath (Button asChild),
      // so the query parameter survives an open-in-new-tab.
      expect(screen.getByRole("link", { name: "detail.newTicketButton" })).toHaveAttribute(
        "href",
        "/en/tickets/new?customerId=customer-1",
      );
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

      // Batch 5 (UX audit) — the mutation now also carries an `onError`
      // revert callback (second arg), mirroring `SlaPolicyRow`'s pattern.
      expect(mutate).toHaveBeenCalledWith(
        { displayName: "Acme Corp." },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it("reverts the display name field to the server value when the mutation is rejected", () => {
      const mutate = vi.fn();
      mockedUseUpdateCustomerMutation.mockReturnValue(idleMutation({ mutate }) as never);

      render(<CustomerDetailView customerId="customer-1" />);
      const input = screen.getByDisplayValue("Acme Inc.");
      fireEvent.change(input, { target: { value: "Acme Corp." } });
      fireEvent.blur(input);

      const onError = mutate.mock.calls[0]![1].onError as () => void;
      act(() => onError());

      expect(screen.getByDisplayValue("Acme Inc.")).toBeInTheDocument();
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

    // A11Y-2 — this Select had no label of any kind; it's now named the
    // same as the list view's own status filter (`list.filterStatus`).
    it("gives the status combobox an accessible name", () => {
      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByRole("combobox", { name: "list.filterStatus" })).toBeInTheDocument();
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
              {
                id: "contact-1",
                fullName: "Jane Doe",
                email: "jane@acme.test",
                phone: null,
                isPrimary: false,
              },
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
        expect(mutateAsync).toHaveBeenCalledWith({
          fullName: "New Contact",
          email: "new@acme.test",
        }),
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
              {
                id: "contact-1",
                fullName: "Jane Doe",
                email: "jane@acme.test",
                phone: null,
                isPrimary: false,
              },
            ],
          },
        }) as never,
      );
    });

    // Story 98 — Design System & Visual Polish. This action is irreversible
    // (it invalidates whatever the contact currently signs in with) and its
    // own ConfirmDialog already renders a destructive confirm button; the
    // trigger must agree rather than looking like a routine secondary action.
    it("styles the submit trigger as destructive, matching its own confirmation dialog", () => {
      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.portalPasswordSubmit")).toHaveClass("bg-danger-solid");
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
          error: new ApiError(
            "Another contact already has portal access with this email address",
            409,
          ),
        }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(
        screen.getByText("Another contact already has portal access with this email address"),
      ).toBeInTheDocument();
    });
  });

  // Story 100 — Identity & Access: Security Hardening.
  describe("revoke contact portal access (Story 100)", () => {
    function customerWithContact(hasPortalAccess: boolean) {
      return queryResult({
        isSuccess: true,
        data: {
          id: "customer-1",
          displayName: "Acme Inc.",
          isActive: true,
          contacts: [
            {
              id: "contact-1",
              fullName: "Jane Doe",
              email: "jane@acme.test",
              phone: null,
              isPrimary: false,
              hasPortalAccess,
            },
          ],
        },
      }) as never;
    }

    it("shows no revoke affordance for a contact without portal access", () => {
      mockedUseCustomerQuery.mockReturnValue(customerWithContact(false));

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.queryByText("detail.revokePortalAccessSubmit")).not.toBeInTheDocument();
      expect(screen.queryByText("detail.portalAccessGranted")).not.toBeInTheDocument();
    });

    it("shows the revoke affordance for a contact with portal access", () => {
      mockedUseCustomerQuery.mockReturnValue(customerWithContact(true));

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.portalAccessGranted")).toBeInTheDocument();
      expect(screen.getByText("detail.revokePortalAccessSubmit")).toHaveClass("bg-danger-solid");
    });

    it("clicking revoke opens a confirmation dialog rather than committing immediately", () => {
      const mutate = vi.fn();
      mockedUseRevokeContactPortalAccessMutation.mockReturnValue(idleMutation({ mutate }) as never);
      mockedUseCustomerQuery.mockReturnValue(customerWithContact(true));

      render(<CustomerDetailView customerId="customer-1" />);
      fireEvent.click(screen.getByRole("button", { name: "detail.revokePortalAccessSubmit" }));

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(mutate).not.toHaveBeenCalled();
    });

    it("commits with no arguments only once the confirmation dialog's own submit button is clicked", () => {
      const mutate = vi.fn();
      mockedUseRevokeContactPortalAccessMutation.mockReturnValue(idleMutation({ mutate }) as never);
      mockedUseCustomerQuery.mockReturnValue(customerWithContact(true));

      render(<CustomerDetailView customerId="customer-1" />);
      fireEvent.click(screen.getByRole("button", { name: "detail.revokePortalAccessSubmit" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "detail.revokePortalAccessSubmit" }),
      );

      expect(mockedUseRevokeContactPortalAccessMutation).toHaveBeenCalledWith(
        "customer-1",
        "contact-1",
      );
      expect(mutate).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("closes the confirmation dialog when the mutation succeeds", () => {
      let capturedOnSuccess: (() => void) | undefined;
      const mutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) => {
        capturedOnSuccess = options?.onSuccess;
      });
      mockedUseRevokeContactPortalAccessMutation.mockReturnValue(idleMutation({ mutate }) as never);
      mockedUseCustomerQuery.mockReturnValue(customerWithContact(true));

      render(<CustomerDetailView customerId="customer-1" />);
      fireEvent.click(screen.getByRole("button", { name: "detail.revokePortalAccessSubmit" }));
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "detail.revokePortalAccessSubmit" }),
      );
      act(() => {
        capturedOnSuccess?.();
      });

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("renders the backend's own message inline when the mutation fails", () => {
      mockedUseRevokeContactPortalAccessMutation.mockReturnValue(
        idleMutation({ isError: true, error: new ApiError("Contact not found", 404) }) as never,
      );
      mockedUseCustomerQuery.mockReturnValue(customerWithContact(true));

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("Contact not found")).toBeInTheDocument();
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

  describe("Notes card (RM-02)", () => {
    beforeEach(() => {
      mockedUseCustomerQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: { id: "customer-1", displayName: "Acme Inc.", isActive: true, contacts: [] },
        }) as never,
      );
    });

    it("renders a skeleton while notes are loading", () => {
      mockedUseCustomerNotesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

      render(<CustomerDetailView customerId="customer-1" />);

      const heading = screen.getByText("detail.notesHeading");
      const card = heading.parentElement as HTMLElement;
      expect(card.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders an inline error when notes fail to load", () => {
      mockedUseCustomerNotesQuery.mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.notesError")).toBeInTheDocument();
    });

    it("renders the empty message when there are no notes", () => {
      mockedUseCustomerNotesQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.notesEmpty")).toBeInTheDocument();
    });

    it("renders each note's resolved author name and timestamp", () => {
      mockedUseUsersQuery.mockReturnValue(
        queryResult({
          data: [{ id: "user-1", fullName: "Jane Agent" }],
          isSuccess: true,
        }) as never,
      );
      const notes = [
        {
          id: "note-1",
          customerId: "customer-1",
          authorUserId: "user-1",
          body: "Called the customer back.",
          createdAt: "2024-01-01T10:05:00.000Z",
        },
      ];
      mockedUseCustomerNotesQuery.mockReturnValue(
        queryResult({ data: notes, isSuccess: true }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("Jane Agent")).toBeInTheDocument();
      expect(screen.getByText("Called the customer back.")).toBeInTheDocument();
      expect(
        screen.getByText(new Date(notes[0]!.createdAt).toLocaleString("en")),
      ).toBeInTheDocument();
    });

    it("falls back to the raw authorUserId when the author isn't found in the users list", () => {
      const notes = [
        {
          id: "note-1",
          customerId: "customer-1",
          authorUserId: "user-unknown",
          body: "Note from an unresolvable author.",
          createdAt: "2024-01-01T10:05:00.000Z",
        },
      ];
      mockedUseCustomerNotesQuery.mockReturnValue(
        queryResult({ data: notes, isSuccess: true }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("user-unknown")).toBeInTheDocument();
    });

    it("disables the submit button until the note body is non-empty", () => {
      mockedUseCustomerNotesQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      const submit = screen.getByText("detail.notesSubmit");
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText("detail.notesPlaceholder"), {
        target: { value: "A new note" },
      });

      expect(submit).not.toBeDisabled();
    });

    it("submits the exact { body } payload and clears the field on success", async () => {
      mockedUseCustomerNotesQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      const mutateAsync = vi.fn().mockResolvedValue({ id: "note-new" });
      mockedUseCreateCustomerNoteMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

      render(<CustomerDetailView customerId="customer-1" />);

      const textarea = screen.getByPlaceholderText(
        "detail.notesPlaceholder",
      ) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "A new note" } });
      fireEvent.click(screen.getByText("detail.notesSubmit"));

      await Promise.resolve();
      await Promise.resolve();

      expect(mutateAsync).toHaveBeenCalledWith({ body: "A new note" });
      expect(textarea.value).toBe("");
    });

    it("shows the backend's own error message when adding a note fails", async () => {
      mockedUseCustomerNotesQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Note too long", 400));
      mockedUseCreateCustomerNoteMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

      render(<CustomerDetailView customerId="customer-1" />);

      fireEvent.change(screen.getByPlaceholderText("detail.notesPlaceholder"), {
        target: { value: "A new note" },
      });
      fireEvent.click(screen.getByText("detail.notesSubmit"));

      expect(await screen.findByText("Note too long")).toBeInTheDocument();
    });

    it("shows the shared network-failure message for a non-ApiError failure", async () => {
      mockedUseCustomerNotesQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
      mockedUseCreateCustomerNoteMutation.mockReturnValue(idleMutation({ mutateAsync }) as never);

      render(<CustomerDetailView customerId="customer-1" />);

      fireEvent.change(screen.getByPlaceholderText("detail.notesPlaceholder"), {
        target: { value: "A new note" },
      });
      fireEvent.click(screen.getByText("detail.notesSubmit"));

      expect(await screen.findByText("errors.network")).toBeInTheDocument();
    });

    it("does not interfere with the Related Tickets card's own rendering", () => {
      mockedUseTicketsQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: page([]) }) as never,
      );
      mockedUseCustomerNotesQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<CustomerDetailView customerId="customer-1" />);

      expect(screen.getByText("detail.ticketsEmpty")).toBeInTheDocument();
      expect(screen.getByText("detail.notesEmpty")).toBeInTheDocument();
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
