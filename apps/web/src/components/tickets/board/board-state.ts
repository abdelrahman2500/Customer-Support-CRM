import { ticketStatusPresentation, type PresentationTone } from "@crm/shared";
import type { ListTicketsFilters, TicketListItem, TicketStatus } from "@/lib/tickets-api";
import { deriveSlaStatus } from "@/lib/sla";

/**
 * Story 216 (PR-3.1) — the Tickets board's URL state and pure rules
 * (tickets-kanban-ux.md §2–§4). The board keeps the list view's parameter
 * names where they mean the same thing (`search`, `priority`, `categoryId`,
 * `assignedToUserId`, `unassigned`), so a filtered URL reads the same in
 * either view, and adds its own: `sort` and `risk`.
 */
export const BOARD_STATUSES: readonly TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

export const BOARD_PAGE_SIZE = 25;

export type BoardSort = "slaUrgency" | "updated" | "newest" | "oldest";
export const BOARD_SORTS: readonly BoardSort[] = ["slaUrgency", "updated", "newest", "oldest"];

export type QuickView = "all" | "mine" | "unassigned" | "atRisk";
export const QUICK_VIEWS: readonly QuickView[] = ["all", "mine", "unassigned", "atRisk"];

export interface BoardFilters {
  search?: string;
  priority?: ListTicketsFilters["priority"];
  categoryId?: string;
  /** Story 222 — one customer's tickets (from the customer page). */
  customerId?: string;
  assignedToUserId?: string;
  unassigned?: boolean;
  /** "At risk" quick view: a client-side SLA filter over the loaded cards. */
  risk?: boolean;
  sort: BoardSort;
}

export function parseBoardFilters(params: URLSearchParams): BoardFilters {
  const sort = params.get("sort") as BoardSort | null;
  return {
    sort: sort && BOARD_SORTS.includes(sort) ? sort : "slaUrgency",
    ...(params.get("search") ? { search: params.get("search")! } : {}),
    ...(params.get("priority")
      ? { priority: params.get("priority") as ListTicketsFilters["priority"] }
      : {}),
    ...(params.get("categoryId") ? { categoryId: params.get("categoryId")! } : {}),
    ...(params.get("customerId") ? { customerId: params.get("customerId")! } : {}),
    ...(params.get("assignedToUserId")
      ? { assignedToUserId: params.get("assignedToUserId")! }
      : {}),
    ...(params.get("unassigned") === "true" ? { unassigned: true } : {}),
    ...(params.get("risk") === "1" ? { risk: true } : {}),
  };
}

export function serializeBoardFilters(filters: BoardFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.customerId) params.set("customerId", filters.customerId);
  if (filters.assignedToUserId) params.set("assignedToUserId", filters.assignedToUserId);
  if (filters.unassigned) params.set("unassigned", "true");
  if (filters.risk) params.set("risk", "1");
  if (filters.sort !== "slaUrgency") params.set("sort", filters.sort);
  // `view=board` only alongside other board state: the default /tickets URL
  // stays clean (the board is the default), while a filtered board link
  // opens the board even for someone who last used the list.
  if ([...params.keys()].length > 0) {
    const withView = new URLSearchParams([["view", "board"], ...params]);
    return withView;
  }
  return params;
}

/** The quick view the current filters amount to. */
export function quickViewOf(filters: BoardFilters, currentUserId: string | undefined): QuickView {
  if (filters.risk) return "atRisk";
  if (filters.unassigned) return "unassigned";
  if (currentUserId && filters.assignedToUserId === currentUserId) return "mine";
  return "all";
}

/** Applies a quick view, replacing whatever assignee/risk scope was set. */
export function withQuickView(
  filters: BoardFilters,
  view: QuickView,
  currentUserId: string | undefined,
): BoardFilters {
  const { assignedToUserId: _a, unassigned: _u, risk: _r, ...rest } = filters;
  void _a;
  void _u;
  void _r;
  if (view === "mine" && currentUserId) return { ...rest, assignedToUserId: currentUserId };
  if (view === "unassigned") return { ...rest, unassigned: true };
  if (view === "atRisk") return { ...rest, risk: true };
  return rest;
}

/** How many filters narrow the board (for "Filters (n)" and clear-all). */
export function activeFilterCount(filters: BoardFilters): number {
  return [
    filters.search,
    filters.priority,
    filters.categoryId,
    filters.customerId,
    filters.assignedToUserId,
    filters.unassigned,
    filters.risk,
  ].filter(Boolean).length;
}

/** The API query for one column: its status, the shared filters and the sort. */
export function columnQuery(status: TicketStatus, filters: BoardFilters): ListTicketsFilters {
  const sort: Pick<ListTicketsFilters, "sortBy" | "sortDir"> =
    filters.sort === "slaUrgency"
      ? { sortBy: "slaUrgency", sortDir: "asc" }
      : filters.sort === "updated"
        ? { sortBy: "updatedAt", sortDir: "desc" }
        : filters.sort === "newest"
          ? { sortBy: "createdAt", sortDir: "desc" }
          : { sortBy: "createdAt", sortDir: "asc" };
  return {
    status,
    ...sort,
    pageSize: BOARD_PAGE_SIZE,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.assignedToUserId ? { assignedToUserId: filters.assignedToUserId } : {}),
    ...(filters.unassigned ? { unassigned: "true" as const } : {}),
  };
}

/** "At risk" on the board: an at-risk or breached governing target (not on hold). */
export function isAtRiskTicket(ticket: TicketListItem, now: Date = new Date()): boolean {
  const status = deriveSlaStatus(ticket.slaTarget, now, { createdAt: ticket.createdAt });
  return status.kind === "breached" || (status.kind === "on-track" && status.atRisk);
}

/**
 * The status spine: one hue per status, used by the column, its dot and the
 * switcher — and (Story 219) `top`, the ticket header's top edge. Literal
 * class names, so Tailwind generates every one.
 */
const SPINE: Record<PresentationTone, { border: string; dot: string; top: string }> = {
  info: { border: "border-info-solid", dot: "bg-info-solid", top: "border-t-info-solid" },
  progress: {
    border: "border-progress-solid",
    dot: "bg-progress-solid",
    top: "border-t-progress-solid",
  },
  success: {
    border: "border-success-solid",
    dot: "bg-success-solid",
    top: "border-t-success-solid",
  },
  neutral: { border: "border-rule-control", dot: "bg-rule-control", top: "border-t-rule-control" },
  warning: {
    border: "border-warning-solid",
    dot: "bg-warning-solid",
    top: "border-t-warning-solid",
  },
  danger: { border: "border-danger-solid", dot: "bg-danger-solid", top: "border-t-danger-solid" },
};

export function statusSpine(status: TicketStatus): { border: string; dot: string; top: string } {
  return SPINE[ticketStatusPresentation(status).tone];
}

/** Browser-only view conveniences (never shared state). */
export const VIEW_STORAGE_KEY = "crm.tickets.view";
export const CLOSED_COLLAPSED_STORAGE_KEY = "crm.tickets.board.closedCollapsed";

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the preference simply is not remembered.
  }
}
