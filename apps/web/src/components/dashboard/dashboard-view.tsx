"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTicketsQuery, useUpdateTicketMutation } from "@/hooks/use-tickets";
import type { TicketListItem, TicketStatus } from "@/lib/tickets-api";
import { deriveSlaStatus, formatRemaining } from "@/lib/sla";
import { ticketPriorityBadgeVariant, ticketStatusBadgeVariant } from "@/lib/ticket-badges";
import { ApiError } from "@/lib/api";
import { Alert, Badge, Button, Skeleton } from "@crm/ui";
import { TasksPanel } from "./tasks-panel";

/** Story 28 — a work queue, not a full history: only tickets still open
 * belong on the dashboard. `RESOLVED`/`CLOSED` tickets remain reachable via
 * the existing Ticket List. Story 29 reuses this same set for the
 * "Unclaimed tickets" section — an unassigned ticket that's already
 * resolved/closed has nothing left to claim. */
/** Story 28/29 — this screen's own definition of "still needs work".
 * Story S-9 — a typed list rather than a `Set`: it is now sent to the API
 * as the panels' `statuses` filter instead of being tested with `.has`
 * after the fetch, so it has to be exactly the API's own union. */
const OPEN_STATUSES: readonly TicketStatus[] = ["OPEN", "IN_PROGRESS"];

/**
 * Story S-9 — the SLA-urgency ranking these panels show is now
 * `GET /tickets?sortBy=slaUrgency`, and the `slaSortKey`/`sortByUrgency`
 * helpers that lived here are gone with it.
 *
 * They ranked breached-first, then soonest-target, then no-target last.
 * That key is equal to plain "governing target ascending, nulls last": a
 * breached ticket's target is in the past and an on-track one's is in the
 * future, so the rank term never changed the order — which is also why the
 * ranking never actually depended on `now`. `deriveSlaStatus` is still
 * used below, for the per-row badge and remaining-time text, which do.
 */

function SlaPresentation({ ticket, now }: { ticket: TicketListItem; now: Date }) {
  const t = useTranslations("tickets");
  const status = deriveSlaStatus(ticket.slaTarget, now);
  if (status.kind === "none") {
    return <span className="text-ink-subtle">{t("sla.none")}</span>;
  }
  if (status.kind === "breached") {
    return <Badge variant="destructive">{t("sla.breached")}</Badge>;
  }
  return (
    <span className="text-slate-700">
      {t("sla.remaining", { time: formatRemaining(status.remainingMs) })}
    </span>
  );
}

/**
 * Story 29 — one row of the "Unclaimed tickets" section. A dedicated
 * component (not inline in a `.map()`) because `useUpdateTicketMutation(id)`
 * is a hook and must be called once per component instance, not once per
 * loop iteration (React's rules of hooks) — the same per-ticket-id binding
 * `TicketDetailView` already relies on, just repeated per list item here.
 * Reuses the existing `PATCH /tickets/:id` mutation verbatim: claiming is
 * exactly `{ assignedToUserId: currentUserId }`, the same payload shape
 * `TicketDetailView`'s own assignee `Select` already sends. Never
 * optimistic — the row keeps rendering from the still-stale list until the
 * mutation's own existing `["tickets"]` cache invalidation causes a real
 * refetch, which then naturally excludes the now-assigned ticket.
 */
function UnclaimedTicketRow({
  ticket,
  customerName,
  now,
  currentUserId,
}: {
  ticket: TicketListItem;
  customerName: string;
  now: Date;
  currentUserId: string;
}) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const mutation = useUpdateTicketMutation(ticket.id);

  return (
    <li className="flex flex-col gap-1 border-b border-slate-100 pb-2 sm:flex-row sm:items-center sm:justify-between">
      <span
        className="flex cursor-pointer flex-col"
        onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
      >
        <Link
          href={`/${locale}/tickets/${ticket.id}`}
          className="focus-ring w-fit rounded-sm font-medium text-slate-800 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {ticket.subject}
        </Link>
        <Link
          href={`/${locale}/customers/${ticket.customerId}`}
          className="focus-ring w-fit rounded-sm text-xs text-ink-subtle hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {customerName}
        </Link>
        {mutation.isError && (
          <span className="text-xs text-red-600">
            {mutation.error instanceof ApiError && mutation.error.status === 403
              ? t("claimForbidden")
              : t("claimFailed")}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <Badge variant={ticketStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
        <Badge variant={ticketPriorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge>
        <SlaPresentation ticket={ticket} now={now} />
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={(event) => {
            event.stopPropagation();
            mutation.mutate({ assignedToUserId: currentUserId });
          }}
        >
          {mutation.isPending ? t("claiming") : t("claimButton")}
        </Button>
      </span>
    </li>
  );
}

/**
 * Story 28 — replaces the Story 23 `/dashboard` redirect stub. Fetches the
 * authenticated agent's own tickets via the existing `GET
 * /tickets?assignedToUserId=` filter (Story 23) — never the branch-wide
 * list. No filter/sort/search UI — this is a fixed, pre-scoped view
 * (plan §6/§9).
 *
 * Story S-9 — supersedes Story 28's and Story 29's client-side refinement.
 * Narrowing to open work and ranking by SLA urgency are both the server's
 * answer now, so the panels render the page they are given, in order. The
 * "fetch the already-scoped result, refine client-side" precedent Story 27
 * established is what pagination made untenable: refining after the fetch
 * can only ever discard rows from a window the server chose on some other
 * basis.
 *
 * Story 29 — adds a second, independent "Unclaimed tickets" section: the
 * same unfiltered `GET /tickets` call `CustomerDetailView`/`TicketListView`
 * already make, narrowed client-side to `assignedToUserId === null` and an
 * open status, with a "Claim" action per row. The existing Ticket List is
 * not modified — `assignedToUserId` is validated `@IsUUID()` server-side
 * and cannot express "no assignee" as a query parameter, so this queue
 * lives here, using the same client-side-filtering pattern already
 * established, rather than inventing a new backend contract.
 *
 * Story S-8d — supersedes Story 29's client-side narrowing. "Unclaimed"
 * is now asked of the server (`GET /tickets?unassigned=true`) instead of
 * being filtered out of the branch-wide list, and the customer name
 * arrives on the ticket rather than from a separate customer fetch. Story
 * 28's own-tickets section is unchanged. The Story 29 approach could not
 * survive pagination — and was already lossy, since an unclaimed ticket
 * outside the list's cap was invisible here.
 */
export function DashboardView({ userId }: { userId: string }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  /**
   * Story S-9 — the server now answers both of this screen's questions.
   *
   * S-8e had to take a bounded 100-row window here because the urgency
   * ranking was computed in the browser: the server could not return "the
   * 25 most urgent", so a pager would have let page 2 hold a more urgent
   * ticket than page 1. `sortBy: "slaUrgency"` removes that constraint —
   * the first page IS the most urgent page, which is exactly what a
   * dashboard panel wants — so the window and its documented caveat both
   * go away.
   *
   * `statuses` has to move server-side with the ordering, not stay a
   * client-side filter. An SLA target outlives the ticket being resolved,
   * so a resolved ticket's long-past target ranks as maximally urgent;
   * filtering after the fetch would let those fill the page ahead of open
   * work that is genuinely breaching. Which statuses count as "still needs
   * work" is still this screen's own definition (Story 28's
   * `OPEN_STATUSES`) — only the filtering moved.
   */
  const PANEL_STATUSES = [...OPEN_STATUSES];
  const myTicketsQuery = useTicketsQuery({
    assignedToUserId: userId,
    statuses: PANEL_STATUSES,
    sortBy: "slaUrgency",
  });
  /**
   * Story S-8d — asks the server for unclaimed tickets instead of fetching
   * the branch-wide list and filtering it here.
   *
   * The old `useTicketsQuery({})` returned the newest 500 tickets and this
   * screen then picked the unassigned ones out of them, so an unclaimed
   * ticket older than that window could never appear — and the oldest
   * unclaimed ticket is exactly the one most needing attention. Asking the
   * question server-side fixes that outright, and it is what lets
   * `GET /tickets` be paginated without this panel silently narrowing
   * further.
   */
  const unclaimedTicketsQuery = useTicketsQuery({
    unassigned: "true",
    statuses: PANEL_STATUSES,
    sortBy: "slaUrgency",
  });

  // `now` is computed once per fetched result, alongside the filter/sort
  // that depends on it, so the ordering and the on-screen remaining-time
  // text (rendered from the same `now`, passed to `SlaPresentation` below)
  // can never disagree with each other.
  const { openTickets, now } = useMemo(() => {
    // Story S-9 — the rows arrive already narrowed and already ranked. `now`
    // is still computed once per result, because the remaining-time text
    // `SlaPresentation` renders is derived from it and must not disagree
    // with itself across a row.
    const now = new Date();
    return { openTickets: myTicketsQuery.data?.items ?? [], now };
  }, [myTicketsQuery.data]);

  const { unclaimedTickets, now: unclaimedNow } = useMemo(() => {
    // Story S-9 — see above: assignment, status and ranking are all the
    // server's answer now.
    const now = new Date();
    return { unclaimedTickets: unclaimedTicketsQuery.data?.items ?? [], now };
  }, [unclaimedTicketsQuery.data]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("heading")}</h2>

        {myTicketsQuery.isLoading && (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {myTicketsQuery.isError && (
          <Alert variant="destructive" className="mt-2 flex items-center justify-between">
            <span>{t("error")}</span>
            <Button variant="outline" size="sm" onClick={() => myTicketsQuery.refetch()}>
              {t("retry")}
            </Button>
          </Alert>
        )}

        {/* Story 98 — Design System & Visual Polish. Recon flagged this as
            the clearest missing next-action: previously static text with
            no path forward when an agent has nothing open right now. */}
        {myTicketsQuery.isSuccess && openTickets.length === 0 && (
          <div className="mt-2 flex flex-col items-center gap-2 rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
            <p>{t("empty")}</p>
            <Link
              href={`/${locale}/tickets`}
              className="focus-ring rounded-sm font-medium text-slate-700 hover:underline"
            >
              {t("browseAllTicketsLink")}
            </Link>
          </div>
        )}

        {myTicketsQuery.isSuccess && openTickets.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {openTickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex cursor-pointer items-center justify-between border-b border-slate-100 pb-2"
                onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
              >
                <span className="flex flex-col">
                  <Link
                    href={`/${locale}/tickets/${ticket.id}`}
                    className="focus-ring w-fit rounded-sm font-medium text-slate-800 hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {ticket.subject}
                  </Link>
                  <Link
                    href={`/${locale}/customers/${ticket.customerId}`}
                    className="focus-ring w-fit rounded-sm text-xs text-ink-subtle hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {/* Story S-8d — resolved by the API. */}
                    {ticket.customerName ?? ticket.customerId}
                  </Link>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={ticketStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                  <Badge variant={ticketPriorityBadgeVariant(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                  <SlaPresentation ticket={ticket} now={now} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TasksPanel userId={userId} />

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("unassignedHeading")}</h2>

        {unclaimedTicketsQuery.isLoading && (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {unclaimedTicketsQuery.isError && (
          <Alert variant="destructive" className="mt-2 flex items-center justify-between">
            <span>{t("unassignedError")}</span>
            <Button variant="outline" size="sm" onClick={() => unclaimedTicketsQuery.refetch()}>
              {t("retry")}
            </Button>
          </Alert>
        )}

        {unclaimedTicketsQuery.isSuccess && unclaimedTickets.length === 0 && (
          <p className="mt-2 rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
            {t("unassignedEmpty")}
          </p>
        )}

        {unclaimedTicketsQuery.isSuccess && unclaimedTickets.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {unclaimedTickets.map((ticket) => (
              <UnclaimedTicketRow
                key={ticket.id}
                ticket={ticket}
                customerName={ticket.customerName ?? ticket.customerId}
                now={unclaimedNow}
                currentUserId={userId}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
