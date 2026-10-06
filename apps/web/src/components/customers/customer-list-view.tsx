"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useCustomersQuery } from "@/hooks/use-tickets";
import type { ListCustomersFilters } from "@/lib/tickets-api";
import { useUrlFilters } from "@/lib/url-filters";
import {
  Avatar,
  Badge,
  Button,
  FetchingIndicator,
  FilterSelect,
  ListToolbar,
  PageHeader,
  Pagination,
  QueryStateCard,
  Skeleton,
  TableSortHead,
} from "@crm/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@crm/ui";
import { formatDateTime } from "@crm/ui";

const ALL_VALUE = "__all__";

/** Batch 4 (UX audit) — the URL <-> `ListCustomersFilters` mapping for this
 * view's own `useUrlFilters`, mirroring `ticket-list-view.tsx`'s identical
 * pair exactly (see that file for the "why skip the default sort" note). */
function parseCustomerFilters(params: URLSearchParams): ListCustomersFilters {
  const page = params.get("page");
  return {
    sortBy: (params.get("sortBy") as ListCustomersFilters["sortBy"]) ?? "createdAt",
    sortDir: (params.get("sortDir") as ListCustomersFilters["sortDir"]) ?? "asc",
    ...(params.get("search") ? { search: params.get("search")! } : {}),
    ...(params.get("isActive")
      ? { isActive: params.get("isActive") as ListCustomersFilters["isActive"] }
      : {}),
    ...(page ? { page: Number(page) } : {}),
  };
}

function serializeCustomerFilters(filters: ListCustomersFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.isActive) params.set("isActive", filters.isActive);
  if (filters.sortBy && filters.sortBy !== "createdAt") params.set("sortBy", filters.sortBy);
  if (filters.sortDir && filters.sortDir !== "asc") params.set("sortDir", filters.sortDir);
  if (filters.page) params.set("page", String(filters.page));
  return params;
}

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
 *
 * RM-10 — every `TableCell` below now carries a `label` matching its
 * column's own `TableHead` text, and the filter bar stacks one control
 * per row below `sm`, mirroring `TicketListView`'s own identical change.
 *
 * Batch 4 (UX audit) — filters/search/sort/page now live in the URL via
 * `useUrlFilters`, mirroring `TicketListView`'s identical change (see that
 * file's own doc comment for the full rationale, including why this is now
 * a thin `Suspense` wrapper around `CustomerListViewContent`).
 */
export function CustomerListView() {
  return (
    <Suspense fallback={null}>
      <CustomerListViewContent />
    </Suspense>
  );
}

function CustomerListViewContent() {
  const t = useTranslations("customers");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [filters, setFilters] = useUrlFilters(parseCustomerFilters, serializeCustomerFilters);

  const customersQuery = useCustomersQuery(filters);
  /** Story S-7 — see `TicketListView`: the rows to render regardless of
   * which fetch they came from, `undefined` only when there is genuinely
   * nothing yet.
   *
   * Story S-8e — a page envelope now, so the rows are one level in. */
  const page = customersQuery.data;
  const customers = page?.items;

  /** Story S-8e — a filter change resets to page 1 in the SAME state
   * update; see `TicketListView` / `AuditLogView` for why not an effect. */
  function updateFilter<K extends keyof ListCustomersFilters>(key: K, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value === ALL_VALUE ? undefined : (value as ListCustomersFilters[K]),
      page: undefined,
    }));
  }

  function toggleSort(field: "displayName" | "createdAt") {
    setFilters((current) => ({
      ...current,
      // Story S-8e — a re-sort reorders the whole result set.
      page: undefined,
      sortBy: field,
      sortDir: current.sortBy === field && current.sortDir === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title={t("list.title")}
        actions={
          <>
            <FetchingIndicator
              active={customersQuery.isPlaceholderData}
              label={tCommon("updating")}
            />
            <Button size="sm" asChild>
              <Link href={`/${locale}/customers/new`}>{t("list.createButton")}</Link>
            </Button>
          </>
        }
      />

      {/* Story 222 (PR-4.1, RD-4.4) — the shared list toolbar: search (same
          blur/Enter commit), the status filter as a FilterSelect (a "Filters"
          sheet on phones), a polite result count and clear-all. Same URL
          parameters and the same request as before. */}
      <ListToolbar
        search={{
          value: filters.search ?? "",
          onCommit: (value) => updateFilter("search", value.trim() || ALL_VALUE),
          label: t("list.searchLabel"),
          placeholder: t("list.searchPlaceholder"),
          clearLabel: t("list.clearSearch"),
        }}
        filters={
          <FilterSelect
            label={t("list.filterStatus")}
            allValue={ALL_VALUE}
            allLabel={t("list.filterAll")}
            value={filters.isActive ?? ALL_VALUE}
            onChange={(value) => updateFilter("isActive", value)}
            options={["true", "false"]}
            renderLabel={(value) => (value === "true" ? t("list.active") : t("list.inactive"))}
          />
        }
        filterCount={[filters.search, filters.isActive].filter(Boolean).length}
        filtersLabel={t("list.filters")}
        closeLabel={t("list.closeFilters")}
        summary={page ? t("list.summary", { count: page.total }) : undefined}
        onClearAll={() =>
          setFilters((current) => ({ sortBy: current.sortBy, sortDir: current.sortDir }))
        }
        clearAllLabel={t("list.clearAll")}
      />

      {/* Story S-7 — see `TicketListView` for why the error is split in
          two and why this branches on `isPending` rather than
          `isLoading`. */}
      <QueryStateCard
        isLoading={customersQuery.isPending}
        isError={customersQuery.isError && customers === undefined}
        isEmpty={customers !== undefined && customers.length === 0}
        loadingLabel={tCommon("loading")}
        loadingPlaceholder={
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        }
        error={{
          title: t("list.error"),
          retryLabel: t("list.retry"),
          onRetry: () => void customersQuery.refetch(),
        }}
        backgroundError={
          customersQuery.isError && customers !== undefined
            ? {
                title: t("list.error"),
                retryLabel: t("list.retry"),
                onRetry: () => void customersQuery.refetch(),
              }
            : undefined
        }
        empty={{ title: t("list.empty") }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableSortHead
                direction={filters.sortBy === "displayName" ? filters.sortDir : null}
                onSort={() => toggleSort("displayName")}
              >
                {t("list.columns.name")}
              </TableSortHead>
              <TableHead>{t("list.columns.status")}</TableHead>
              <TableSortHead
                direction={filters.sortBy === "createdAt" ? filters.sortDir : null}
                onSort={() => toggleSort("createdAt")}
              >
                {t("list.columns.createdAt")}
              </TableSortHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(customers ?? []).map((customer) => (
              <TableRow
                key={customer.id}
                className="cursor-pointer"
                onClick={() => router.push(`/${locale}/customers/${customer.id}`)}
              >
                <TableCell label={t("list.columns.name")} className="font-medium text-ink">
                  {/* Story 222 — an avatar beside the name (decorative: the
                      name itself is the link's text). */}
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={customer.displayName} size="sm" decorative />
                    <Link
                      href={`/${locale}/customers/${customer.id}`}
                      className="focus-ring min-w-0 break-words rounded-sm hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <bdi>{customer.displayName}</bdi>
                    </Link>
                  </span>
                </TableCell>
                <TableCell label={t("list.columns.status")}>
                  <Badge variant={customer.isActive ? "success" : "secondary"}>
                    {customer.isActive ? t("list.active") : t("list.inactive")}
                  </Badge>
                </TableCell>
                <TableCell label={t("list.columns.createdAt")} className="text-ink-subtle">
                  {formatDateTime(customer.createdAt, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </QueryStateCard>

      {/* Story S-8e — renders nothing while there is only one page (see
          `Pagination`). Disabled while the previous page is still on
          screen, so a rapid double-click cannot queue a second jump. */}
      {page !== undefined && (
        <Pagination
          page={page.page}
          totalPages={page.totalPages}
          onPageChange={(next) => setFilters((current) => ({ ...current, page: next }))}
          disabled={customersQuery.isPlaceholderData}
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
