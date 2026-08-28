import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuditLogView } from "./audit-log-view";
import { useAuditLogsQuery } from "@/hooks/use-audit-logs";
import { useUsersQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-audit-logs", () => ({
  useAuditLogsQuery: vi.fn(),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useUsersQuery: vi.fn(),
}));

const mockedUseAuditLogsQuery = vi.mocked(useAuditLogsQuery);
const mockedUseUsersQuery = vi.mocked(useUsersQuery);

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

const baseLog = {
  id: "log-1",
  actorId: "user-1",
  action: "ticket.update",
  entityType: "Ticket",
  entityId: "ticket-1",
  branchId: "branch-1",
  diff: { status: { from: "OPEN", to: "RESOLVED" } },
  ipAddress: "203.0.113.10",
  createdAt: "2024-01-01T12:00:00.000Z",
};

describe("AuditLogView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUsersQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
  });

  it("shows a loading state while the audit-logs query is pending", () => {
    mockedUseAuditLogsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    render(<AuditLogView />);

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows the empty state when the query succeeds with zero entries", () => {
    mockedUseAuditLogsQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<AuditLogView />);

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action for a non-403 failure", () => {
    const refetch = vi.fn();
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500), refetch }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows a forbidden message with no retry action for a 403 failure", () => {
    const refetch = vi.fn();
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Forbidden", 403), refetch }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("forbidden")).toBeInTheDocument();
    expect(screen.queryByText("retry")).not.toBeInTheDocument();
  });

  it("renders a row per audit log entry with its action/entity information", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseLog] }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("ticket.update")).toBeInTheDocument();
    expect(screen.getByText("Ticket")).toBeInTheDocument();
    expect(screen.getByText("ticket-1")).toBeInTheDocument();
    expect(screen.getByText("branch-1")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.10")).toBeInTheDocument();
  });

  it("resolves the actor's name from the existing users query", () => {
    mockedUseUsersQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ id: "user-1", email: "a@example.com", fullName: "Ada Lovelace", isActive: true, roles: [] }],
      }) as never,
    );
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseLog] }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("falls back to the raw actor id when the user isn't in the resolved list", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseLog] }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("user-1")).toBeInTheDocument();
  });

  it("renders the system-actor label for a null actorId", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [{ ...baseLog, actorId: null }] }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("systemActor")).toBeInTheDocument();
  });

  it("renders a formatted diff for an entry that has one", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [baseLog] }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText(/"status"/)).toBeInTheDocument();
    expect(screen.getByText(/"RESOLVED"/)).toBeInTheDocument();
  });

  it("renders the no-diff placeholder for an entry with a null diff", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [{ ...baseLog, diff: null }] }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("noDiff")).toBeInTheDocument();
  });

  it("renders placeholders for null entityId/branchId/ipAddress", () => {
    mockedUseAuditLogsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [{ ...baseLog, entityId: null, branchId: null, ipAddress: null }],
      }) as never,
    );

    render(<AuditLogView />);

    expect(screen.getByText("noEntityId")).toBeInTheDocument();
    expect(screen.getByText("noBranch")).toBeInTheDocument();
    expect(screen.getByText("noIpAddress")).toBeInTheDocument();
  });
});
