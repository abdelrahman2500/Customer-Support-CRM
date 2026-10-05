import type { KeyboardCoordinateGetter } from "@dnd-kit/core";
import type { InfiniteData } from "@tanstack/react-query";
import type { PaginatedResponse } from "@/lib/paginated";
import type { TicketListItem, TicketStatus } from "@/lib/tickets-api";
import type { BoardSort } from "./board-state";

/**
 * Story 217 (PR-3.2, tickets-kanban-ux.md §5) — the pure rules behind moving
 * a card: which moves need a confirmation, and how a column's cached pages
 * change optimistically (the card leaves the source column and lands in the
 * target at its sorted position — there is no manual order).
 */
export type ColumnPages = InfiniteData<PaginatedResponse<TicketListItem>>;

/** Resolved and Closed notify the customer, so they are confirmed first (PD-5). */
export function needsConfirmation(to: TicketStatus): boolean {
  return to === "RESOLVED" || to === "CLOSED";
}

function time(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
}

/**
 * Mirrors the API's ordering per sort (tickets.service.ts): SLA urgency is
 * the response target ascending with no-target tickets last, then the
 * creation time.
 */
export function compareForSort(sort: BoardSort): (a: TicketListItem, b: TicketListItem) => number {
  switch (sort) {
    case "slaUrgency":
      return (a, b) =>
        time(a.slaTarget?.responseTargetAt) - time(b.slaTarget?.responseTargetAt) ||
        time(a.createdAt) - time(b.createdAt);
    case "updated":
      return (a, b) => time(b.updatedAt) - time(a.updatedAt);
    case "newest":
      return (a, b) => time(b.createdAt) - time(a.createdAt);
    case "oldest":
      return (a, b) => time(a.createdAt) - time(b.createdAt);
  }
}

/** Removes a ticket from every loaded page, adjusting the total. */
export function removeFromPages(data: ColumnPages, ticketId: string): ColumnPages {
  const present = data.pages.some((page) => page.items.some((item) => item.id === ticketId));
  if (!present) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== ticketId),
      total: Math.max(0, page.total - 1),
    })),
  };
}

/**
 * Inserts a ticket into the loaded pages at its sorted position, adjusting
 * the total. A card that sorts after every loaded card is appended to the
 * last loaded page, so the agent sees where it went; the refetch that
 * follows the move settles the exact paging.
 */
export function insertIntoPages(
  data: ColumnPages,
  ticket: TicketListItem,
  sort: BoardSort,
): ColumnPages {
  const compare = compareForSort(sort);
  let placed = false;
  const pages = data.pages.map((page, pageIndex) => {
    const items = page.items.filter((item) => item.id !== ticket.id);
    if (!placed) {
      const at = items.findIndex((item) => compare(ticket, item) < 0);
      if (at >= 0) {
        items.splice(at, 0, ticket);
        placed = true;
      } else if (pageIndex === data.pages.length - 1) {
        items.push(ticket);
        placed = true;
      }
    }
    return { ...page, items, total: page.total + 1 };
  });
  return { ...data, pages };
}

/**
 * Story 217 — the keyboard drag moves between columns, not pixels: ←/→ jump
 * to the nearest column in that visual direction. Columns follow `dir`, so
 * in Arabic ← is the next column in reading order, as it should be.
 *
 * dnd-kit's coordinates are the dragged rect's top-left corner, so the
 * comparison uses the rect's centre and the result centres it on the column.
 */
export const columnCoordinates: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates },
) => {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return undefined;
  event.preventDefault();
  const rightward = event.code === "ArrowRight";
  // Not measured yet (a key pressed in the same frame as the pick-up): no
  // reliable position to move from, so this key does nothing.
  if (!context.collisionRect) return undefined;
  const halfWidth = context.collisionRect.width / 2;
  const current = currentCoordinates.x + halfWidth;
  let best: { center: number; distance: number } | undefined;
  for (const rect of context.droppableRects.values()) {
    const center = rect.left + rect.width / 2;
    const distance = rightward ? center - current : current - center;
    if (distance > 1 && (!best || distance < best.distance)) best = { center, distance };
  }
  return best ? { x: best.center - halfWidth, y: currentCoordinates.y } : currentCoordinates;
};

/** What a column remembers about the cards it last showed. */
export interface ColumnSnapshot {
  /** id → the fields whose change is worth a cue. */
  cards: Map<string, { assignee: string | null; priority: string }>;
  /** The newest `updatedAt` among them (server clock). */
  newestUpdate: number;
  /** When the snapshot was taken (client clock). */
  takenAt: number;
}

export function snapshotOf(items: TicketListItem[], takenAt: number): ColumnSnapshot {
  const cards = new Map<string, { assignee: string | null; priority: string }>();
  let newestUpdate = 0;
  for (const item of items) {
    cards.set(item.id, { assignee: item.assignedToUserId ?? null, priority: item.priority });
    newestUpdate = Math.max(newestUpdate, new Date(item.updatedAt).getTime());
  }
  return { cards, newestUpdate, takenAt };
}

/** Tolerated difference between the server's and the browser's clocks. */
const CLOCK_SKEW_MS = 60_000;

/**
 * Story 218 (PR-3.3, tickets-kanban-ux.md §6) — which cards a refetch shows
 * as changed by someone else: a card that arrived in this column (a new
 * ticket, or another agent's status change) or whose assignee or priority
 * changed. Only cards updated after the previous snapshot count — so a new
 * message (same fields), "Show more" or an older card sliding up into the
 * loaded window never pulses — and the agent's own moves are excluded.
 */
export function changedSince(
  previous: ColumnSnapshot,
  items: TicketListItem[],
  ownMoves: ReadonlySet<string>,
): string[] {
  const changed: string[] = [];
  for (const item of items) {
    if (ownMoves.has(item.id)) continue;
    const updated = new Date(item.updatedAt).getTime();
    if (updated <= previous.newestUpdate || updated < previous.takenAt - CLOCK_SKEW_MS) continue;
    const before = previous.cards.get(item.id);
    if (
      !before ||
      before.assignee !== (item.assignedToUserId ?? null) ||
      before.priority !== item.priority
    ) {
      changed.push(item.id);
    }
  }
  return changed;
}

/** True when the server's copy differs from what the card showed (a collision). */
export function changedElsewhere(shown: TicketListItem, current: TicketSummaryLike): boolean {
  return (
    current.status !== shown.status ||
    (current.assignedToUserId ?? null) !== (shown.assignedToUserId ?? null) ||
    current.priority !== shown.priority
  );
}

type TicketSummaryLike = Pick<TicketListItem, "status" | "assignedToUserId" | "priority">;
