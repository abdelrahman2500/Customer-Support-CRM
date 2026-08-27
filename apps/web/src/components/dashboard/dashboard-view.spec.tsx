import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DashboardView } from "./dashboard-view";
import { useCustomersQuery, useTicketsQuery } from "@/hooks/use-tickets";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useTicketsQuery: vi.fn(),
  useCustomersQuery: vi.fn(),
}));

const mockedUseTicketsQuery = vi.mocked(useTicketsQuery);
const mockedUseCustomersQuery = vi.mocked(useCustomersQuery);

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

function ticket(overrides: Record<string, unknown>) {
  return {
    id: "ticket-1",
    subject: "Cannot log in",
    category: null,
    priority: "MEDIUM",
    status: "OPEN",
    customerId: "customer-1",
    contactId: null,
    departmentId: null,
    assignedToUserId: "agent-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    slaTarget: null,
    ...overrides,
  };
}

function renderWithLocale(userId = "agent-1", locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? enMessages : arMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DashboardView userId={userId} />
    </NextIntlClientProvider>,
  );
}

describe("DashboardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCustomersQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [{ id: "customer-1", displayName: "Acme Inc." }] }) as never,
    );
  });

  it("shows a loading state while the tickets query is pending", () => {
    mockedUseTicketsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    renderWithLocale();

    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });

  it("shows an error state with a retry action when the query fails", () => {
    const refetch = vi.fn();
    mockedUseTicketsQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    renderWithLocale();

    expect(screen.getByText("Couldn't load your tickets.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when the agent has no open assigned tickets", () => {
    mockedUseTicketsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);

    renderWithLocale();

    expect(screen.getByText("You have no open tickets assigned to you.")).toBeInTheDocument();
  });

  it("queries GET /tickets scoped to the authenticated agent, not the branch-wide list", () => {
    mockedUseTicketsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);

    renderWithLocale("agent-42");

    expect(mockedUseTicketsQuery).toHaveBeenCalledWith({ assignedToUserId: "agent-42" });
  });

  it("excludes RESOLVED and CLOSED tickets from the populated list", () => {
    mockedUseTicketsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          ticket({ id: "ticket-open", subject: "Open one", status: "OPEN" }),
          ticket({ id: "ticket-resolved", subject: "Resolved one", status: "RESOLVED" }),
          ticket({ id: "ticket-closed", subject: "Closed one", status: "CLOSED" }),
        ],
      }) as never,
    );

    renderWithLocale();

    expect(screen.getByText("Open one")).toBeInTheDocument();
    expect(screen.queryByText("Resolved one")).not.toBeInTheDocument();
    expect(screen.queryByText("Closed one")).not.toBeInTheDocument();
  });

  it("orders tickets breached-first, then soonest-remaining, then no-target-last", () => {
    const now = Date.now();
    mockedUseTicketsQuery.mockReturnValue(
      queryResult({
        isSuccess: true,
        data: [
          ticket({
            id: "ticket-none",
            subject: "No target",
            status: "IN_PROGRESS",
            slaTarget: null,
          }),
          ticket({
            id: "ticket-soon",
            subject: "Due soon",
            status: "OPEN",
            slaTarget: {
              responseTargetAt: new Date(now + 60 * 60 * 1000).toISOString(),
              resolutionTargetAt: new Date(now + 60 * 60 * 1000).toISOString(),
            },
          }),
          ticket({
            id: "ticket-breached",
            subject: "Already breached",
            status: "OPEN",
            slaTarget: {
              responseTargetAt: new Date(now - 60 * 60 * 1000).toISOString(),
              resolutionTargetAt: new Date(now - 60 * 60 * 1000).toISOString(),
            },
          }),
        ],
      }) as never,
    );

    renderWithLocale();

    const subjects = screen
      .getAllByText(/No target|Due soon|Already breached/)
      .map((el) => el.textContent);
    expect(subjects).toEqual(["Already breached", "Due soon", "No target"]);
  });

  it("navigates to the ticket detail route when a row is clicked", () => {
    mockedUseTicketsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [ticket({})] }) as never,
    );

    renderWithLocale();
    fireEvent.click(screen.getByText("Cannot log in"));

    expect(push).toHaveBeenCalledWith("/en/tickets/ticket-1");
  });

  it("navigates to the customer detail route when the customer name is clicked, without also navigating to the ticket", () => {
    mockedUseTicketsQuery.mockReturnValue(
      queryResult({ isSuccess: true, data: [ticket({})] }) as never,
    );

    renderWithLocale();
    fireEvent.click(screen.getByText("Acme Inc."));

    expect(push).toHaveBeenCalledWith("/en/customers/customer-1");
    expect(push).not.toHaveBeenCalledWith("/en/tickets/ticket-1");
  });

  it("renders correctly in Arabic", () => {
    mockedUseTicketsQuery.mockReturnValue(queryResult({ isSuccess: true, data: [] }) as never);

    renderWithLocale("agent-1", "ar");

    expect(screen.getByText("لوحة التحكم")).toBeInTheDocument();
    expect(screen.getByText("تذاكري المفتوحة")).toBeInTheDocument();
    expect(screen.getByText("لا توجد تذاكر مفتوحة مُسندة إليك.")).toBeInTheDocument();
  });
});
