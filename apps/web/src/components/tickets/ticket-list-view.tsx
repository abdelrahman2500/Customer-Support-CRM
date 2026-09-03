"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCustomersQuery, useTicketsQuery, useUsersQuery } from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import type { ListTicketsFilters, TicketListItem } from "@/lib/tickets-api";
import { deriveSlaStatus, formatRemaining } from "@/lib/sla";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const ALL_VALUE = "__all__";

function priorityBadgeVariant(priority: string) {
  if (priority === "URGENT") return "destructive" as const;
  if (priority === "HIGH") return "warning" as const;
  return "secondary" as const;
}

/**
 * Story 98 — Design System & Visual Polish. Recon found ticket status
 * rendered as the same neutral `outline` Badge everywhere, carrying no
 * visual urgency signal at all (unlike priority, already color-coded via
 * `priorityBadgeVariant` above). Duplicated per-file rather than shared,
 * mirroring that exact same existing precedent/convention.
 */
function statusBadgeVariant(status: string) {
  if (status === "OPEN") return "warning" as const;
  if (status === "RESOLVED") return "success" as const;
  if (status === "CLOSED") return "outline" as const;
  return "secondary" as const; // IN_PROGRESS
}

function SlaCell({ ticket }: { ticket: TicketListItem }) {
  const t = useTranslations("tickets");
  const status = deriveSlaStatus(ticket.slaTarget);
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
 * Story 23 — the Ticket List (plan Task 7). Consumes `GET /tickets`
 * (filter/sort query params, Task 2) plus `GET /customers`/`GET
 * /identity/users` for client-side display-name resolution (Design item 9)
 * — no new backend "expand" parameter. No pagination (still no precedent
 * anywhere in this codebase). Does not join any realtime room — only
 * Ticket Detail does (Design item 8).
 *
 * Story 70 — a `search` filter, blur-commit like the existing `category`
 * filter Input, appended to the same filter bar (matches `subject`/
 * `category`, case-insensitive — mirrors `ArticleListView`'s own search
 * input, added for Knowledge Base in Story 64).
 */
export function TicketListView() {
  const t = useTranslations("tickets");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [filters, setFilters] = useState<ListTicketsFilters>({
    sortBy: "createdAt",
    sortDir: "asc",
  });

  const ticketsQuery = useTicketsQuery(filters);
  const customersQuery = useCustomersQuery();
  const usersQuery = useUsersQuery();
  const categoriesQuery = useTicketCategoriesQuery();

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const customer of customersQuery.data ?? []) {
      map.set(customer.id, customer.displayName);
    }
    return map;
  }, [customersQuery.data]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user.fullName);
    }
    return map;
  }, [usersQuery.data]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categoriesQuery.data]);

  function updateFilter<K extends keyof ListTicketsFilters>(key: K, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value === ALL_VALUE ? undefined : (value as ListTicketsFilters[K]),
    }));
  }

  function toggleSort(field: "createdAt" | "updatedAt") {
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
        <Button size="sm" onClick={() => router.push(`/${locale}/tickets/new`)}>
          {t("list.createButton")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label={t("list.filterStatus")}
          value={filters.status ?? ALL_VALUE}
          onChange={(value) => updateFilter("status", value)}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          label={t("list.filterPriority")}
          value={filters.priority ?? ALL_VALUE}
          onChange={(value) => updateFilter("priority", value)}
          options={PRIORITY_OPTIONS}
        />
        <FilterSelect
          label={t("list.filterCategory")}
          value={filters.categoryId ?? ALL_VALUE}
          onChange={(value) => updateFilter("categoryId", value)}
          options={(categoriesQuery.data ?? []).map((category) => category.id)}
          renderLabel={(id) => categoryNameById.get(id) ?? id}
        />
        <FilterSelect
          label={t("list.filterAssignedAgent")}
          value={filters.assignedToUserId ?? ALL_VALUE}
          onChange={(value) => updateFilter("assignedToUserId", value)}
          options={(usersQuery.data ?? []).map((user) => user.id)}
          renderLabel={(id) => userNameById.get(id) ?? id}
        />
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("list.searchLabel")}
          <Input
            className="min-w-[10rem]"
            defaultValue={filters.search ?? ""}
            placeholder={t("list.searchPlaceholder")}
            onBlur={(event) => updateFilter("search", event.target.value.trim() || ALL_VALUE)}
          />
        </label>
      </div>

      {ticketsQuery.isLoading && <ListSkeleton />}

      {ticketsQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("list.error")}</span>
          <Button variant="outline" size="sm" onClick={() => ticketsQuery.refetch()}>
            {t("list.retry")}
          </Button>
        </Alert>
      )}

      {ticketsQuery.isSuccess && ticketsQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t("list.empty")}
        </p>
      )}

      {ticketsQuery.isSuccess && ticketsQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.columns.id")}</TableHead>
              <TableHead>{t("list.columns.subject")}</TableHead>
              <TableHead>{t("list.columns.customer")}</TableHead>
              <TableHead>{t("list.columns.status")}</TableHead>
              <TableHead>{t("list.columns.priority")}</TableHead>
              <TableHead>{t("list.columns.category")}</TableHead>
              <TableHead>{t("list.columns.assignedAgent")}</TableHead>
              <TableHead>{t("list.columns.sla")}</TableHead>
              <TableHead>
                <button
                  type="button"
                  className="rounded-sm hover:underline focus-ring"
                  onClick={() => toggleSort("createdAt")}
                >
                  {t("list.columns.createdAt")}
                  {filters.sortBy === "createdAt" ? (filters.sortDir === "asc" ? " ▲" : " ▼") : ""}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="rounded-sm hover:underline focus-ring"
                  onClick={() => toggleSort("updatedAt")}
                >
                  {t("list.columns.updatedAt")}
                  {filters.sortBy === "updatedAt" ? (filters.sortDir === "asc" ? " ▲" : " ▼") : ""}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ticketsQuery.data.map((ticket) => (
              <TableRow
                key={ticket.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    router.push(`/${locale}/tickets/${ticket.id}`);
                  }
                }}
              >
                <TableCell className="font-mono text-xs text-slate-500">
                  {ticket.id.slice(0, 8)}
                </TableCell>
                <TableCell className="font-medium text-slate-900">{ticket.subject}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="rounded-sm hover:underline focus-ring"
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(`/${locale}/customers/${ticket.customerId}`);
                    }}
                  >
                    {customerNameById.get(ticket.customerId) ?? ticket.customerId}
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={priorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge>
                </TableCell>
                <TableCell>{ticket.categoryName ?? t("list.noCategory")}</TableCell>
                <TableCell>
                  {ticket.assignedToUserId
                    ? (userNameById.get(ticket.assignedToUserId) ?? ticket.assignedToUserId)
                    : t("list.unassigned")}
                </TableCell>
                <TableCell>
                  <SlaCell ticket={ticket} />
                </TableCell>
                <TableCell className="text-slate-500">
                  {new Date(ticket.createdAt).toLocaleString(locale)}
                </TableCell>
                <TableCell className="text-slate-500">
                  {new Date(ticket.updatedAt).toLocaleString(locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  renderLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  renderLabel?: (value: string) => string;
}) {
  const t = useTranslations("tickets");
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-w-[10rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t("list.filterAll")}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {renderLabel ? renderLabel(option) : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} className="h-10 w-full" />
      ))}
    </div>
  );
}
