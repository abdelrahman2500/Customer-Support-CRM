"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ChevronLeftIcon, ChevronRightIcon } from "@crm/ui";
import type { ListTicketsFilters, TicketListItem, TicketStatus } from "@/lib/tickets-api";
import { useTicketsQuery } from "@/hooks/use-tickets";
import { useTicketBoardColumnQuery } from "@/hooks/use-ticket-board";
import { isAtRiskTicket, parseBoardFilters } from "@/components/tickets/board/board-state";

/**
 * Story 220 (PR-3.5, RD-3.14 minus shortcuts) — previous/next ticket, in the
 * order the agent came from. The board and the list put their own context on
 * every ticket link (`?from=board|list` plus their filters, the same names
 * as their URLs); the ticket page rebuilds that exact query — already cached,
 * so it costs nothing — and finds its neighbours there. Without a context
 * (a shared link, a notification) there is simply no prev/next.
 */
export type TicketContextFrom = "board" | "list";

const FROM = "from";

/** A ticket link that remembers where it was opened from. */
export function ticketHref(
  locale: string,
  ticketId: string,
  context?: { from: TicketContextFrom; query: URLSearchParams },
): string {
  const base = `/${locale}/tickets/${ticketId}`;
  if (!context) return base;
  const params = new URLSearchParams([[FROM, context.from]]);
  for (const [key, value] of context.query) if (key !== "view") params.append(key, value);
  return `${base}?${params.toString()}`;
}

/** The context a ticket page was opened with, if any. */
export function ticketContextOf(
  params: URLSearchParams,
): { from: TicketContextFrom; query: URLSearchParams } | null {
  const from = params.get(FROM);
  if (from !== "board" && from !== "list") return null;
  const query = new URLSearchParams(params);
  query.delete(FROM);
  return { from, query };
}

/** "Back to tickets" returns to the same view and filters it was opened from. */
export function ticketsBackHref(locale: string, params: URLSearchParams): string {
  const context = ticketContextOf(params);
  if (!context) return `/${locale}/tickets`;
  const back = new URLSearchParams([["view", context.from]]);
  for (const [key, value] of context.query) back.append(key, value);
  return `/${locale}/tickets?${back.toString()}`;
}

/** Story 220 — the list's own URL parsing, shared so both read the same names. */
export function parseListFilters(params: URLSearchParams): ListTicketsFilters {
  const page = params.get("page");
  return {
    sortBy: (params.get("sortBy") as ListTicketsFilters["sortBy"]) ?? "createdAt",
    sortDir: (params.get("sortDir") as ListTicketsFilters["sortDir"]) ?? "desc",
    ...(params.get("status")
      ? { status: params.get("status") as ListTicketsFilters["status"] }
      : {}),
    ...(params.get("priority")
      ? { priority: params.get("priority") as ListTicketsFilters["priority"] }
      : {}),
    ...(params.get("categoryId") ? { categoryId: params.get("categoryId")! } : {}),
    ...(params.get("assignedToUserId")
      ? { assignedToUserId: params.get("assignedToUserId")! }
      : {}),
    ...(params.get("search") ? { search: params.get("search")! } : {}),
    ...(page ? { page: Number(page) } : {}),
  };
}

export function TicketNeighbours({
  ticketId,
  status,
  locale,
}: {
  ticketId: string;
  status: TicketStatus;
  locale: string;
}) {
  const searchParams = useSearchParams();
  const context = ticketContextOf(new URLSearchParams(searchParams?.toString() ?? ""));
  if (!context) return null;
  return context.from === "board" ? (
    <BoardNeighbours ticketId={ticketId} status={status} locale={locale} query={context.query} />
  ) : (
    <ListNeighbours ticketId={ticketId} locale={locale} query={context.query} />
  );
}

function BoardNeighbours({
  ticketId,
  status,
  locale,
  query,
}: {
  ticketId: string;
  status: TicketStatus;
  locale: string;
  query: URLSearchParams;
}) {
  const filters = parseBoardFilters(query);
  // The column the ticket is in now (after a status change, its new column).
  const column = useTicketBoardColumnQuery(status, filters);
  const loaded = column.data?.pages.flatMap((page) => page.items) ?? [];
  const items = filters.risk ? loaded.filter((ticket) => isAtRiskTicket(ticket)) : loaded;
  const total = filters.risk ? items.length : column.data?.pages[0]?.total;
  return (
    <NeighbourNav
      items={items}
      offset={0}
      total={total}
      ticketId={ticketId}
      locale={locale}
      context={{ from: "board", query }}
    />
  );
}

function ListNeighbours({
  ticketId,
  locale,
  query,
}: {
  ticketId: string;
  locale: string;
  query: URLSearchParams;
}) {
  const filters = parseListFilters(query);
  const list = useTicketsQuery(filters);
  const page = list.data?.page ?? 1;
  const pageSize = list.data?.pageSize ?? 0;
  return (
    <NeighbourNav
      items={list.data?.items ?? []}
      offset={(page - 1) * pageSize}
      total={list.data?.total}
      ticketId={ticketId}
      locale={locale}
      context={{ from: "list", query }}
    />
  );
}

function NeighbourNav({
  items,
  offset,
  total,
  ticketId,
  locale,
  context,
}: {
  items: TicketListItem[];
  offset: number;
  total: number | undefined;
  ticketId: string;
  locale: string;
  context: { from: TicketContextFrom; query: URLSearchParams };
}) {
  const t = useTranslations("tickets.detail.neighbours");
  const index = items.findIndex((item) => item.id === ticketId);
  if (index < 0) return null;
  const previous = items[index - 1];
  const next = items[index + 1];
  const step = (target: TicketListItem | undefined, direction: "previous" | "next") => {
    const Icon = direction === "previous" ? ChevronLeftIcon : ChevronRightIcon;
    const icon = <Icon aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />;
    // At either end the arrow stays in place, disabled, so nothing shifts.
    return target ? (
      <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
        <Link
          href={ticketHref(locale, target.id, context)}
          aria-label={t(direction, { subject: target.subject })}
        >
          {icon}
        </Link>
      </Button>
    ) : (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        disabled
        aria-label={t(`${direction}None`)}
      >
        {icon}
      </Button>
    );
  };
  return (
    <nav aria-label={t("label")} className="flex items-center gap-tight">
      {step(previous, "previous")}
      <span className="text-caption tabular-nums text-ink-muted">
        {t("position", { index: offset + index + 1, total: total ?? items.length })}
      </span>
      {step(next, "next")}
    </nav>
  );
}
