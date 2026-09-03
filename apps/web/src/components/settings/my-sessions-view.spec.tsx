import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MySessionsView } from "./my-sessions-view";
import { useMySessionsQuery, useRevokeSessionMutation } from "@/hooks/use-sessions";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-sessions", () => ({
  useMySessionsQuery: vi.fn(),
  useRevokeSessionMutation: vi.fn(),
}));

const mockedUseMySessionsQuery = vi.mocked(useMySessionsQuery);
const mockedUseRevokeSessionMutation = vi.mocked(useRevokeSessionMutation);

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

const currentSession = {
  sessionId: "session-current",
  ipAddress: "203.0.113.1",
  userAgent: "Mozilla/5.0 (current device)",
  sessionCreatedAt: "2026-01-01T00:00:00.000Z",
  lastActiveAt: "2026-01-02T00:00:00.000Z",
  isCurrent: true,
};

const otherSession = {
  sessionId: "session-other",
  ipAddress: "203.0.113.2",
  userAgent: "Mozilla/5.0 (other device)",
  sessionCreatedAt: "2026-01-01T00:00:00.000Z",
  lastActiveAt: "2026-01-03T00:00:00.000Z",
  isCurrent: false,
};

describe("MySessionsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseRevokeSessionMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the sessions query is pending", () => {
    mockedUseMySessionsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<MySessionsView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseMySessionsQuery.mockReturnValue(
      queryResult({ isError: true, refetch }) as never,
    );

    render(<MySessionsView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows an empty state when there are no active sessions", () => {
    mockedUseMySessionsQuery.mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );

    render(<MySessionsView />);

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("lists every session with its device/IP, and flags the current one", () => {
    mockedUseMySessionsQuery.mockReturnValue(
      queryResult({ data: [currentSession, otherSession], isSuccess: true }) as never,
    );

    render(<MySessionsView />);

    expect(screen.getByText("Mozilla/5.0 (current device)")).toBeInTheDocument();
    expect(screen.getByText("Mozilla/5.0 (other device)")).toBeInTheDocument();
    expect(screen.getByText("thisDevice")).toBeInTheDocument();
  });

  it("does not render a Sign out button for the current session", () => {
    mockedUseMySessionsQuery.mockReturnValue(
      queryResult({ data: [currentSession], isSuccess: true }) as never,
    );

    render(<MySessionsView />);

    expect(screen.queryByRole("button", { name: "signOut" })).not.toBeInTheDocument();
  });

  it("renders a Sign out button for a non-current session, and does not revoke immediately on click", () => {
    const mutate = vi.fn();
    mockedUseMySessionsQuery.mockReturnValue(
      queryResult({ data: [otherSession], isSuccess: true }) as never,
    );
    mockedUseRevokeSessionMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<MySessionsView />);
    fireEvent.click(screen.getByRole("button", { name: "signOut" }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("revokes the session only after confirming in the dialog", () => {
    const mutate = vi.fn();
    mockedUseMySessionsQuery.mockReturnValue(
      queryResult({ data: [otherSession], isSuccess: true }) as never,
    );
    mockedUseRevokeSessionMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<MySessionsView />);
    fireEvent.click(screen.getByRole("button", { name: "signOut" }));
    // Once the dialog is open, Radix marks the rest of the page
    // `aria-hidden`, so the row's own trigger button drops out of the
    // accessibility tree — `getByRole` now uniquely matches the dialog's
    // own confirm button.
    fireEvent.click(screen.getByRole("button", { name: "signOut" }));

    expect(mutate).toHaveBeenCalledWith("session-other");
  });

  it("shows an inline error when revoking fails", () => {
    mockedUseMySessionsQuery.mockReturnValue(
      queryResult({ data: [otherSession], isSuccess: true }) as never,
    );
    mockedUseRevokeSessionMutation.mockReturnValue(
      mutationResult({ isError: true, error: new Error("network down") }) as never,
    );

    render(<MySessionsView />);

    // `useTranslations` is mocked to return the raw key; a plain `Error`
    // (not `ApiError`) classifies as "network" (`resolveErrorMessage`),
    // whose copy comes from `useErrorMessage`'s own `common.errors.network`.
    expect(screen.getByText("errors.network")).toBeInTheDocument();
  });
});
