"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCustomersQuery } from "@/hooks/use-tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Story 26 — Customer List. Mirrors `TicketListView`'s structure exactly,
 * minus filters/sort (plan Design item 4 — no search/pagination, matching
 * the Ticket List's own existing, accepted limitation; `CustomersController`
 * has no query parameters of any kind). Reuses the same `useCustomersQuery()`
 * cache Story 25's ticket-creation picker and every other workspace screen
 * already share — no new request shape.
 */
export function CustomerListView() {
  const t = useTranslations("customers");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const customersQuery = useCustomersQuery();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>
        <Button size="sm" onClick={() => router.push(`/${locale}/customers/new`)}>
          {t("list.createButton")}
        </Button>
      </div>

      {customersQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {customersQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("list.error")}</span>
          <Button variant="outline" size="sm" onClick={() => customersQuery.refetch()}>
            {t("list.retry")}
          </Button>
        </Alert>
      )}

      {customersQuery.isSuccess && customersQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t("list.empty")}
        </p>
      )}

      {customersQuery.isSuccess && customersQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.columns.name")}</TableHead>
              <TableHead>{t("list.columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customersQuery.data.map((customer) => (
              <TableRow
                key={customer.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => router.push(`/${locale}/customers/${customer.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    router.push(`/${locale}/customers/${customer.id}`);
                  }
                }}
              >
                <TableCell className="font-medium text-slate-900">{customer.displayName}</TableCell>
                <TableCell>
                  <Badge variant={customer.isActive ? "success" : "secondary"}>
                    {customer.isActive ? t("list.active") : t("list.inactive")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
