"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCustomersQuery } from "@/hooks/use-tickets";
import type { ListCustomersFilters } from "@/lib/tickets-api";
import { Alert, Badge, Button, Input, Skeleton, SortIndicator } from "@crm/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm/ui";

const ALL_VALUE = "__all__";

/**
 * Story 26 — Customer List. Mirrors `TicketListView`'s structure exactly.
 *
 * Story 101 — the filter bar (search + isActive) and sortable
 * name/created-at column headers mirror `TicketListView`'s own exact
 * shapes (`FilterSelect`/blur-commit search `Input`/`toggleSort`),
 * closing the gap this component's own doc comment used to disclose ("no
 * search/pagination ... `CustomersController` has no query parameters of
 * any kind"). `useCustomersQuery(filters)` gains an optional `filters`
 * param — every other existing caller (the ticket-creation picker,
 * `TicketListView`'s own customer-name lookup) keeps calling it with no
 * arguments, reproducing today's exact all-customers request.
 */
export function CustomerListView() {
  const t = useTranslations("customers");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [filters, setFilters] = useState<ListCustomersFilters>({
    sortBy: "createdAt",
    sortDir: "asc",
  });

  const customersQuery = useCustomersQuery(filters);

  function updateFilter<K extends keyof ListCustomersFilters>(key: K, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value === ALL_VALUE ? undefined : (value as ListCustomersFilters[K]),
    }));
  }

  function toggleSort(field: "displayName" | "createdAt") {
    setFilters((current) => ({
      ...current,
      sortBy: field,
      sortDir: current.sortBy === field && current.sortDir === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>
        <Button size="sm" asChild>
          <Link href={`/${locale}/customers/new`}>{t("list.createButton")}</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("list.searchLabel")}
          <Input
            className="min-w-[10rem]"
            defaultValue={filters.search ?? ""}
            placeholder={t("list.searchPlaceholder")}
            onBlur={(event) => updateFilter("search", event.target.value.trim() || ALL_VALUE)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("list.filterStatus")}
          <Select
            value={filters.isActive ?? ALL_VALUE}
            onValueChange={(value) => updateFilter("isActive", value)}
          >
            <SelectTrigger className="min-w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t("list.filterAll")}</SelectItem>
              <SelectItem value="true">{t("list.active")}</SelectItem>
              <SelectItem value="false">{t("list.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </label>
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
        <p className="rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
          {t("list.empty")}
        </p>
      )}

      {customersQuery.isSuccess && customersQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  className="rounded-sm hover:underline focus-ring"
                  onClick={() => toggleSort("displayName")}
                >
                  {t("list.columns.name")}
                  <SortIndicator
                    direction={filters.sortBy === "displayName" ? filters.sortDir : null}
                  />
                </button>
              </TableHead>
              <TableHead>{t("list.columns.status")}</TableHead>
              <TableHead>
                <button
                  type="button"
                  className="rounded-sm hover:underline focus-ring"
                  onClick={() => toggleSort("createdAt")}
                >
                  {t("list.columns.createdAt")}
                  <SortIndicator
                    direction={filters.sortBy === "createdAt" ? filters.sortDir : null}
                  />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customersQuery.data.map((customer) => (
              <TableRow
                key={customer.id}
                className="cursor-pointer"
                onClick={() => router.push(`/${locale}/customers/${customer.id}`)}
              >
                <TableCell className="font-medium text-slate-900">
                  <Link
                    href={`/${locale}/customers/${customer.id}`}
                    className="focus-ring rounded-sm hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {customer.displayName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={customer.isActive ? "success" : "secondary"}>
                    {customer.isActive ? t("list.active") : t("list.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-500">
                  {new Date(customer.createdAt).toLocaleString(locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
