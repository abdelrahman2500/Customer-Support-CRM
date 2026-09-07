import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { WebhookSubscriptionsView } from "./webhook-subscriptions-view";
import {
  useCreateWebhookSubscriptionMutation,
  useDeleteWebhookSubscriptionMutation,
  useUpdateWebhookSubscriptionMutation,
  useWebhookDeliveryAttemptsQuery,
  useWebhookSubscriptionsQuery,
} from "@/hooks/use-webhook-subscriptions";
import { useWebhookInboundLogsQuery } from "@/hooks/use-webhook-inbound-logs";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-webhook-subscriptions", () => ({
  useWebhookSubscriptionsQuery: vi.fn(),
  useCreateWebhookSubscriptionMutation: vi.fn(),
  useUpdateWebhookSubscriptionMutation: vi.fn(),
  useDeleteWebhookSubscriptionMutation: vi.fn(),
  useWebhookDeliveryAttemptsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-webhook-inbound-logs", () => ({
  useWebhookInboundLogsQuery: vi.fn(),
}));

const mockedUseWebhookSubscriptionsQuery = vi.mocked(useWebhookSubscriptionsQuery);
const mockedUseCreateWebhookSubscriptionMutation = vi.mocked(useCreateWebhookSubscriptionMutation);
const mockedUseUpdateWebhookSubscriptionMutation = vi.mocked(useUpdateWebhookSubscriptionMutation);
const mockedUseDeleteWebhookSubscriptionMutation = vi.mocked(useDeleteWebhookSubscriptionMutation);
const mockedUseWebhookDeliveryAttemptsQuery = vi.mocked(useWebhookDeliveryAttemptsQuery);
const mockedUseWebhookInboundLogsQuery = vi.mocked(useWebhookInboundLogsQuery);

function queryResult(overrides: Record<string, unknown>) {
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
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

const SUBSCRIPTION = {
  id: "subscription-1",
  targetUrl: "https://example.test/hook",
  subscribedEventTypes: ["ticket.updated", "sla.breached"],
  isActive: true,
  createdByUserId: "user-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("WebhookSubscriptionsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdateWebhookSubscriptionMutation.mockReturnValue(mutationResult() as never);
    mockedUseCreateWebhookSubscriptionMutation.mockReturnValue(mutationResult() as never);
    mockedUseDeleteWebhookSubscriptionMutation.mockReturnValue(mutationResult() as never);
    mockedUseWebhookDeliveryAttemptsQuery.mockReturnValue(
      queryResult({ data: undefined, isLoading: true }) as never,
    );
    mockedUseWebhookInboundLogsQuery.mockReturnValue(
      queryResult({ data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 }, isSuccess: true }) as never,
    );
  });

  it("shows a loading state while the subscriptions query is pending", () => {
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<WebhookSubscriptionsView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500), refetch }) as never,
    );

    render(<WebhookSubscriptionsView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are no subscriptions yet", () => {
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<WebhookSubscriptionsView />);

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("renders a subscription's target URL, subscribed events, and status", () => {
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [SUBSCRIPTION], isSuccess: true }) as never,
    );

    render(<WebhookSubscriptionsView />);

    expect(screen.getByText("https://example.test/hook")).toBeInTheDocument();
    // Each event name also appears as a create-form checkbox label — at
    // least one visible occurrence (the row's own badge) is what this
    // asserts, mirroring `AutomationRulesView`'s own "billing" precedent.
    expect(screen.getAllByText("ticket.updated").length).toBeGreaterThan(0);
    expect(screen.getAllByText("sla.breached").length).toBeGreaterThan(0);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("does not deactivate immediately — clicking deactivate opens a confirmation dialog first", () => {
    const mutate = vi.fn();
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [SUBSCRIPTION], isSuccess: true }) as never,
    );
    mockedUseUpdateWebhookSubscriptionMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<WebhookSubscriptionsView />);

    fireEvent.click(screen.getByRole("button", { name: "deactivate" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("toggles a subscription's active state via the confirmation dialog", () => {
    const mutate = vi.fn();
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [SUBSCRIPTION], isSuccess: true }) as never,
    );
    mockedUseUpdateWebhookSubscriptionMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<WebhookSubscriptionsView />);

    fireEvent.click(screen.getByRole("button", { name: "deactivate" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "deactivate" }));

    expect(mutate).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("does not delete immediately — clicking delete opens a confirmation dialog first, then deletes on confirm", () => {
    const mutate = vi.fn();
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [SUBSCRIPTION], isSuccess: true }) as never,
    );
    mockedUseDeleteWebhookSubscriptionMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<WebhookSubscriptionsView />);

    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(mutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));

    expect(mutate).toHaveBeenCalledWith(
      "subscription-1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("shows a forbidden message when toggling fails with 403", () => {
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [SUBSCRIPTION], isSuccess: true }) as never,
    );
    mockedUseUpdateWebhookSubscriptionMutation.mockReturnValue(
      mutationResult({ isError: true, error: new ApiError("Forbidden", 403) }) as never,
    );

    render(<WebhookSubscriptionsView />);

    expect(screen.getByText("actionForbidden")).toBeInTheDocument();
  });

  it("only queries the delivery-attempt log once its row is expanded", () => {
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [SUBSCRIPTION], isSuccess: true }) as never,
    );

    render(<WebhookSubscriptionsView />);

    expect(screen.queryByText("noDeliveries")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "viewDeliveries" }));

    expect(mockedUseWebhookDeliveryAttemptsQuery).toHaveBeenCalledWith("subscription-1", 1, true);
  });

  it("renders the delivery-attempt log's rows once expanded and loaded", () => {
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [SUBSCRIPTION], isSuccess: true }) as never,
    );
    mockedUseWebhookDeliveryAttemptsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: {
          items: [
            {
              id: "attempt-1",
              eventType: "ticket.updated",
              succeeded: true,
              responseStatus: 200,
              errorMessage: null,
              attemptedAt: "2024-01-01T00:00:00.000Z",
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1,
        },
      }) as never,
    );

    render(<WebhookSubscriptionsView />);
    fireEvent.click(screen.getByRole("button", { name: "viewDeliveries" }));

    expect(screen.getByText('deliverySucceeded:{"status":200}')).toBeInTheDocument();
  });

  it("disables the create-subscription submit button until a URL and at least one event are chosen", () => {
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<WebhookSubscriptionsView />);

    expect(screen.getByText("createSubmit").closest("button")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("targetUrlLabel"), {
      target: { value: "https://example.test/hook" },
    });
    expect(screen.getByText("createSubmit").closest("button")).toBeDisabled();

    fireEvent.click(screen.getByLabelText("ticket.updated"));
    expect(screen.getByText("createSubmit").closest("button")).not.toBeDisabled();
  });

  it("submits the chosen target URL and event types, then reveals the one-time secret", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ...SUBSCRIPTION, secret: "generated-secret" });
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseCreateWebhookSubscriptionMutation.mockReturnValue(
      mutationResult({ mutateAsync }) as never,
    );

    render(<WebhookSubscriptionsView />);

    fireEvent.change(screen.getByLabelText("targetUrlLabel"), {
      target: { value: "https://example.test/hook" },
    });
    fireEvent.click(screen.getByLabelText("ticket.updated"));

    const form = screen.getByText("createSubmit").closest("form") as HTMLFormElement;
    fireEvent.submit(form);

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        targetUrl: "https://example.test/hook",
        subscribedEventTypes: ["ticket.updated"],
      });
    });
    expect(await screen.findByText("generated-secret")).toBeInTheDocument();
  });

  it("shows a generic create-failed message when creation fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Server error", 500));
    mockedUseWebhookSubscriptionsQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseCreateWebhookSubscriptionMutation.mockReturnValue(
      mutationResult({ mutateAsync }) as never,
    );

    render(<WebhookSubscriptionsView />);

    fireEvent.change(screen.getByLabelText("targetUrlLabel"), {
      target: { value: "https://example.test/hook" },
    });
    fireEvent.click(screen.getByLabelText("ticket.updated"));
    fireEvent.submit(screen.getByText("createSubmit").closest("form") as HTMLFormElement);

    expect(await screen.findByText("createFailed")).toBeInTheDocument();
  });

  describe("inbound webhook log (RM-21)", () => {
    it("shows the empty state when nothing has been received yet", () => {
      mockedUseWebhookSubscriptionsQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );

      render(<WebhookSubscriptionsView />);

      expect(screen.getByText("noInboundLogs")).toBeInTheDocument();
    });

    it("renders a received payload's provider, verification result, and timestamp", () => {
      mockedUseWebhookSubscriptionsQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      mockedUseWebhookInboundLogsQuery.mockReturnValue(
        queryResult({
          isSuccess: true,
          data: {
            items: [
              {
                id: "log-1",
                providerKey: "stripe",
                verified: false,
                rejectReason: "Signature mismatch",
                headers: {},
                body: "{}",
                receivedAt: "2024-01-01T00:00:00.000Z",
              },
            ],
            total: 1,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
        }) as never,
      );

      render(<WebhookSubscriptionsView />);

      expect(screen.getByText("stripe")).toBeInTheDocument();
      expect(screen.getByText("Signature mismatch")).toBeInTheDocument();
    });

    it("shows a generic error state with a retry action", () => {
      const refetch = vi.fn();
      mockedUseWebhookSubscriptionsQuery.mockReturnValue(
        queryResult({ data: [], isSuccess: true }) as never,
      );
      mockedUseWebhookInboundLogsQuery.mockReturnValue(
        queryResult({ isError: true, error: new ApiError("Server error", 500), refetch }) as never,
      );

      render(<WebhookSubscriptionsView />);

      expect(screen.getByText("inboundLogError")).toBeInTheDocument();
      fireEvent.click(screen.getByText("retry"));
      expect(refetch).toHaveBeenCalledOnce();
    });
  });
});
