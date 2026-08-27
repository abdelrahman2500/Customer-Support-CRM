"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCustomersQuery, useTicketsQuery } from "@/hooks/use-tickets";
import type { TicketListItem } from "@/lib/tickets-api";
import { deriveSlaStatus, formatRemaining } from "@/lib/sla";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Story 28 — a work queue, not a full history: only tickets still open
 * belong on the dashboard. `RESOLVED`/`CLOSED` tickets remain reachable via
 * the existing Ticket List. */
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

function SlaPresentation({ ticket, now }: { ticket: TicketListItem; now: Date }) {
  const t = useTranslations("tickets");
  const status = deriveSlaStatus(ticket.slaTarget, now);
  if (status.kind === "none") {
    return <span className="text-slate-400">{t("sla.none")}</span>;
  }
  if (status.kind === "breached") {
    return <Badge variant="destructive">{t("sla.breached")}</Badge>;
  }
  return (
    <span className="text-slate-700">{t("sla.remaining", { time: formatRemaining(status.remainingMs) })}</span>
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
 */
export function DashboardView({ userId }: { userId: string }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const ticketsQuery = useTicketsQuery({ assignedToUserId: userId });
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
    const openTickets = (ticketsQuery.data ?? [])
      .filter((ticket) => OPEN_STATUSES.has(ticket.status))
      .slice()
      .sort((a, b) => {
        const ka = slaSortKey(a, now);
        const kb = slaSortKey(b, now);
        return ka.rank !== kb.rank ? ka.rank - kb.rank : ka.targetAt - kb.targetAt;
      });
    return { openTickets, now };
  }, [ticketsQuery.data]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("heading")}</h2>

        {ticketsQuery.isLoading && (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {ticketsQuery.isError && (
          <Alert variant="destructive" className="mt-2 flex items-center justify-between">
            <span>{t("error")}</span>
            <Button variant="outline" size="sm" onClick={() => ticketsQuery.refetch()}>
              {t("retry")}
            </Button>
          </Alert>
        )}

        {ticketsQuery.isSuccess && openTickets.length === 0 && (
          <p className="mt-2 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            {t("empty")}
          </p>
        )}

        {ticketsQuery.isSuccess && openTickets.length > 0 && (
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
                    className="w-fit text-xs text-slate-500 hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(`/${locale}/customers/${ticket.customerId}`);
                    }}
                  >
                    {customerNameById.get(ticket.customerId) ?? ticket.customerId}
                  </button>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{ticket.status}</Badge>
                  <Badge variant={priorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge>
                  <SlaPresentation ticket={ticket} now={now} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
