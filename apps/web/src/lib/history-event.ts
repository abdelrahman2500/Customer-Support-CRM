/**
 * Story 193 (RD-1.16) — a ticket history entry's `eventType` (written by the
 * API's `ticket-history.listener.ts`) as the camelCase key of its label in
 * `tickets.detail.historyEvent.*`. next-intl reads dots in a key as nesting,
 * so `"ticket.created"` cannot be a message key itself. `eventType` is a free
 * string in the schema, so anything unknown maps to the generic `other`
 * rather than leaking the raw value.
 */
export type HistoryEventKey = "created" | "updated" | "recategorized" | "escalated" | "other";

const HISTORY_EVENT_KEY: Record<string, Exclude<HistoryEventKey, "other">> = {
  "ticket.created": "created",
  "ticket.updated": "updated",
  "ticket.recategorized": "recategorized",
  "ticket.escalated": "escalated",
};

export function historyEventKey(eventType: string): HistoryEventKey {
  const key = Object.prototype.hasOwnProperty.call(HISTORY_EVENT_KEY, eventType)
    ? HISTORY_EVENT_KEY[eventType]
    : undefined;
  return key ?? "other";
}

/** Demo hardening — one field a `ticket.updated` entry changed. */
export type HistoryChange =
  | { field: "status"; value: string }
  | { field: "priority"; value: string }
  | { field: "assignee"; value: string | null }
  | { field: "category" }
  | { field: "subject" };

function snapshotField(snapshot: unknown, key: string): unknown {
  return snapshot && typeof snapshot === "object"
    ? (snapshot as Record<string, unknown>)[key]
    : undefined;
}

/**
 * Demo hardening — what an update changed, from the ticket snapshot each
 * history entry stores (the ticket as it was after the event) compared with
 * the one before it. Lets the timeline say "Status changed to Resolved"
 * instead of a bare "Ticket updated". Empty when there is no earlier
 * snapshot to compare with, or nothing it knows how to name changed.
 */
export function describeHistoryChange(previous: unknown, current: unknown): HistoryChange[] {
  if (previous === undefined || previous === null || !current) return [];
  const changed = (key: string) => snapshotField(previous, key) !== snapshotField(current, key);
  const changes: HistoryChange[] = [];
  if (changed("status") && typeof snapshotField(current, "status") === "string") {
    changes.push({ field: "status", value: snapshotField(current, "status") as string });
  }
  if (changed("priority") && typeof snapshotField(current, "priority") === "string") {
    changes.push({ field: "priority", value: snapshotField(current, "priority") as string });
  }
  if (changed("assignedToUserId")) {
    const value = snapshotField(current, "assignedToUserId");
    changes.push({ field: "assignee", value: typeof value === "string" ? value : null });
  }
  if (changed("categoryId")) changes.push({ field: "category" });
  if (changed("subject")) changes.push({ field: "subject" });
  return changes;
}
