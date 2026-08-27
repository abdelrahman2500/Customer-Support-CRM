"use client";

import { useTranslations } from "next-intl";
import { useCustomerQuery } from "@/hooks/use-tickets";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Story 26 — Customer Detail. Mirrors `TicketDetailView`'s structure: a
 * loading/error/content shape, the same 404-vs-generic error distinction,
 * and a bordered card per section. Read-only (plan Design item 7 — no
 * `PATCH /customers/:id` usage, no contact CRUD). Contacts render straight
 * from the customer-detail response's already-embedded `contacts` array
 * (Design item 1) — no second request.
 */
export function CustomerDetailView({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const customerQuery = useCustomerQuery(customerId);

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
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900">{customer.displayName}</h1>
        <Badge variant={customer.isActive ? "success" : "secondary"}>
          {customer.isActive ? t("list.active") : t("list.inactive")}
        </Badge>
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
    </section>
  );
}
