import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { TicketCategoriesView } from "./ticket-categories-view";
import {
  useCreateTicketCategoryMutation,
  useManagedTicketCategoriesQuery,
  useUpdateTicketCategoryMutation,
} from "@/hooks/use-ticket-categories";
import { ApiError } from "@/lib/api";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

/**
 * Story 120 — Ticketing: Managed Category Taxonomy. Mirrors
 * `branch-departments-view.spec.tsx`'s exact convention: no `next-intl`
 * mock — every test renders through a real `NextIntlClientProvider` with
 * the actual `en.json`/`ar.json` messages.
 */
vi.mock("@/hooks/use-ticket-categories", () => ({
  useManagedTicketCategoriesQuery: vi.fn(),
  useCreateTicketCategoryMutation: vi.fn(),
  useUpdateTicketCategoryMutation: vi.fn(),
}));

const mockedUseManagedTicketCategoriesQuery = vi.mocked(useManagedTicketCategoriesQuery);
const mockedUseCreateTicketCategoryMutation = vi.mocked(useCreateTicketCategoryMutation);
const mockedUseUpdateTicketCategoryMutation = vi.mocked(useUpdateTicketCategoryMutation);

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function mutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

const baseCategory = { id: "category-1", branchId: "branch-1", name: "Billing", isActive: true };

function renderView(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TicketCategoriesView />
    </NextIntlClientProvider>,
  );
}

describe("TicketCategoriesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseManagedTicketCategoriesQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseCreateTicketCategoryMutation.mockReturnValue(
      { mutateAsync: vi.fn(), isPending: false } as never,
    );
    mockedUseUpdateTicketCategoryMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the categories query is pending", () => {
    mockedUseManagedTicketCategoriesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    renderView();

    expect(screen.getByText("Ticket Categories")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseManagedTicketCategoriesQuery.mockReturnValue(
      queryResult({ isError: true, refetch }) as never,
    );

    renderView();

    expect(screen.getByText("Couldn't load ticket categories.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are zero categories", () => {
    renderView();

    expect(screen.getByText("No ticket categories yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the categories table with each row's name and status badge", () => {
    mockedUseManagedTicketCategoriesQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [baseCategory, { id: "category-2", branchId: "branch-1", name: "Technical", isActive: false }],
      }) as never,
    );

    renderView();

    const table = screen.getByRole("table");
    expect(within(table).getByDisplayValue("Billing")).toBeInTheDocument();
    expect(within(table).getByDisplayValue("Technical")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("commits a category rename on blur when the name changed", () => {
    const mutate = vi.fn();
    mockedUseManagedTicketCategoriesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseCategory] }) as never,
    );
    mockedUseUpdateTicketCategoryMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    const input = screen.getByDisplayValue("Billing");
    fireEvent.change(input, { target: { value: "Billing & Payments" } });
    fireEvent.blur(input);

    expect(mutate).toHaveBeenCalledWith(
      { name: "Billing & Payments" },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("does not fire the rename mutation on blur when the name is unchanged", () => {
    const mutate = vi.fn();
    mockedUseManagedTicketCategoriesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseCategory] }) as never,
    );
    mockedUseUpdateTicketCategoryMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    fireEvent.blur(screen.getByDisplayValue("Billing"));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("does not deactivate immediately — clicking 'Deactivate' opens a confirmation dialog first", () => {
    const mutate = vi.fn();
    mockedUseManagedTicketCategoriesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseCategory] }) as never,
    );
    mockedUseUpdateTicketCategoryMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("toggles active state via the activate/deactivate button's confirmation dialog", () => {
    const mutate = vi.fn();
    mockedUseManagedTicketCategoriesQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseCategory] }) as never,
    );
    mockedUseUpdateTicketCategoryMutation.mockReturnValue(mutationResult({ mutate }) as never);

    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    expect(mutate).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  describe("inline mutation errors", () => {
    it("renders a 403-specific message when the update mutation is rejected with 403", () => {
      mockedUseManagedTicketCategoriesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseCategory] }) as never,
      );
      mockedUseUpdateTicketCategoryMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
      );

      renderView();

      expect(
        screen.getByText("You don't have permission to perform that action."),
      ).toBeInTheDocument();
    });

    it("renders a generic message when the update mutation is rejected with a non-403 status", () => {
      mockedUseManagedTicketCategoriesQuery.mockReturnValue(
        queryResult({ isSuccess: true, data: [baseCategory] }) as never,
      );
      mockedUseUpdateTicketCategoryMutation.mockReturnValue(
        mutationResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
      );

      renderView();

      expect(screen.getByText("That change couldn't be saved. Please try again.")).toBeInTheDocument();
    });
  });

  describe("create-category form", () => {
    it("keeps the submit button disabled until the name field has content", () => {
      renderView();

      expect(screen.getByRole("button", { name: "Add category" })).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText("e.g. Billing"), {
        target: { value: "Billing" },
      });

      expect(screen.getByRole("button", { name: "Add category" })).toBeEnabled();
    });

    it("submits exactly { name } on the create-category form", async () => {
      const mutateAsync = vi.fn().mockResolvedValue({ id: "category-99" });
      mockedUseCreateTicketCategoryMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      renderView();

      fireEvent.change(screen.getByPlaceholderText("e.g. Billing"), {
        target: { value: "Logistics" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add category" }));

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ name: "Logistics" }));
    });

    it("shows the backend's own message inline on a rejected submission and preserves the entered value", async () => {
      const mutateAsync = vi
        .fn()
        .mockRejectedValue(new ApiError("A ticket category with this name already exists", 409));
      mockedUseCreateTicketCategoryMutation.mockReturnValue({ mutateAsync, isPending: false } as never);

      renderView();

      fireEvent.change(screen.getByPlaceholderText("e.g. Billing"), {
        target: { value: "Billing" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add category" }));

      expect(
        await screen.findByText("A ticket category with this name already exists"),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Billing")).toBeInTheDocument();
    });

    it("shows a pending/disabled state while the create-category mutation is in flight", () => {
      mockedUseCreateTicketCategoryMutation.mockReturnValue(
        { mutateAsync: vi.fn(), isPending: true } as never,
      );

      renderView();

      expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();
    });
  });

  describe("bilingual rendering", () => {
    it("renders the heading in English", () => {
      renderView("en");

      expect(screen.getByText("Ticket Categories")).toBeInTheDocument();
    });

    it("renders the heading in Arabic", () => {
      renderView("ar");

      expect(screen.getByText("فئات التذاكر")).toBeInTheDocument();
    });
  });
});
