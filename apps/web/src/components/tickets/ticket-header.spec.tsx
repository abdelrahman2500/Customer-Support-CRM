import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { TicketHeader, type TicketHeaderSla } from "./ticket-header";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

let locale = "en";
vi.mock("next/navigation", () => ({ useParams: () => ({ locale }) }));

const CATALOGS = { en: enMessages, ar: arMessages } as const;

const ticket = {
  id: "2b7065e3-9e2c-4d8c-bfbc-19b12439a2eb",
  subject: "Cannot access my invoices",
  categoryId: null,
  categoryName: null,
  priority: "HIGH" as const,
  status: "IN_PROGRESS" as const,
  customerId: "customer-1",
  customerName: "Acme Inc.",
  contactId: null,
  departmentId: null,
  assignedToUserId: "agent-1",
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-02T10:30:00.000Z",
};

function renderHeader(
  props: Partial<{
    l: keyof typeof CATALOGS;
    sla: TicketHeaderSla;
    assigneeName: string | null;
  }> = {},
) {
  const l = props.l ?? "en";
  locale = l;
  const ui: ReactNode = (
    <TicketHeader
      ticket={ticket}
      locale={l}
      sla={props.sla ?? { status: "ready", target: null }}
      assigneeName={props.assigneeName === undefined ? "Ada Lovelace" : props.assigneeName}
      assigneePresence="online"
      onSubjectCommit={vi.fn()}
    />
  );
  return render(
    <NextIntlClientProvider locale={l} messages={CATALOGS[l]} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

/** Story 201 (RD-3.1, recon TW-01) — the ticket header's identity and state. */
describe("TicketHeader", () => {
  for (const l of ["en", "ar"] as const) {
    it(`labels every fact with its ${l} term, in a description list`, () => {
      const { container } = renderHeader({ l });
      const columns = CATALOGS[l].tickets.list.columns;

      const terms = [...container.querySelectorAll("dl > div > dt")].map((dt) => dt.textContent);
      expect(terms).toEqual([
        columns.status,
        columns.priority,
        columns.sla,
        columns.assignedAgent,
        columns.customer,
        columns.createdAt,
        columns.updatedAt,
      ]);
    });
  }

  it("shows the short id, the subject as the page h1, and the back link", () => {
    renderHeader();

    // LTR characters, but placed at the reading start in either direction.
    expect(screen.getByText("#2b7065e3")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("#2b7065e3")).toHaveClass("self-start");
    expect(
      screen.getByRole("heading", { level: 1, name: "Cannot access my invoices" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to tickets/ })).toHaveAttribute(
      "href",
      "/en/tickets",
    );
  });

  it("renders status and priority as badges, and the assignee with an avatar", () => {
    renderHeader();

    expect(screen.getByText("In progress")).toHaveClass("bg-progress-surface");
    expect(screen.getByText("High")).toHaveClass("bg-warning-surface");
    const assignee = screen.getByText("Ada Lovelace");
    expect(assignee).toHaveClass("truncate");
    expect(assignee.parentElement!.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("says Unassigned when nobody owns the ticket", () => {
    renderHeader({ assigneeName: null });
    expect(screen.getByText("Unassigned")).toHaveClass("text-ink-subtle");
  });

  it("renders the SLA from the target, a placeholder while loading, and a dash on error", () => {
    const { unmount } = renderHeader({ sla: { status: "ready", target: null } });
    expect(screen.getByText("No SLA target")).toBeInTheDocument();
    unmount();

    const loading = renderHeader({ sla: { status: "loading" } });
    expect(loading.container.querySelector(".animate-pulse")).not.toBeNull();
    loading.unmount();

    renderHeader({ sla: { status: "error" } });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("links the customer and marks up both times as <time datetime>", () => {
    const { container } = renderHeader();

    expect(screen.getByRole("link", { name: "Acme Inc." })).toHaveAttribute(
      "href",
      "/en/customers/customer-1",
    );
    const times = [...container.querySelectorAll("time")].map((el) => el.getAttribute("dateTime"));
    expect(times).toEqual([ticket.createdAt, ticket.updatedAt]);
  });

  it("is sticky from lg on the canvas background", () => {
    const { container } = renderHeader();
    expect(container.querySelector("header")).toHaveClass(
      "lg:sticky",
      "lg:top-0",
      "lg:z-20",
      "bg-surface-sunk",
    );
  });

  // The inspector's Selects are found by their labels ("Status", "Priority");
  // Playwright's getByLabel matches by substring, so the header must add none.
  it("adds no labelled element that could collide with the inspector's fields", () => {
    const { container } = renderHeader();
    const header = container.querySelector("header")!;
    expect(header.querySelectorAll("label")).toHaveLength(0);
    for (const el of header.querySelectorAll("[aria-label]")) {
      expect(el.getAttribute("aria-label")).not.toMatch(/status|priority/i);
    }
  });

  it("keeps the Arabic header free of Latin enum text and uses logical classes only", () => {
    const { container } = renderHeader({ l: "ar" });
    const header = container.querySelector("header")!;
    const dl = header.querySelector("dl")!;
    expect(within(dl).getByText(CATALOGS.ar.tickets.list.columns.status)).toBeInTheDocument();
    expect(dl.textContent).not.toMatch(/IN_PROGRESS|HIGH/);
    for (const el of [header, ...header.querySelectorAll("[class]")]) {
      const classes = el.className.toString().split(/\s+/);
      expect(classes.some((c) => /^(ml|mr|pl|pr|left|right|text-left|text-right)-/.test(c))).toBe(
        false,
      );
    }
  });
});
