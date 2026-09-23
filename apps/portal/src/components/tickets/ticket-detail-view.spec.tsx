import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketDetailView } from "./ticket-detail-view";
import {
  useMyTicketCsatQuery,
  useMyTicketHistoryQuery,
  useMyTicketMessagesQuery,
  useMyTicketQuery,
  useSendMyTicketMessageMutation,
  useSubmitMyTicketCsatMutation,
} from "@/hooks/use-portal-tickets";
import {
  useMyTicketAttachmentsQuery,
  useUploadMyTicketAttachmentMutation,
} from "@/hooks/use-portal-attachments";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-portal-tickets", () => ({
  useMyTicketQuery: vi.fn(),
  useMyTicketHistoryQuery: vi.fn(),
  useMyTicketCsatQuery: vi.fn(),
  useSubmitMyTicketCsatMutation: vi.fn(),
  useMyTicketMessagesQuery: vi.fn(),
  useSendMyTicketMessageMutation: vi.fn(),
}));

// Story 103 — `TicketAttachmentsCard`'s own behavior is covered by its
// dedicated spec; this file only needs its two hooks swapped out so no
// real `useQuery`/`useMutation` call ever runs without a `QueryClient`.
vi.mock("@/hooks/use-portal-attachments", () => ({
  useMyTicketAttachmentsQuery: vi.fn(),
  useUploadMyTicketAttachmentMutation: vi.fn(),
}));

// Story 78 — this app's first realtime subscription; its own behavior is
// covered by its dedicated spec, so this file only needs a no-op mock.
vi.mock("@/hooks/use-portal-ticket-realtime", () => ({
  usePortalTicketRealtime: vi.fn(),
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

const baseTicket = {
  id: "ticket-1",
  subject: "Cannot log in",
  categoryId: "category-1",
  categoryName: "account",
  priority: "MEDIUM",
  status: "OPEN",
  customerId: "customer-1",
  contactId: "contact-1",
  departmentId: null,
  assignedToUserId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("TicketDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyTicketHistoryQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useMyTicketCsatQuery).mockReturnValue(
      queryResult({ data: null, isSuccess: true }) as never,
    );
    vi.mocked(useSubmitMyTicketCsatMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useMyTicketMessagesQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useSendMyTicketMessageMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: "message-new" }),
      isPending: false,
    } as never);
    vi.mocked(useMyTicketAttachmentsQuery).mockReturnValue(
      queryResult({ data: [], isSuccess: true }) as never,
    );
    vi.mocked(useUploadMyTicketAttachmentMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);
  });

  it("renders a loading skeleton while the ticket query is pending", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TicketDetailView ticketId="ticket-1" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  // Story 97 — Loading & Skeleton UX.
  it("shapes the loading skeleton to the real header/chat/history layout, not two generic blocks", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TicketDetailView ticketId="ticket-1" />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
  });

  it("renders a not-found message when the ticket lookup 404s", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Not found", 404) }) as never,
    );

    render(<TicketDetailView ticketId="missing" />);

    expect(screen.getByText("detail.notFound")).toBeInTheDocument();
  });

  it("renders a generic load error for a non-404 failure", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.loadError")).toBeInTheDocument();
  });

  it("renders the ticket's subject, status, priority, and category", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("Cannot log in")).toBeInTheDocument();
    // Story 148 — the translated label, sharing `tickets.status.*` with
    // the list and its status filter. This file stubs `useTranslations`
    // to echo the key, so the key is what renders here.
    expect(screen.getByText("status.OPEN")).toBeInTheDocument();
    expect(screen.getByText("MEDIUM")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
  });

  // Story 98 — Design System & Visual Polish.
  it("gives the status pill a visually distinct color, mirroring apps/web's own status color semantics", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("status.OPEN")).toHaveClass("bg-warning-surface");
  });

  it("renders the empty history message when there are no entries", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.historyEmpty")).toBeInTheDocument();
  });

  it("renders history entries when present", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );
    vi.mocked(useMyTicketHistoryQuery).mockReturnValue(
      queryResult({
        data: [
          {
            id: "history-1",
            eventType: "ticket.created",
            actorUserId: null,
            snapshot: {},
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        isSuccess: true,
      }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("ticket.created")).toBeInTheDocument();
  });

  it("renders an inline error when history fails to load", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );
    vi.mocked(useMyTicketHistoryQuery).mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500) }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.historyError")).toBeInTheDocument();
  });

  // Story 55 — Customer Portal — Ticket CSAT / Feedback.
  it("does not render the feedback section for an OPEN ticket", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: baseTicket, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.queryByText("detail.csatHeading")).not.toBeInTheDocument();
  });

  it("renders the feedback form for a RESOLVED ticket with no response yet", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: { ...baseTicket, status: "RESOLVED" }, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.csatHeading")).toBeInTheDocument();
    expect(screen.getByText("detail.csatSubmit")).toBeInTheDocument();
  });

  it("renders the feedback form for a CLOSED ticket with no response yet", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: { ...baseTicket, status: "CLOSED" }, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.csatHeading")).toBeInTheDocument();
    expect(screen.getByText("detail.csatSubmit")).toBeInTheDocument();
  });

  it("renders the read-only summary once a response exists, not the form", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: { ...baseTicket, status: "RESOLVED" }, isSuccess: true }) as never,
    );
    vi.mocked(useMyTicketCsatQuery).mockReturnValue(
      queryResult({
        data: {
          id: "csat-1",
          ticketId: "ticket-1",
          submittedByContactId: "contact-1",
          rating: 4,
          comment: "Great support",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        isSuccess: true,
      }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("Great support")).toBeInTheDocument();
    expect(screen.queryByText("detail.csatSubmit")).not.toBeInTheDocument();
  });

  it("disables the submit button until a rating is chosen", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(
      queryResult({ data: { ...baseTicket, status: "RESOLVED" }, isSuccess: true }) as never,
    );

    render(<TicketDetailView ticketId="ticket-1" />);

    expect(screen.getByText("detail.csatSubmit").closest("button")).toBeDisabled();
  });

  // Story 167 — the rating was five hand-built role="radio" buttons with no
  // tabIndex management and no arrow-key handling, so all five were separate
  // tab stops and arrows did nothing. Native radios now supply the whole
  // pattern; these tests assert the pattern, never the component's state.
  describe("CSAT rating keyboard pattern (Story 167)", () => {
    function renderResolved() {
      vi.mocked(useMyTicketQuery).mockReturnValue(
        queryResult({ data: { ...baseTicket, status: "RESOLVED" }, isSuccess: true }) as never,
      );
      render(<TicketDetailView ticketId="ticket-1" />);
      return screen.getAllByRole("radio");
    }

    function submitButton() {
      return screen.getByText("detail.csatSubmit").closest("button");
    }

    function checkedRatings(radios: HTMLElement[]) {
      return radios.filter((radio) => (radio as HTMLInputElement).checked);
    }

    /** Tab forward from wherever focus is until it enters the rating group.
     * The group sits well down the page (the back link, the chat card and the
     * attachments card all precede it), so its entry point cannot be reached
     * by a fixed number of Tabs. */
    async function tabIntoGroup(
      user: ReturnType<typeof userEvent.setup>,
      radios: HTMLElement[],
    ): Promise<Element | null> {
      for (let step = 0; step < 50; step += 1) {
        await user.tab();
        if (radios.includes(document.activeElement as HTMLElement)) {
          return document.activeElement;
        }
      }
      throw new Error("Tab never reached the rating group");
    }

    it("exposes five named radios in a labelled group, none checked initially", () => {
      const radios = renderResolved();

      expect(
        screen.getByRole("radiogroup", { name: "detail.csatRatingSelectLabel" }),
      ).toBeInTheDocument();
      expect(radios).toHaveLength(5);
      for (const value of [1, 2, 3, 4, 5]) {
        expect(screen.getByRole("radio", { name: String(value) })).toBeInTheDocument();
      }
      expect(checkedRatings(radios)).toHaveLength(0);
    });

    // The defect this story fixes: previously each of the five was its own tab
    // stop, so this Tab landed on rating 2 instead of leaving the group.
    it("forms a single tab stop rather than five", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      radios[0]!.focus();
      await user.tab();

      expect(radios).not.toContain(document.activeElement);
    });

    it("enters the group at the first rating when none is checked", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      expect(await tabIntoGroup(user, radios)).toBe(radios[0]);
    });

    it("enters the group at the checked rating once one is chosen", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      await user.click(radios[2]!);
      (document.activeElement as HTMLElement | null)?.blur();

      expect(await tabIntoGroup(user, radios)).toBe(radios[2]);
    });

    it("moves to and selects the next rating on Right and Down", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      radios[0]!.focus();
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(radios[1]);
      expect(radios[1]).toBeChecked();
      expect(radios[0]).not.toBeChecked();

      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(radios[2]);
      expect(radios[2]).toBeChecked();
      expect(radios[1]).not.toBeChecked();
    });

    it("moves to and selects the previous rating on Left and Up", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      radios[2]!.focus();
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(radios[1]);
      expect(radios[1]).toBeChecked();

      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(radios[0]);
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();
    });

    it("wraps from the first rating to the last and from the last to the first", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      radios[0]!.focus();
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(radios[4]);
      expect(radios[4]).toBeChecked();

      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(radios[0]);
      expect(radios[0]).toBeChecked();
      expect(radios[4]).not.toBeChecked();
    });

    it("selects the focused rating on Space", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      radios[2]!.focus();
      expect(radios[2]).not.toBeChecked();

      await user.keyboard(" ");
      expect(radios[2]).toBeChecked();
    });

    it("keeps exactly one rating checked as the selection moves", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      await user.click(radios[1]!);
      expect(checkedRatings(radios)).toHaveLength(1);

      await user.keyboard("{ArrowRight}");
      await user.keyboard("{ArrowRight}");

      const checked = checkedRatings(radios);
      expect(checked).toHaveLength(1);
      expect(checked[0]).toBe(radios[3]);
    });

    it("enables submission after a keyboard-only rating selection", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      expect(submitButton()).toBeDisabled();

      await tabIntoGroup(user, radios);
      await user.keyboard("{ArrowRight}");

      expect(radios[1]).toBeChecked();
      expect(submitButton()).not.toBeDisabled();
    });

    it("still selects a rating by mouse", async () => {
      const user = userEvent.setup();
      const radios = renderResolved();

      await user.click(radios[3]!);

      expect(radios[3]).toBeChecked();
      expect(submitButton()).not.toBeDisabled();
    });

    // Design decision 3 — focus lands on the visually-clipped input, so the
    // visible box is ringed through `peer`. No behavioural test can reach this,
    // and dropping it would leave a keyboard user with no visible focus at all.
    it("rings the visible box from the input through peer", () => {
      const radios = renderResolved();

      for (const radio of radios) {
        expect(radio).toHaveClass("peer");
        expect(radio).toHaveClass("sr-only");

        const box = radio.nextElementSibling;
        expect(box).not.toBeNull();
        expect(box).toHaveClass("peer-focus-visible:ring-2");
        expect(box).toHaveClass("peer-focus-visible:ring-focus");
      }
    });

    /* RTL arrow mirroring is deliberately NOT asserted here. Measured in this
       repository's own environment: under `dir="rtl"`, user-event v14 moves
       {ArrowLeft} backward, identically to LTR, where a real browser moves it
       forward. Asserting the mirrored behaviour would fail; asserting the LTR
       result would pin the wrong contract as if it were correct. The criterion
       is met structurally instead — the group delegates every directional
       decision to the browser, which is what this test pins. */
    it("delegates all keyboard behaviour to native radios, adding none of its own", () => {
      const radios = renderResolved();

      for (const radio of radios) {
        expect(radio.tagName).toBe("INPUT");
        expect(radio).toHaveAttribute("type", "radio");
        expect(radio).toHaveAttribute("name", "csat-rating");
        // A roving-tabindex or hand-rolled ARIA implementation would show here.
        expect(radio).not.toHaveAttribute("tabindex");
        expect(radio).not.toHaveAttribute("role");
        expect(radio).not.toHaveAttribute("aria-checked");
      }
    });
  });

  // Story 165 — the early-return loading state announces itself. The
  // announcement lives at the call site, never inside the shared skeleton:
  // route-level `loading.tsx` renders that same component and deliberately
  // does not announce (see `RouteLoadingSkeleton`).
  // `placeholderHidden={false}` here: TicketDetailSkeleton already carries
  // `aria-hidden` on its own root, so the wrapper must not add a second.
  it("announces the detail loading state while the skeleton hides itself", () => {
    vi.mocked(useMyTicketQuery).mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<TicketDetailView ticketId="ticket-1" />);

    const status = screen.getByRole("status", { name: "loading" });
    expect(status).toHaveAttribute("aria-busy", "true");

    // The wrapper adds no aria-hidden of its own...
    expect(status.firstElementChild).not.toHaveAttribute("aria-hidden");
    // ...because the skeleton already hides its whole subtree.
    expect(status.querySelector("[aria-hidden='true']")).toBeInTheDocument();

    // The skeleton's own visuals are unchanged.
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
