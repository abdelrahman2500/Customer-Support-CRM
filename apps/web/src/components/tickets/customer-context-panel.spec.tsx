import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustomerContextPanel } from "./customer-context-panel";
import { useCustomerQuery, useTicketsQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useCustomerQuery: vi.fn(),
  useTicketsQuery: vi.fn(),
}));

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

function page(items: unknown[]) {
  return { items, total: items.length, page: 1, pageSize: 5, totalPages: 1 };
}

describe("CustomerContextPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton in both sections while their queries are loading", () => {
    vi.mocked(useTicketsQuery).mockReturnValue(queryResult({ isLoading: true }) as never);
    vi.mocked(useCustomerQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(
      <CustomerContextPanel ticketId="ticket-1" customerId="customer-1" />,
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBe(2);
  });

  it("renders an inline error per section when its own query fails", () => {
    vi.mocked(useTicketsQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );
    vi.mocked(useCustomerQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<CustomerContextPanel ticketId="ticket-1" customerId="customer-1" />);

    expect(screen.getByText("detail.contextPanelTicketsError")).toBeInTheDocument();
    expect(screen.getByText("detail.contextPanelContactsError")).toBeInTheDocument();
  });

  it("renders the empty messages when there are no other open tickets or primary contacts", () => {
    vi.mocked(useTicketsQuery).mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );
    vi.mocked(useCustomerQuery).mockReturnValue(
      queryResult({ data: { id: "customer-1", contacts: [] }, isSuccess: true }) as never,
    );

    render(<CustomerContextPanel ticketId="ticket-1" customerId="customer-1" />);

    expect(screen.getByText("detail.contextPanelTicketsEmpty")).toBeInTheDocument();
    expect(screen.getByText("detail.contextPanelContactsEmpty")).toBeInTheDocument();
  });

  it("excludes the current ticket from its own other-open-tickets list", () => {
    vi.mocked(useTicketsQuery).mockReturnValue(
      queryResult({
        data: page([
          { id: "ticket-1", subject: "This ticket", status: "OPEN", priority: "LOW" },
          { id: "ticket-2", subject: "Another open issue", status: "IN_PROGRESS", priority: "HIGH" },
        ]),
        isSuccess: true,
      }) as never,
    );
    vi.mocked(useCustomerQuery).mockReturnValue(
      queryResult({ data: { id: "customer-1", contacts: [] }, isSuccess: true }) as never,
    );

    render(<CustomerContextPanel ticketId="ticket-1" customerId="customer-1" />);

    expect(screen.queryByText("This ticket")).not.toBeInTheDocument();
    expect(screen.getByText("Another open issue")).toBeInTheDocument();
  });

  it("shows only contacts marked primary, not every contact", () => {
    vi.mocked(useTicketsQuery).mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );
    vi.mocked(useCustomerQuery).mockReturnValue(
      queryResult({
        data: {
          id: "customer-1",
          contacts: [
            {
              id: "contact-1",
              fullName: "Primary Person",
              email: "primary@example.com",
              phone: null,
              isPrimary: true,
              hasPortalAccess: false,
            },
            {
              id: "contact-2",
              fullName: "Secondary Person",
              email: null,
              phone: null,
              isPrimary: false,
              hasPortalAccess: false,
            },
          ],
        },
        isSuccess: true,
      }) as never,
    );

    render(<CustomerContextPanel ticketId="ticket-1" customerId="customer-1" />);

    expect(screen.getByText("Primary Person")).toBeInTheDocument();
    expect(screen.getByText("primary@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Secondary Person")).not.toBeInTheDocument();
  });

  it("asks for other open tickets scoped to this customer, excluding closed/resolved statuses", () => {
    vi.mocked(useTicketsQuery).mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );
    vi.mocked(useCustomerQuery).mockReturnValue(
      queryResult({ data: { id: "customer-1", contacts: [] }, isSuccess: true }) as never,
    );

    render(<CustomerContextPanel ticketId="ticket-1" customerId="customer-1" />);

    expect(useTicketsQuery).toHaveBeenCalledWith({
      customerId: "customer-1",
      statuses: ["OPEN", "IN_PROGRESS"],
      pageSize: 5,
    });
    expect(useCustomerQuery).toHaveBeenCalledWith("customer-1");
  });

  it("links to the full customer page", () => {
    vi.mocked(useTicketsQuery).mockReturnValue(
      queryResult({ data: page([]), isSuccess: true }) as never,
    );
    vi.mocked(useCustomerQuery).mockReturnValue(
      queryResult({ data: { id: "customer-1", contacts: [] }, isSuccess: true }) as never,
    );

    render(<CustomerContextPanel ticketId="ticket-1" customerId="customer-1" />);

    expect(screen.getByText("detail.contextPanelViewAll").closest("a")).toHaveAttribute(
      "href",
      "/en/customers/customer-1",
    );
  });

  /** Story 219 (PR-3.4, RD-3.11, recon VL-11). */
  describe("inspector section (Story 219)", () => {
    const customer = {
      id: "customer-1",
      displayName: "Desert Rose Hotels",
      isActive: true,
      anonymizedAt: null as string | null,
      createdAt: "2026-01-01T00:00:00Z",
      contacts: [
        {
          id: "contact-1",
          fullName: "Layla Haddad",
          email: "layla@example.com",
          phone: null,
          isPrimary: false,
          hasPortalAccess: true,
        },
        {
          id: "contact-2",
          fullName: "Omar Saleh",
          email: null,
          phone: "+966 50 000 0000",
          isPrimary: true,
          hasPortalAccess: false,
        },
      ],
    };

    function renderWith(overrides: Partial<typeof customer> = {}, contactId: string | null = null) {
      vi.mocked(useTicketsQuery).mockReturnValue(
        queryResult({ data: page([]), isSuccess: true }) as never,
      );
      vi.mocked(useCustomerQuery).mockReturnValue(
        queryResult({ data: { ...customer, ...overrides }, isSuccess: true }) as never,
      );
      return render(
        <CustomerContextPanel ticketId="ticket-1" customerId="customer-1" contactId={contactId} />,
      );
    }

    it("leads with the customer's identity and status, linking to the customer", () => {
      renderWith();
      expect(screen.getByRole("link", { name: "Desert Rose Hotels" })).toHaveAttribute(
        "href",
        "/en/customers/customer-1",
      );
      expect(screen.getByText("detail.contextCustomerActive")).toBeInTheDocument();
    });

    it("marks an inactive or anonymized customer", () => {
      const { unmount } = renderWith({ isActive: false });
      expect(screen.getByText("detail.contextCustomerInactive")).toBeInTheDocument();
      unmount();
      renderWith({ anonymizedAt: "2026-02-01T00:00:00Z" });
      expect(screen.getByText("detail.contextCustomerAnonymized")).toBeInTheDocument();
    });

    it("names who raised the ticket when it is one of the loaded contacts", () => {
      renderWith({}, "contact-1");
      const raisedBy = screen.getByText("detail.contextRaisedBy").closest("div")!;
      expect(raisedBy).toHaveTextContent("Layla Haddad");
      expect(raisedBy).toHaveTextContent("layla@example.com");
      expect(screen.getByRole("link", { name: "layla@example.com" })).toHaveAttribute(
        "href",
        "mailto:layla@example.com",
      );
    });

    it("shows nothing for an unknown raising contact", () => {
      renderWith({}, "someone-else");
      expect(screen.queryByText("detail.contextRaisedBy")).not.toBeInTheDocument();
    });

    it("lists primary contacts as a description list, with sentence-case subheadings", () => {
      const { container } = renderWith();
      const term = screen.getByText("Omar Saleh");
      expect(term.tagName).toBe("DT");
      expect(term.nextElementSibling).toHaveTextContent("+966 50 000 0000");
      expect(container.querySelector(".uppercase")).toBeNull();
    });
  });
});
