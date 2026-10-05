"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Board,
  Button,
  EmptyState,
  FetchingIndicator,
  FilterSelect,
  ListToolbar,
  PageHeader,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TicketsIcon,
} from "@crm/ui";
import { useIsFetching } from "@tanstack/react-query";
import { useCurrentUserQuery, useUsersQuery } from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import { useTicketLabels } from "@/hooks/use-ticket-labels";
import { useUrlFilters } from "@/lib/url-filters";
import { localeDirection } from "@/i18n/direction";
import type { TicketListItem, TicketStatus } from "@/lib/tickets-api";
import {
  BOARD_SORTS,
  BOARD_STATUSES,
  CLOSED_COLLAPSED_STORAGE_KEY,
  QUICK_VIEWS,
  activeFilterCount,
  parseBoardFilters,
  quickViewOf,
  readStorage,
  serializeBoardFilters,
  statusSpine,
  withQuickView,
  writeStorage,
  type BoardFilters,
  type BoardSort,
  type QuickView,
} from "./board-state";
import { TicketBoardColumn, type ColumnReport } from "./ticket-board-column";
import { TicketCard } from "./ticket-card";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const ALL = "__all__";

/** Below `md` the board shows one column at a time (tickets-kanban-ux.md §7). */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}

/**
 * Story 216 (PR-3.1, tickets-kanban-ux.md) — the Tickets board, the default
 * view of `/tickets` (decision PD-3): four status columns of cards under one
 * toolbar (search, quick views, filters, sort, summary), the Closed column
 * folded by default, and a column switcher below `md`. Read-only in this
 * Story; moving cards is PR-3.2.
 *
 * Every filter lives in the URL (`useUrlFilters`), with the list view's
 * parameter names, so a filtered board is shareable and survives reloads.
 * The search keeps the list's placeholder and on-blur/Enter commit.
 */
export function TicketBoardView({
  viewSwitcher,
  renderCardActions,
}: {
  viewSwitcher?: ReactNode;
  /** PR-3.2 — the card's menu and drag handle. */
  renderCardActions?: (ticket: TicketListItem) => ReactNode;
}) {
  const t = useTranslations("tickets.board");
  const tList = useTranslations("tickets.list");
  const tCommon = useTranslations("common");
  const labels = useTicketLabels();
  const { locale } = useParams<{ locale: string }>();
  const dir = localeDirection(locale);
  const desktop = useIsDesktop();

  const [filters, setFilters] = useUrlFilters(parseBoardFilters, serializeBoardFilters);
  const currentUserQuery = useCurrentUserQuery();
  const usersQuery = useUsersQuery();
  const categoriesQuery = useTicketCategoriesQuery();
  const fetching = useIsFetching({ queryKey: ["tickets", "board"] }) > 0;
  const currentUserId = currentUserQuery.data?.id;

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) map.set(user.id, user.fullName);
    return map;
  }, [usersQuery.data]);
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) map.set(category.id, category.name);
    return map;
  }, [categoriesQuery.data]);

  // The Closed column starts folded; the choice is remembered per browser.
  const [closedCollapsed, setClosedCollapsed] = useState(true);
  useEffect(() => {
    setClosedCollapsed(readStorage(CLOSED_COLLAPSED_STORAGE_KEY) !== "false");
  }, []);
  function toggleClosed() {
    setClosedCollapsed((value) => {
      writeStorage(CLOSED_COLLAPSED_STORAGE_KEY, String(!value));
      return !value;
    });
  }

  const [mobileStatus, setMobileStatus] = useState<TicketStatus>("OPEN");
  const [reports, setReports] = useState<Partial<Record<TicketStatus, ColumnReport>>>({});
  const onReport = useCallback((report: ColumnReport) => {
    setReports((current) => {
      const previous = current[report.status];
      if (previous && previous.total === report.total && previous.shown === report.shown) {
        return current;
      }
      return { ...current, [report.status]: report };
    });
  }, []);

  const totals = BOARD_STATUSES.map((status) => reports[status]?.total);
  const known = totals.every((total) => total !== undefined);
  const grandTotal = known
    ? totals.reduce<number>((sum, total) => sum + (total ?? 0), 0)
    : undefined;
  const filterCount = activeFilterCount(filters);
  const quickView = quickViewOf(filters, currentUserId);

  function update(next: Partial<BoardFilters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  const renderCard = (ticket: TicketListItem) => (
    <TicketCard
      ticket={ticket}
      locale={locale}
      assigneeName={
        ticket.assignedToUserId
          ? (userNameById.get(ticket.assignedToUserId) ?? t("unknownAgent"))
          : null
      }
      actions={renderCardActions?.(ticket)}
    />
  );

  const filtersNode = (
    <>
      <FilterSelect
        allValue={ALL}
        allLabel={tList("filterAll")}
        label={tList("filterPriority")}
        value={filters.priority ?? ALL}
        onChange={(value) =>
          update({ priority: value === ALL ? undefined : (value as BoardFilters["priority"]) })
        }
        options={PRIORITIES}
        renderLabel={labels.priority}
      />
      <FilterSelect
        allValue={ALL}
        allLabel={tList("filterAll")}
        label={tList("filterAssignedAgent")}
        value={filters.assignedToUserId ?? ALL}
        onChange={(value) =>
          update({ assignedToUserId: value === ALL ? undefined : value, unassigned: undefined })
        }
        options={(usersQuery.data ?? []).map((user) => user.id)}
        renderLabel={(id) => userNameById.get(id) ?? id}
      />
      <FilterSelect
        allValue={ALL}
        allLabel={tList("filterAll")}
        label={tList("filterCategory")}
        value={filters.categoryId ?? ALL}
        onChange={(value) => update({ categoryId: value === ALL ? undefined : value })}
        options={(categoriesQuery.data ?? []).map((category) => category.id)}
        renderLabel={(id) => categoryNameById.get(id) ?? id}
      />
      {/* The same control as the filters beside it (FilterSelect's markup),
          without an "All" option: a sort always has a value. */}
      <label className="flex flex-col gap-tight text-xs text-ink-muted">
        {t("sortLabel")}
        <Select
          value={filters.sort}
          onValueChange={(value) => update({ sort: value as BoardSort })}
        >
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[10rem]" aria-label={t("sortLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOARD_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {t(`sort.${sort}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </>
  );

  const everythingEmpty = known && grandTotal === 0;

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title={tList("title")}
        actions={
          <>
            <FetchingIndicator active={fetching} label={tCommon("updating")} />
            {viewSwitcher}
          </>
        }
      />

      <ListToolbar
        search={{
          value: filters.search ?? "",
          onCommit: (value) => update({ search: value.trim() || undefined }),
          label: tList("searchLabel"),
          placeholder: tList("searchPlaceholder"),
          clearLabel: t("clearSearch"),
        }}
        filters={filtersNode}
        filterCount={filterCount}
        filtersLabel={t("filters")}
        closeLabel={t("closeFilters")}
        summary={
          grandTotal !== undefined
            ? filters.risk
              ? t("summaryAtRisk", { count: grandTotal })
              : t("summary", { count: grandTotal })
            : undefined
        }
        onClearAll={() => setFilters({ sort: filters.sort })}
        clearAllLabel={t("clearAll")}
      >
        <SegmentedControl
          aria-label={t("quickViewLabel")}
          dir={dir}
          size="sm"
          options={QUICK_VIEWS.filter((view) => view !== "mine" || currentUserId).map((view) => ({
            value: view,
            label: t(`quick.${view}`),
          }))}
          value={quickView}
          onValueChange={(value) =>
            setFilters((current) => withQuickView(current, value as QuickView, currentUserId))
          }
        />
      </ListToolbar>

      {everythingEmpty && filterCount > 0 ? (
        <EmptyState
          icon={<TicketsIcon className="h-5 w-5" />}
          title={t("filteredEmpty")}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilters({ sort: filters.sort })}
            >
              {t("clearAll")}
            </Button>
          }
        />
      ) : (
        <>
          {!desktop && (
            <SegmentedControl
              aria-label={t("columnSwitcher")}
              dir={dir}
              size="sm"
              fill
              className="sticky top-0 z-10"
              options={BOARD_STATUSES.map((status) => ({
                value: status,
                label: labels.status(status),
                count: reports[status]?.total,
                dot: statusSpine(status).dot,
              }))}
              value={mobileStatus}
              onValueChange={(value) => setMobileStatus(value as TicketStatus)}
            />
          )}
          <Board
            aria-label={t("boardLabel")}
            className="md:h-[calc(100dvh-17rem)] md:min-h-[28rem]"
          >
            {BOARD_STATUSES.map((status) => (
              <TicketBoardColumn
                key={status}
                status={status}
                filters={filters}
                collapsed={desktop && status === "CLOSED" && closedCollapsed}
                onToggleCollapsed={status === "CLOSED" && desktop ? toggleClosed : undefined}
                renderCard={renderCard}
                onReport={onReport}
                hiddenBelowMd={!desktop && status !== mobileStatus}
                fullWidth={!desktop}
              />
            ))}
          </Board>
        </>
      )}
    </section>
  );
}
