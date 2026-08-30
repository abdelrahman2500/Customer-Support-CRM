import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationTemplatesView } from "./notification-templates-view";
import {
  useCreateNotificationTemplateMutation,
  useNotificationTemplatesQuery,
} from "@/hooks/use-notification-templates";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-notification-templates", () => ({
  useNotificationTemplatesQuery: vi.fn(),
  useCreateNotificationTemplateMutation: vi.fn(),
}));

const mockedUseNotificationTemplatesQuery = vi.mocked(useNotificationTemplatesQuery);
const mockedUseCreateNotificationTemplateMutation = vi.mocked(
  useCreateNotificationTemplateMutation,
);

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

describe("NotificationTemplatesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateNotificationTemplateMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the templates query is pending", () => {
    mockedUseNotificationTemplatesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<NotificationTemplatesView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseNotificationTemplatesQuery.mockReturnValue(
      queryResult({ isError: true, refetch }) as never,
    );

    render(<NotificationTemplatesView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders all three fixed event-type rows, even when no templates exist yet", () => {
    mockedUseNotificationTemplatesQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<NotificationTemplatesView />);

    expect(screen.getByText("eventLabel.slaAtRisk")).toBeInTheDocument();
    expect(screen.getByText("eventLabel.slaBreached")).toBeInTheDocument();
    expect(screen.getByText("eventLabel.ticketEscalated")).toBeInTheDocument();
  });

  it("pre-fills an existing template's text", () => {
    mockedUseNotificationTemplatesQuery.mockReturnValue(
      queryResult({
        data: [{ id: "t-1", eventType: "sla.at_risk", template: "Ticket {ticketId} is at risk" }],
        isSuccess: true,
      }) as never,
    );

    render(<NotificationTemplatesView />);

    expect(screen.getByDisplayValue("Ticket {ticketId} is at risk")).toBeInTheDocument();
  });

  it("saves a template via the create-or-update mutation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockedUseNotificationTemplatesQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseCreateNotificationTemplateMutation.mockReturnValue(
      mutationResult({ mutateAsync }) as never,
    );

    render(<NotificationTemplatesView />);

    const textareas = screen.getAllByLabelText("templateLabel");
    fireEvent.change(textareas[0]!, { target: { value: "Custom text" } });
    fireEvent.click(screen.getAllByText("save")[0]!);

    expect(mutateAsync).toHaveBeenCalledWith({ eventType: "sla.at_risk", template: "Custom text" });
  });

  it("shows an inline error when saving fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Server error", 500));
    mockedUseNotificationTemplatesQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    mockedUseCreateNotificationTemplateMutation.mockReturnValue(
      mutationResult({ mutateAsync }) as never,
    );

    render(<NotificationTemplatesView />);

    const textareas = screen.getAllByLabelText("templateLabel");
    fireEvent.change(textareas[0]!, { target: { value: "Custom text" } });
    fireEvent.click(screen.getAllByText("save")[0]!);

    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });
});
