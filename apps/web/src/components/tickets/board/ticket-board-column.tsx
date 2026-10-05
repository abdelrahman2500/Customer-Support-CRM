"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ticketStatusPresentation } from "@crm/shared";
import { BoardColumn, Button, ErrorState, LoadingStatus, Skeleton, recipes } from "@crm/ui";
import type { TicketListItem, TicketStatus } from "@/lib/tickets-api";
import { useTicketLabels } from "@/hooks/use-ticket-labels";
import { useTicketBoardColumnQuery } from "@/hooks/use-ticket-board";
import { TICKET_ICON } from "@/components/tickets/ticket-badges";
import { isAtRiskTicket, statusSpine, type BoardFilters } from "./board-state";

/** What a column reports up to the board (for the summary and switcher). */
export interface ColumnReport {
  status: TicketStatus;
  total: number | undefined;
  /** Cards actually shown (after the client-side "at risk" scope). */
  shown: number;
}

/**
 * Story 216 (PR-3.1, tickets-kanban-ux.md §3, §8) — one status column: its
 * own query, spine, header and count (the API total, which respects every
 * filter and visibility rule), card-shaped skeletons, a column-scoped error
 * with retry, a status-specific empty state, and "Show N more" (25 at a
 * time — no infinite scroll, so focus order stays predictable). The
 * collapsed rail (Closed, by default) is the same column folded.
 */
export function TicketBoardColumn({
  status,
  filters,
  collapsed,
  onToggleCollapsed,
  renderCard,
  onReport,
  hiddenBelowMd,
  fullWidth = false,
}: {
  status: TicketStatus;
  filters: BoardFilters;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  renderCard: (ticket: TicketListItem) => ReactNode;
  onReport: (report: ColumnReport) => void;
  /** Below md only one column shows (the switcher's choice). */
  hiddenBelowMd: boolean;
  /** Single-column (phone) layout: the column takes the full width. */
  fullWidth?: boolean;
}) {
  const t = useTranslations("tickets.board");
  const tCommon = useTranslations("common");
  const labels = useTicketLabels();
  const query = useTicketBoardColumnQuery(status, filters);
  const spine = statusSpine(status);
  const Icon = TICKET_ICON[ticketStatusPresentation(status).icon];
  const statusLabel = labels.status(status);

  const loaded = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const tickets = useMemo(
    () => (filters.risk ? loaded.filter((ticket) => isAtRiskTicket(ticket)) : loaded),
    [filters.risk, loaded],
  );
  const total = query.data?.pages[0]?.total;
  const count = filters.risk ? tickets.length : total;
  useEffect(() => {
    onReport({ status, total: count, shown: tickets.length });
  }, [onReport, status, count, tickets.length]);

  const remaining = total === undefined ? 0 : total - loaded.length;
  const visibility = `${hiddenBelowMd ? "hidden md:flex" : "flex"}${fullWidth ? " w-full" : ""}`;
  const icon = <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-subtle" />;

  if (collapsed) {
    return (
      <BoardColumn
        title={statusLabel}
        count={count}
        spine={spine}
        icon={icon}
        collapsed
        onExpand={onToggleCollapsed}
        expandLabel={t("expandColumn", { status: statusLabel, count: count ?? 0 })}
        aria-label={t("columnLabel", { status: statusLabel, count: count ?? 0 })}
        className={visibility}
      />
    );
  }

  return (
    <BoardColumn
      title={statusLabel}
      count={count}
      spine={spine}
      icon={icon}
      aria-label={t("columnLabel", { status: statusLabel, count: count ?? 0 })}
      className={visibility}
      actions={
        onToggleCollapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-caption"
            onClick={onToggleCollapsed}
          >
            {t("collapseColumn")}
          </Button>
        ) : undefined
      }
      bodyProps={{ "aria-label": t("columnCards", { status: statusLabel }) } as never}
      footer={
        remaining > 0 && !filters.risk ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            isLoading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {t("showMore", { count: Math.min(remaining, 25) })}
          </Button>
        ) : undefined
      }
    >
      {query.isPending ? (
        <LoadingStatus label={tCommon("loading")} asChild>
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className={`${recipes.card} flex flex-col gap-2 p-3`}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </LoadingStatus>
      ) : query.isError && loaded.length === 0 ? (
        <ErrorState
          headingLevel={3}
          tone="neutral"
          title={t("columnError", { status: statusLabel })}
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              {t("retry")}
            </Button>
          }
          className="py-6"
        />
      ) : tickets.length === 0 ? (
        <p className="rounded-inner px-3 py-6 text-center text-caption text-ink-subtle">
          {filters.risk ? t("emptyAtRisk") : t(`empty.${status}`)}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>{renderCard(ticket)}</li>
          ))}
        </ol>
      )}
    </BoardColumn>
  );
}
