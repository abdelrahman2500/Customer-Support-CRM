"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTicketsQuery, useUsersQuery } from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import type { ListTicketsFilters, TicketListItem } from "@/lib/tickets-api";
import { deriveSlaStatus, formatRemaining } from "@/lib/sla";
import { ticketPriorityBadgeVariant, ticketStatusBadgeVariant } from "@/lib/ticket-badges";
import {
  Badge,
  Button,
  FetchingIndicator,
  Input,
  Pagination,
  QueryStateCard,
  Skeleton,
  SortIndicator,
} from "@crm/ui";
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

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const ALL_VALUE = "__all__";

/**
 * A11Y-2 — the semantic counterpart to `SortIndicator`'s visual arrow.
 * `SortIndicator`'s own doc comment notes `aria-sort` is "the caller's to
 * set" since only the caller owns the `<th>`; this is that setter, mirrored
 * in `CustomerListView` for its own two sortable columns.
 */
function sortAriaValue(
  filters: ListTicketsFilters,
  column: NonNullable<ListTicketsFilters["sortBy"]>,
): "ascending" | "descending" | "none" {
  if (filters.sortBy !== column) {
    return "none";
  }
  return filters.sortDir === "asc" ? "ascending" : "descending";
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
 *
 * Story S-8d — each row's customer name comes from the ticket payload
 * rather than a client-side id -> name map, so the list no longer depends
 * on a second, whole-table customer fetch. Rows outside that fetch's cap
 * used to fall back to a raw UUID.
 *
 * RM-10 — every `TableCell` below now carries a `label` matching its
 * column's own `TableHead` text, and the filter bar stacks one control
 * per row below `sm` — `@crm/ui`'s `Table` primitive does the rest (see
 * that file's own doc comment): no bespoke card markup lives here.
 */
export function TicketListView() {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [filters, setFilters] = useState<ListTicketsFilters>({
    sortBy: "createdAt",
    sortDir: "desc",
  });

  const ticketsQuery = useTicketsQuery(filters);
  /** Story S-7 — whoever they came from: a completed fetch, the previous
   * filters kept as placeholder data, or the last success still standing
   * behind a failed refetch. `undefined` means there is genuinely nothing
   * to show yet, which is what the state model below branches on.
   *
   * Story S-8e — the response is now a page envelope, so the rows are one
   * level in and the pager reads its position off the same object. */
  const page = ticketsQuery.data;
  const tickets = page?.items;
  const usersQuery = useUsersQuery();
  const categoriesQuery = useTicketCategoriesQuery();

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

  /** Story S-8e — a filter change resets to page 1 in the SAME state
   * update. Doing it in a follow-up effect would fire one request for
   * "page 7 of the new filter" and only then correct itself, exactly as
   * `AuditLogView` documents. */
  function updateFilter<K extends keyof ListTicketsFilters>(key: K, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value === ALL_VALUE ? undefined : (value as ListTicketsFilters[K]),
      page: undefined,
    }));
  }

  function toggleSort(field: "createdAt" | "updatedAt") {
    setFilters((current) => ({
      ...current,
      // Story S-8e — a re-sort reorders the whole result set, so page 7
      // of the old order means nothing in the new one.
      page: undefined,
      sortBy: field,
      sortDir: current.sortBy === field && current.sortDir === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>
          {/* Story S-7 — the rows below stay on screen while a filter change
              resolves, so this is the only signal that anything is in
              flight. `isPlaceholderData` rather than `isFetching`: a plain
              background revalidation of the *same* filters is not worth
              announcing, but data that is about to be replaced is. */}
          <FetchingIndicator active={ticketsQuery.isPlaceholderData} label={tCommon("updating")} />
        </div>
        <Button size="sm" asChild>
          <Link href={`/${locale}/tickets/new`}>{t("list.createButton")}</Link>
        </Button>
      </div>

      {/* RM-10 — one filter per row below `sm` (tappable full-width
          controls) instead of wrapping fixed-`min-w` selects onto
          however many lines happen to fit; unchanged, wrapped inline row
          at `sm` and up. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
            className="w-full sm:w-auto sm:min-w-[10rem]"
            defaultValue={filters.search ?? ""}
            placeholder={t("list.searchPlaceholder")}
            onBlur={(event) => updateFilter("search", event.target.value.trim() || ALL_VALUE)}
          />
        </label>
      </div>

      {/* Story S-7 — `isPending`, not `isLoading`: with placeholder data in
          play the query only reports `pending` on a genuine first load, so
          the skeleton appears once and never again for a filter change.

          The error split is the other half of the story. TanStack v5 keeps
          `data` from the last successful fetch when a refetch fails, so
          `isError` alone would throw away rows the user can still read over
          a failure that may be transient. With data present the failure goes
          to `backgroundError` (a non-destructive banner above the intact
          table); only a failure with nothing to fall back on replaces the
          screen. */}
      <QueryStateCard
        isLoading={ticketsQuery.isPending}
        isError={ticketsQuery.isError && tickets === undefined}
        isEmpty={tickets !== undefined && tickets.length === 0}
        loadingLabel={tCommon("loading")}
        loadingPlaceholder={<ListSkeleton />}
        error={{
          title: t("list.error"),
          retryLabel: t("list.retry"),
          onRetry: () => void ticketsQuery.refetch(),
        }}
        backgroundError={
          ticketsQuery.isError && tickets !== undefined
            ? {
                title: t("list.error"),
                retryLabel: t("list.retry"),
                onRetry: () => void ticketsQuery.refetch(),
              }
            : undefined
        }
        empty={{ title: t("list.empty") }}
      >
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
              <TableHead aria-sort={sortAriaValue(filters, "createdAt")}>
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
              <TableHead aria-sort={sortAriaValue(filters, "updatedAt")}>
                <button
                  type="button"
                  className="rounded-sm hover:underline focus-ring"
                  onClick={() => toggleSort("updatedAt")}
                >
                  {t("list.columns.updatedAt")}
                  <SortIndicator
                    direction={filters.sortBy === "updatedAt" ? filters.sortDir : null}
                  />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tickets ?? []).map((ticket) => (
              <TableRow
                key={ticket.id}
                className="cursor-pointer"
                onClick={() => router.push(`/${locale}/tickets/${ticket.id}`)}
              >
                <TableCell label={t("list.columns.id")} className="font-mono text-xs text-slate-500">
                  {ticket.id.slice(0, 8)}
                </TableCell>
                <TableCell label={t("list.columns.subject")} className="font-medium text-slate-900">
                  <Link
                    href={`/${locale}/tickets/${ticket.id}`}
                    className="focus-ring rounded-sm hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {ticket.subject}
                  </Link>
                </TableCell>
                <TableCell label={t("list.columns.customer")}>
                  <Link
                    href={`/${locale}/customers/${ticket.customerId}`}
                    className="focus-ring rounded-sm hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {/* Story S-8d — resolved by the API. Previously looked up
                        in a client-side map built from the whole customer
                        list, which fell back to a raw UUID for any customer
                        outside the capped window. */}
                    {ticket.customerName ?? ticket.customerId}
                  </Link>
                </TableCell>
                <TableCell label={t("list.columns.status")}>
                  <Badge variant={ticketStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                </TableCell>
                <TableCell label={t("list.columns.priority")}>
                  <Badge variant={ticketPriorityBadgeVariant(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                </TableCell>
                <TableCell label={t("list.columns.category")}>
                  {ticket.categoryName ?? t("list.noCategory")}
                </TableCell>
                <TableCell label={t("list.columns.assignedAgent")}>
                  {ticket.assignedToUserId
                    ? (userNameById.get(ticket.assignedToUserId) ?? ticket.assignedToUserId)
                    : t("list.unassigned")}
                </TableCell>
                <TableCell label={t("list.columns.sla")}>
                  <SlaCell ticket={ticket} />
                </TableCell>
                <TableCell label={t("list.columns.createdAt")} className="text-slate-500">
                  {new Date(ticket.createdAt).toLocaleString(locale)}
                </TableCell>
                <TableCell label={t("list.columns.updatedAt")} className="text-slate-500">
                  {new Date(ticket.updatedAt).toLocaleString(locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </QueryStateCard>

      {/* Story S-8e — renders nothing while there is only one page (see
          `Pagination`), so a small branch's list looks exactly as it did
          before. Disabled while the previous page is still on screen, so a
          rapid double-click cannot queue a second jump. */}
      {page !== undefined && (
        <Pagination
          page={page.page}
          totalPages={page.totalPages}
          onPageChange={(next) => setFilters((current) => ({ ...current, page: next }))}
          disabled={ticketsQuery.isPlaceholderData}
          label={tCommon("pagination.label")}
          previousLabel={tCommon("pagination.previous")}
          nextLabel={tCommon("pagination.next")}
          indicator={tCommon("pagination.indicator", {
            page: page.page,
            totalPages: page.totalPages,
          })}
        />
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
        <SelectTrigger className="w-full sm:w-auto sm:min-w-[10rem]" aria-label={label}>
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
