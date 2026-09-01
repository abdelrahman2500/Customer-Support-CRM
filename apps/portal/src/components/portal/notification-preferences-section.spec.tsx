import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationPreferencesSection } from "./notification-preferences-section";
import {
  usePortalNotificationPreferencesQuery,
  useUpdatePortalNotificationPreferenceMutation,
} from "@/hooks/use-portal-notification-preferences";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-notification-preferences", () => ({
  usePortalNotificationPreferencesQuery: vi.fn(),
  useUpdatePortalNotificationPreferenceMutation: vi.fn(),
}));

const mockedUsePortalNotificationPreferencesQuery = vi.mocked(usePortalNotificationPreferencesQuery);
const mockedUseUpdatePortalNotificationPreferenceMutation = vi.mocked(
  useUpdatePortalNotificationPreferenceMutation,
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
  { eventType: "ticket.updated", inAppEnabled: true },
  { eventType: "channel.message.created", inAppEnabled: false },
];

describe("NotificationPreferencesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdatePortalNotificationPreferenceMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the query is pending", () => {
    mockedUsePortalNotificationPreferencesQuery.mockReturnValue(
      queryResult({ isLoading: true }) as never,
    );

    const { container } = render(<NotificationPreferencesSection />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUsePortalNotificationPreferencesQuery.mockReturnValue(
      queryResult({ isError: true, refetch }) as never,
    );

    render(<NotificationPreferencesSection />);

    expect(screen.getByText("preferences.error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("preferences.retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders each event type's label and enabled/disabled state", () => {
    mockedUsePortalNotificationPreferencesQuery.mockReturnValue(
      queryResult({ data: basePreferences, isSuccess: true }) as never,
    );

    render(<NotificationPreferencesSection />);

    expect(screen.getByText("eventLabel.ticketUpdated")).toBeInTheDocument();
    expect(screen.getByText("eventLabel.newReply")).toBeInTheDocument();
    expect(screen.getByText("preferences.enabled")).toBeInTheDocument();
    expect(screen.getByText("preferences.disabled")).toBeInTheDocument();
  });

  it("toggles a preference off", () => {
    const mutate = vi.fn();
    mockedUsePortalNotificationPreferencesQuery.mockReturnValue(
      queryResult({ data: basePreferences, isSuccess: true }) as never,
    );
    mockedUseUpdatePortalNotificationPreferenceMutation.mockReturnValue(
      mutationResult({ mutate }) as never,
    );

    render(<NotificationPreferencesSection />);

    fireEvent.click(screen.getByText("preferences.disable"));

    expect(mutate).toHaveBeenCalledWith({ eventType: "ticket.updated", inAppEnabled: false });
  });

  it("toggles a preference back on", () => {
    const mutate = vi.fn();
    mockedUsePortalNotificationPreferencesQuery.mockReturnValue(
      queryResult({ data: basePreferences, isSuccess: true }) as never,
    );
    mockedUseUpdatePortalNotificationPreferenceMutation.mockReturnValue(
      mutationResult({ mutate }) as never,
    );

    render(<NotificationPreferencesSection />);

    fireEvent.click(screen.getByText("preferences.enable"));

    expect(mutate).toHaveBeenCalledWith({ eventType: "channel.message.created", inAppEnabled: true });
  });
});
