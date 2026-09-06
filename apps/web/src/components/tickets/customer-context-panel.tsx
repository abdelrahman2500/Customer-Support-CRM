"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCustomerQuery, useTicketsQuery } from "@/hooks/use-tickets";
import { ticketPriorityBadgeVariant, ticketStatusBadgeVariant } from "@/lib/ticket-badges";
import { Alert, Badge, Skeleton } from "@crm/ui";

/** Story 28's own "still needs work" definition (`dashboard-view.tsx`'s
 * `OPEN_STATUSES`) — reused here rather than re-invented, so "other open
 * tickets" means the same thing on this panel as it does on the
 * dashboard. */
const OPEN_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

/** Small enough to stay "compact" (the plan's own word) without a second
 * round of pagination controls — a "view all" link covers the rest. */
const OTHER_TICKETS_LIMIT = 5;

/**
 * RM-04 — Embedded Customer Context Panel. Mounted in `TicketDetailView`
 * right after the header (Design decision: the highest-visibility spot,
 * so an agent sees it before touching any field), showing this customer's
 * other still-open tickets and primary contacts inline — no more need to
 * navigate to `/customers/:id` and back just to answer "does this
 * customer have other open issues?" or "who else can I call?".
 *
 * Pure frontend composition, no new endpoint (plan's own Backend work
 * section): reuses `GET /tickets?customerId=` (already scoped/paginated,
 * Story S-8d/S-8e) for the tickets half, and `GET /customers/:id` (whose
 * response already embeds `contacts`, Design item 1 of Story 26) for the
 * contacts half — the same two hooks `CustomerDetailView` already calls
 * for its own Related Tickets / Contacts cards, just parameterized to the
 * current ticket's customer instead of the customer detail route's own id.
 * Read-only: no editing capability lives on this panel.
 */
export function CustomerContextPanel({
  ticketId,
  customerId,
}: {
  ticketId: string;
  customerId: string;
}) {
  const t = useTranslations("tickets");
  const { locale } = useParams<{ locale: string }>();

  const ticketsQuery = useTicketsQuery({
    customerId,
    statuses: [...OPEN_STATUSES],
    pageSize: OTHER_TICKETS_LIMIT,
  });
  const customerQuery = useCustomerQuery(customerId);

  // The current ticket itself always matches `customerId` + is usually
  // still open — excluded client-side (the plan's own wording), since the
  // backend has no "every ticket except this one" filter and inventing
  // one for a single capped list isn't worth a new query parameter.
  const otherTickets = (ticketsQuery.data?.items ?? []).filter(
    (ticket) => ticket.id !== ticketId,
  );
  const primaryContacts = (customerQuery.data?.contacts ?? []).filter(
    (contact) => contact.isPrimary,
  );

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("detail.contextPanelHeading")}</h2>

      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("detail.contextPanelTicketsHeading")}
          </h3>
          <Link
            href={`/${locale}/customers/${customerId}`}
            className="focus-ring rounded-sm text-xs text-slate-500 hover:underline"
          >
            {t("detail.contextPanelViewAll")}
          </Link>
        </div>
        {ticketsQuery.isLoading && <Skeleton className="mt-1 h-12 w-full" />}
        {ticketsQuery.isError && (
          <Alert variant="destructive" className="mt-1">
            {t("detail.contextPanelTicketsError")}
          </Alert>
        )}
        {ticketsQuery.isSuccess && otherTickets.length === 0 && (
          <p className="mt-1 text-sm text-slate-500">{t("detail.contextPanelTicketsEmpty")}</p>
        )}
        {ticketsQuery.isSuccess && otherTickets.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {otherTickets.map((ticket) => (
              <li key={ticket.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/${locale}/tickets/${ticket.id}`}
                  className="focus-ring truncate rounded-sm font-medium text-slate-800 hover:underline"
                >
                  {ticket.subject}
                </Link>
                <span className="flex shrink-0 items-center gap-1">
                  <Badge variant={ticketStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                  <Badge variant={ticketPriorityBadgeVariant(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("detail.contextPanelContactsHeading")}
        </h3>
        {customerQuery.isLoading && <Skeleton className="mt-1 h-8 w-full" />}
        {customerQuery.isError && (
          <Alert variant="destructive" className="mt-1">
            {t("detail.contextPanelContactsError")}
          </Alert>
        )}
        {customerQuery.isSuccess && primaryContacts.length === 0 && (
          <p className="mt-1 text-sm text-slate-500">{t("detail.contextPanelContactsEmpty")}</p>
        )}
        {customerQuery.isSuccess && primaryContacts.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {primaryContacts.map((contact) => (
              <li key={contact.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-slate-800">{contact.fullName}</span>
                {contact.email && <span className="text-slate-500">{contact.email}</span>}
                {contact.phone && <span className="text-slate-500">{contact.phone}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
