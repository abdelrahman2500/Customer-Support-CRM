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
