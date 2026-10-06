import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { TicketHeader, TicketHeaderActions, type TicketHeaderSla } from "./ticket-header";
import type { TicketSummary } from "@/lib/tickets-api";
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

  // Story 202 (RD-3.2) — the header actions.
  describe("TicketHeaderActions (Story 202)", () => {
    function renderActions(props: Partial<Parameters<typeof TicketHeaderActions>[0]> = {}) {
      locale = "en";
      const handlers = { onAssignToMe: vi.fn(), onSetStatus: vi.fn() };
      render(
        <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
          <TicketHeaderActions
            status="OPEN"
            canAssignToMe
            pending={false}
            {...handlers}
            {...props}
          />
        </NextIntlClientProvider>,
      );
      return handlers;
    }
    const names = () =>
      within(screen.getByRole("group", { name: "Ticket actions" }))
        .getAllByRole("button")
        .map((b) => b.textContent);

    it("offers Assign to me and Resolve on an open or in-progress ticket", () => {
      const { onAssignToMe, onSetStatus } = renderActions({ status: "IN_PROGRESS" });
      expect(names()).toEqual(["Assign to me", "Resolve"]);
      fireEvent.click(screen.getByRole("button", { name: "Assign to me" }));
      fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
      expect(onAssignToMe).toHaveBeenCalledOnce();
      // Demo hardening — resolving asks first, like the board.
      expect(onSetStatus).not.toHaveBeenCalled();
      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toHaveTextContent("Resolve this ticket?");
      expect(dialog).toHaveTextContent("The customer is notified.");
      fireEvent.click(within(dialog).getByRole("button", { name: "Resolve" }));
      expect(onSetStatus).toHaveBeenCalledWith("RESOLVED");
    });

    it("sends nothing when the resolve confirmation is cancelled", () => {
      const { onSetStatus } = renderActions({ status: "OPEN" });
      fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
      );
      expect(onSetStatus).not.toHaveBeenCalled();
    });

    it("offers Close and Reopen on a resolved ticket, Reopen on a closed one", () => {
      const { onSetStatus } = renderActions({ status: "RESOLVED", canAssignToMe: false });
      expect(names()).toEqual(["Close", "Reopen"]);
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Close ticket" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
      expect(onSetStatus.mock.calls).toEqual([["CLOSED"], ["OPEN"]]);
    });

    it("offers only Reopen on a closed ticket already assigned to me", () => {
      renderActions({ status: "CLOSED", canAssignToMe: false });
      expect(names()).toEqual(["Reopen"]);
    });

    it("disables every action while the shared mutation is pending", () => {
      renderActions({ pending: true });
      for (const button of screen.getAllByRole("button")) {
        expect(button).toBeDisabled();
      }
    });

    it("names its group without Status/Priority, so the inspector's labels stay unique", () => {
      renderActions();
      const group = screen.getByRole("group", { name: "Ticket actions" });
      expect(group.getAttribute("aria-label")).not.toMatch(/status|priority/i);
    });
  });

  /** Story 219 (PR-3.4) — the status spine and the realtime change cues (RD-3.13). */
  describe("status spine and change cues (Story 219)", () => {
    function view(
      current: TicketSummary,
      isOwnChange: (field: "status" | "priority" | "assignee") => boolean = () => false,
      assigneeName: string | null = "Ada Lovelace",
    ) {
      return (
        <NextIntlClientProvider locale="en" messages={CATALOGS.en} timeZone="UTC">
          <TicketHeader
            ticket={current}
            locale="en"
            sla={{ status: "ready", target: null }}
            assigneeName={assigneeName}
            onSubjectCommit={vi.fn()}
            isOwnChange={isOwnChange}
          />
        </NextIntlClientProvider>
      );
    }
    const live = (container: HTMLElement) => container.querySelector('[aria-live="polite"]')!;

    it("runs the status spine along the header's top edge, in the status hue", () => {
      locale = "en";
      const { container, rerender } = render(view(ticket));
      const header = container.querySelector("header")!;
      expect(header).toHaveClass("border-t-[3px]", "border-t-progress-solid");
      rerender(view({ ...ticket, status: "RESOLVED" }));
      expect(header).toHaveClass("border-t-success-solid");
    });

    it("cues and announces a status, priority or assignee change made elsewhere", () => {
      locale = "en";
      const { container, rerender } = render(view(ticket));
      expect(container.querySelector("[data-changed]")).toBeNull();
      expect(live(container)).toBeEmptyDOMElement();

      rerender(view({ ...ticket, status: "RESOLVED", priority: "URGENT" }));
      expect(container.querySelectorAll("[data-changed]")).toHaveLength(2);
      expect(live(container)).toHaveTextContent(
        "Status changed to Resolved. Priority changed to Urgent.",
      );

      rerender(
        view(
          { ...ticket, status: "RESOLVED", priority: "URGENT", assignedToUserId: null },
          () => false,
          null,
        ),
      );
      expect(live(container)).toHaveTextContent("Now unassigned.");
    });

    it("never cues or announces the agent's own change", () => {
      locale = "en";
      const own = (field: "status" | "priority" | "assignee") => field === "status";
      const { container, rerender } = render(view(ticket, own));
      rerender(view({ ...ticket, status: "RESOLVED" }, own));
      expect(container.querySelector("[data-changed]")).toBeNull();
      expect(live(container)).toBeEmptyDOMElement();
    });
  });
});
