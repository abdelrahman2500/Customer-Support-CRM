import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketCard } from "./ticket-card";
import type { TicketListItem } from "@/lib/tickets-api";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

/** Story 216 (PR-3.1, tickets-kanban-ux.md §4) — the card anatomy. */
const NOW = new Date("2026-10-05T12:00:00Z");
function ticket(overrides: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id: "1a2b3c4d-0000-0000-0000-000000000000",
    subject: "Invoice for March shows the old plan price",
    categoryId: "c1",
    categoryName: "Billing",
    priority: "MEDIUM",
    status: "OPEN",
    customerId: "cust-1",
    customerName: "Desert Rose Hotels",
    contactId: null,
    departmentId: null,
    assignedToUserId: "u1",
    createdAt: "2026-10-05T08:00:00Z",
    updatedAt: "2026-10-05T11:56:00Z",
    slaTarget: {
      id: "s1",
      slaPolicyId: "p1",
      responseTargetAt: "2026-10-05T20:00:00Z",
      resolutionTargetAt: "2026-10-08T00:00:00Z",
      onHoldSince: null,
    },
    ...overrides,
  } as TicketListItem;
}

function renderCard(props: Partial<Parameters<typeof TicketCard>[0]> = {}) {
  return render(
    <TicketCard ticket={ticket()} locale="en" assigneeName="Sara Al-Harbi" now={NOW} {...props} />,
  );
}

describe("TicketCard", () => {
  it("is a link to the ticket, named by its subject and described by its facts", () => {
    renderCard();
    const link = screen.getByRole("link", { name: "Invoice for March shows the old plan price" });
    expect(link).toHaveAttribute("href", "/en/tickets/1a2b3c4d-0000-0000-0000-000000000000");
    expect(link).toHaveAccessibleDescription(/cardDescription.*Sara Al-Harbi/);
    expect(screen.getByText("Desert Rose Hotels")).toBeInTheDocument();
    expect(screen.getByText("#1a2b3c4d")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("Billing")).toBeInTheDocument();
  });

  it("keeps urgency rare: HIGH/URGENT get an edge and a badge, MEDIUM a quiet label", () => {
    const { container, unmount } = renderCard();
    expect(container.firstElementChild).not.toHaveClass("border-s-[3px]");
    // Demo hardening — a visible, muted word beside the icon (a lone glyph
    // read as a rendering glitch), never a badge.
    expect(screen.getByText("ticketPriority.MEDIUM")).toHaveClass("text-ink-subtle");
    expect(screen.getByText("ticketPriority.MEDIUM")).not.toHaveClass("sr-only");
    unmount();

    const urgent = renderCard({ ticket: ticket({ priority: "URGENT" }) });
    expect(urgent.container.firstElementChild).toHaveClass(
      "border-s-[3px]",
      "border-s-danger-solid",
    );
    expect(screen.getByText("ticketPriority.URGENT")).not.toHaveClass("sr-only");
  });

  it("shows SLA only when it matters", () => {
    const { unmount } = renderCard();
    expect(screen.queryByText(/sla\./)).not.toBeInTheDocument();
    unmount();
    renderCard({
      ticket: ticket({
        slaTarget: {
          id: "s1",
          slaPolicyId: "p1",
          responseTargetAt: "2026-10-05T11:00:00Z",
          resolutionTargetAt: "2026-10-08T00:00:00Z",
          onHoldSince: null,
        },
      }),
    });
    expect(screen.getByText(/sla\.breachedTarget/)).toBeInTheDocument();
  });

  it("never shows SLA on a done ticket, even a past target", () => {
    renderCard({
      ticket: ticket({
        status: "RESOLVED",
        slaTarget: {
          id: "s1",
          slaPolicyId: "p1",
          responseTargetAt: "2026-10-01T11:00:00Z",
          resolutionTargetAt: "2026-10-02T00:00:00Z",
          onHoldSince: null,
        },
      }),
    });
    expect(screen.queryByText(/sla./)).not.toBeInTheDocument();
  });

  it("marks up the update time and shows the assignee, or an unassigned placeholder", () => {
    const { unmount } = renderCard();
    const time = screen.getByText((_, element) => element?.tagName === "TIME");
    expect(time).toHaveAttribute("dateTime", "2026-10-05T11:56:00Z");
    expect(screen.getByRole("img", { name: "Sara Al-Harbi" })).toBeInTheDocument();
    unmount();
    renderCard({ assigneeName: null, ticket: ticket({ assignedToUserId: null }) });
    expect(screen.getByRole("img", { name: "unassigned" })).toHaveClass("border-dashed");
  });

  it("keeps its actions above the stretched link", () => {
    renderCard({ actions: <button type="button">Move</button> });
    const move = screen.getByRole("button", { name: "Move" });
    expect(move.closest("a")).toBeNull();
    expect(move.parentElement).toHaveClass("relative", "z-10");
  });
});
