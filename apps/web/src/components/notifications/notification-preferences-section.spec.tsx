import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationPreferencesSection } from "./notification-preferences-section";
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} from "@/hooks/use-notification-preferences";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferencesQuery: vi.fn(),
  useUpdateNotificationPreferenceMutation: vi.fn(),
}));

const mockedUseNotificationPreferencesQuery = vi.mocked(useNotificationPreferencesQuery);
const mockedUseUpdateNotificationPreferenceMutation = vi.mocked(
  useUpdateNotificationPreferenceMutation,
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
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

const basePreferences = [
  { eventType: "sla.at_risk", inAppEnabled: true },
  { eventType: "sla.breached", inAppEnabled: false },
  { eventType: "ticket.escalated", inAppEnabled: true },
];

describe("NotificationPreferencesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdateNotificationPreferenceMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the query is pending", () => {
    mockedUseNotificationPreferencesQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<NotificationPreferencesSection />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseNotificationPreferencesQuery.mockReturnValue(
      queryResult({ isError: true, refetch }) as never,
    );

    render(<NotificationPreferencesSection />);

    expect(screen.getByText("preferences.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("preferences.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders each event type's label and enabled/disabled state", () => {
    mockedUseNotificationPreferencesQuery.mockReturnValue(
      queryResult({ data: basePreferences, isSuccess: true }) as never,
    );

    render(<NotificationPreferencesSection />);

    expect(screen.getByText("eventLabel.slaAtRisk")).toBeInTheDocument();
    expect(screen.getByText("eventLabel.slaBreached")).toBeInTheDocument();
    expect(screen.getByText("eventLabel.ticketEscalated")).toBeInTheDocument();
    expect(screen.getAllByText("preferences.enabled")).toHaveLength(2);
    expect(screen.getByText("preferences.disabled")).toBeInTheDocument();
  });

  it("toggles a preference off", () => {
    const mutate = vi.fn();
    mockedUseNotificationPreferencesQuery.mockReturnValue(
      queryResult({ data: basePreferences, isSuccess: true }) as never,
    );
    mockedUseUpdateNotificationPreferenceMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<NotificationPreferencesSection />);

    fireEvent.click(screen.getAllByText("preferences.disable")[0]!);

    expect(mutate).toHaveBeenCalledWith({ eventType: "sla.at_risk", inAppEnabled: false });
  });

  it("toggles a preference back on", () => {
    const mutate = vi.fn();
    mockedUseNotificationPreferencesQuery.mockReturnValue(
      queryResult({ data: basePreferences, isSuccess: true }) as never,
    );
    mockedUseUpdateNotificationPreferenceMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<NotificationPreferencesSection />);

    fireEvent.click(screen.getByText("preferences.enable"));

    expect(mutate).toHaveBeenCalledWith({ eventType: "sla.breached", inAppEnabled: true });
  });
});
