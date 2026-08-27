"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCustomerQuery, useTicketsQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

function priorityBadgeVariant(priority: string) {
  if (priority === "URGENT") return "destructive" as const;
  if (priority === "HIGH") return "warning" as const;
  return "secondary" as const;
}

/**
 * Story 26 — Customer Detail. Mirrors `TicketDetailView`'s structure: a
 * loading/error/content shape, the same 404-vs-generic error distinction,
 * and a bordered card per section. Read-only (plan Design item 7 — no
 * `PATCH /customers/:id` usage, no contact CRUD). Contacts render straight
 * from the customer-detail response's already-embedded `contacts` array
 * (Design item 1) — no second request.
 *
 * Story 27 — adds a "Related tickets" card, derived by filtering the
 * existing, already-fetched, unpaginated `GET /tickets` result client-side
 * by `customerId` (plan Design item 1 — no backend `customerId` filter
 * parameter is introduced), plus a "New ticket" action that deep-links to
 * `tickets/new?customerId=<id>` (plan Design item 5).
 */
export function CustomerDetailView({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const customerQuery = useCustomerQuery(customerId);
  const ticketsQuery = useTicketsQuery({});
  const relatedTickets = (ticketsQuery.data ?? []).filter(
    (ticket) => ticket.customerId === customerId,
  );

  if (customerQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (customerQuery.isError) {
    const notFound = customerQuery.error instanceof ApiError && customerQuery.error.status === 404;
    return (
      <Alert variant="destructive">{notFound ? t("detail.notFound") : t("detail.loadError")}</Alert>
    );
  }

  const customer = customerQuery.data;
  if (!customer) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{customer.displayName}</h1>
          <Badge variant={customer.isActive ? "success" : "secondary"}>
            {customer.isActive ? t("list.active") : t("list.inactive")}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/${locale}/tickets/new?customerId=${customerId}`)}
        >
          {t("detail.newTicketButton")}
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.contactsHeading")}</h2>
        {customer.contacts.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.contactsEmpty")}</p>
        )}
        {customer.contacts.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {customer.contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex items-center justify-between border-b border-slate-100 pb-2"
              >
                <span className="font-medium text-slate-800">
                  {contact.fullName}
                  {contact.isPrimary && (
                    <Badge variant="outline" className="ms-2">
                      {t("detail.primaryContact")}
                    </Badge>
                  )}
                </span>
                <span className="text-slate-500">
                  {[contact.email, contact.phone].filter(Boolean).join(" · ") || t("detail.noContactInfo")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("detail.ticketsHeading")}</h2>
        {ticketsQuery.isLoading && (
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {ticketsQuery.isError && (
          <Alert variant="destructive" className="mt-2">
            {t("detail.ticketsError")}
          </Alert>
        )}
        {ticketsQuery.isSuccess && relatedTickets.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">{t("detail.ticketsEmpty")}</p>
        )}
        {ticketsQuery.isSuccess && relatedTickets.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {relatedTickets.map((ticket) => (
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
                <span className="font-medium text-slate-800">{ticket.subject}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{ticket.status}</Badge>
                  <Badge variant={priorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge>
                  <span className="text-slate-500">
                    {new Date(ticket.createdAt).toLocaleDateString(locale)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
