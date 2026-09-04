"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCustomersQuery, useTicketsQuery, useUpdateTicketMutation } from "@/hooks/use-tickets";
import type { TicketListItem } from "@/lib/tickets-api";
import { deriveSlaStatus, formatRemaining } from "@/lib/sla";
import { ApiError } from "@/lib/api";
import { Alert, Badge, Button, Skeleton } from "@crm/ui";

/** Story 28 — a work queue, not a full history: only tickets still open
 * belong on the dashboard. `RESOLVED`/`CLOSED` tickets remain reachable via
 * the existing Ticket List. Story 29 reuses this same set for the
 * "Unclaimed tickets" section — an unassigned ticket that's already
 * resolved/closed has nothing left to claim. */
const OPEN_STATUSES = new Set(["OPEN", "IN_PROGRESS"]);

/** Duplicated from `ticket-list-view.tsx` rather than shared — the same
 * small presentational-helper duplication `customer-detail-view.tsx`
 * (Story 27) already established for this exact helper, in place of a
 * premature shared-component extraction. */
function priorityBadgeVariant(priority: string) {
  if (priority === "URGENT") return "destructive" as const;
  if (priority === "HIGH") return "warning" as const;
  return "secondary" as const;
}

/** Story 98 — Design System & Visual Polish. Mirrors `ticket-list-view.tsx`'s
 * own `statusBadgeVariant` exactly — see that file's doc comment for why. */
function statusBadgeVariant(status: string) {
  if (status === "OPEN") return "warning" as const;
  if (status === "RESOLVED") return "success" as const;
  if (status === "CLOSED") return "outline" as const;
  return "secondary" as const; // IN_PROGRESS
}

/**
 * SLA-urgency sort key: breached tickets first, then on-track tickets by
 * soonest remaining target, then tickets with no target last. This only
 * orders values `deriveSlaStatus` already computes — no new "at risk"
 * threshold or business rule is introduced (plan Design/§6: presentation
 * ordering only).
 */
function slaSortKey(ticket: TicketListItem, now: Date): { rank: number; targetAt: number } {
  const status = deriveSlaStatus(ticket.slaTarget, now);
  if (status.kind === "breached") {
    return { rank: 0, targetAt: status.targetAt.getTime() };
  }
  if (status.kind === "on-track") {
    return { rank: 1, targetAt: status.targetAt.getTime() };
  }
  return { rank: 2, targetAt: Number.POSITIVE_INFINITY };
}

function sortByUrgency(tickets: TicketListItem[], now: Date): TicketListItem[] {
  return tickets.slice().sort((a, b) => {
    const ka = slaSortKey(a, now);
    const kb = slaSortKey(b, now);
    return ka.rank !== kb.rank ? ka.rank - kb.rank : ka.targetAt - kb.targetAt;
  });
}

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
        role="button"
        tabIndex={0}
        className="flex cursor-pointer flex-col"
        onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            router.push(`/${locale}/tickets/${ticket.id}`);
          }
        }}
      >
        <span className="font-medium text-slate-800">{ticket.subject}</span>
        <button
          type="button"
          className="w-fit rounded-sm text-xs text-slate-500 hover:underline focus-ring"
          onClick={(event) => {
            event.stopPropagation();
            router.push(`/${locale}/customers/${ticket.customerId}`);
          }}
        >
          {customerName}
        </button>
        {mutation.isError && (
          <span className="text-xs text-red-600">
            {mutation.error instanceof ApiError && mutation.error.status === 403
              ? t("claimForbidden")
              : t("claimFailed")}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
        <Badge variant={priorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge>
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
 * list. Client-side, the already-fetched result is narrowed to open work
 * and ordered by SLA urgency (see `slaSortKey`) — mirroring the same
 * "fetch the already-scoped result, refine client-side" precedent Story 27
 * established for `CustomerDetailView`'s Related Tickets section. No
 * filter/sort/search UI — this is a fixed, pre-scoped view (plan §6/§9).
 *
 * Story 29 — adds a second, independent "Unclaimed tickets" section: the
 * same unfiltered `GET /tickets` call `CustomerDetailView`/`TicketListView`
 * already make, narrowed client-side to `assignedToUserId === null` and an
 * open status, with a "Claim" action per row. The existing Ticket List is
 * not modified — `assignedToUserId` is validated `@IsUUID()` server-side
 * and cannot express "no assignee" as a query parameter, so this queue
 * lives here, using the same client-side-filtering pattern already
 * established, rather than inventing a new backend contract.
 */
export function DashboardView({ userId }: { userId: string }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const myTicketsQuery = useTicketsQuery({ assignedToUserId: userId });
  const allTicketsQuery = useTicketsQuery({});
  const customersQuery = useCustomersQuery();

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const customer of customersQuery.data ?? []) {
      map.set(customer.id, customer.displayName);
    }
    return map;
  }, [customersQuery.data]);

  // `now` is computed once per fetched result, alongside the filter/sort
  // that depends on it, so the ordering and the on-screen remaining-time
  // text (rendered from the same `now`, passed to `SlaPresentation` below)
  // can never disagree with each other.
  const { openTickets, now } = useMemo(() => {
    const now = new Date();
    const openTickets = sortByUrgency(
      (myTicketsQuery.data ?? []).filter((ticket) => OPEN_STATUSES.has(ticket.status)),
      now,
    );
    return { openTickets, now };
  }, [myTicketsQuery.data]);

  const { unclaimedTickets, now: unclaimedNow } = useMemo(() => {
    const now = new Date();
    const unclaimedTickets = sortByUrgency(
      (allTicketsQuery.data ?? []).filter(
        (ticket) => ticket.assignedToUserId === null && OPEN_STATUSES.has(ticket.status),
      ),
      now,
    );
    return { unclaimedTickets, now };
  }, [allTicketsQuery.data]);

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
          <div className="mt-2 flex flex-col items-center gap-2 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            <p>{t("empty")}</p>
            <button
              type="button"
              className="rounded-sm font-medium text-slate-700 hover:underline focus-ring"
              onClick={() => router.push(`/${locale}/tickets`)}
            >
              {t("browseAllTicketsLink")}
            </button>
          </div>
        )}

        {myTicketsQuery.isSuccess && openTickets.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {openTickets.map((ticket) => (
              <li
                key={ticket.id}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center justify-between border-b border-slate-100 pb-2"
                onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    router.push(`/${locale}/tickets/${ticket.id}`);
                  }
                }}
              >
                <span className="flex flex-col">
                  <span className="font-medium text-slate-800">{ticket.subject}</span>
                  <button
                    type="button"
                    className="w-fit rounded-sm text-xs text-slate-500 hover:underline focus-ring"
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(`/${locale}/customers/${ticket.customerId}`);
                    }}
                  >
                    {customerNameById.get(ticket.customerId) ?? ticket.customerId}
                  </button>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                  <Badge variant={priorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge>
                  <SlaPresentation ticket={ticket} now={now} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("unassignedHeading")}</h2>

        {allTicketsQuery.isLoading && (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {allTicketsQuery.isError && (
          <Alert variant="destructive" className="mt-2 flex items-center justify-between">
            <span>{t("unassignedError")}</span>
            <Button variant="outline" size="sm" onClick={() => allTicketsQuery.refetch()}>
              {t("retry")}
            </Button>
          </Alert>
        )}

        {allTicketsQuery.isSuccess && unclaimedTickets.length === 0 && (
          <p className="mt-2 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            {t("unassignedEmpty")}
          </p>
        )}

        {allTicketsQuery.isSuccess && unclaimedTickets.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {unclaimedTickets.map((ticket) => (
              <UnclaimedTicketRow
                key={ticket.id}
                ticket={ticket}
                customerName={customerNameById.get(ticket.customerId) ?? ticket.customerId}
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
