import { create } from "zustand";

/**
 * Story 86 — mirrors `apps/web/src/lib/notifications-store.ts` file-for-
 * file: an in-memory-only, transient store for the Customer Portal's own
 * two notification events. No persistence, no read/unread state, no
 * notification center — a notification's only lifecycle is "shown" ->
 * "dismissed" (manually or via the store's own auto-dismiss timer), same
 * as the Agent Workspace's own first iteration of this pattern.
 */

export type PortalNotificationEventType = "ticket.updated" | "channel.message.created";

/** Mirrors `TicketUpdatedEvent` — `apps/api/src/modules/tickets/tickets.events.ts`. */
export interface TicketUpdatedNotificationPayload {
  ticket: { id: string; subject: string; status: string };
  actorUserId: string | null;
}

/** Mirrors `ChannelMessageCreatedEvent` — `apps/api/src/modules/channels/channel-messages.events.ts`. */
export interface ChannelMessageNotificationPayload {
  ticketId: string;
  message: { id: string; body: string; senderUserId: string | null };
}

export type PortalNotificationPayload =
  | TicketUpdatedNotificationPayload
  | ChannelMessageNotificationPayload;

export interface PortalNotification {
  id: string;
  eventType: PortalNotificationEventType;
  payload: PortalNotificationPayload;
  receivedAt: number;
}

/** Same constants as `apps/web`'s store — see its own doc comment. */
const AUTO_DISMISS_MS = 10_000;
const MAX_VISIBLE = 5;

/** Demo hardening — how long an event is remembered, so a repeat of it is
 * not shown again. A message is re-sent as its delivery status changes
 * (PENDING → SENT → DELIVERED), so it is remembered for minutes; a ticket
 * update only needs to absorb the same event arriving twice at once. */
const MESSAGE_DEDUPE_MS = 10 * 60_000;
const TICKET_UPDATE_DEDUPE_MS = 5_000;

/**
 * Demo hardening — the identity of an event, for deduplication. The portal
 * shares one socket between the notifications room and an open ticket's
 * room, and the API relays `ticket.updated` and `channel.message.created`
 * to both, so on a ticket page every event arrived twice — two "New reply"
 * toasts per reply.
 */
export function notificationKey(
  eventType: PortalNotificationEventType,
  payload: PortalNotificationPayload,
): string {
  if (eventType === "channel.message.created" && "message" in payload) {
    return `message:${payload.message.id}`;
  }
  if ("ticket" in payload) {
    return `ticket:${payload.ticket.id}:${payload.ticket.status}:${payload.ticket.subject}`;
  }
  return `${eventType}:${JSON.stringify(payload)}`;
}

interface PortalNotificationsState {
  notifications: PortalNotification[];
  /** Demo hardening — event keys already shown, with when (see `add`). */
  recentKeys: Record<string, number>;
  add: (eventType: PortalNotificationEventType, payload: PortalNotificationPayload) => void;
  dismiss: (id: string) => void;
}

export const usePortalNotificationsStore = create<PortalNotificationsState>((set, get) => ({
  notifications: [],
  recentKeys: {},
  add: (eventType, payload) => {
    // Demo hardening — only an agent's message is a reply: the ticket room
    // also relays the customer's own messages (no `senderUserId`).
    if (eventType === "channel.message.created" && "message" in payload) {
      if (!payload.message.senderUserId) return;
    }
    // Demo hardening — one toast per event, however many times it arrives.
    const now = Date.now();
    const key = notificationKey(eventType, payload);
    const window_ = key.startsWith("message:") ? MESSAGE_DEDUPE_MS : TICKET_UPDATE_DEDUPE_MS;
    const seenAt = get().recentKeys[key];
    if (seenAt !== undefined && now - seenAt < window_) return;
    const recentKeys = Object.fromEntries(
      Object.entries(get().recentKeys).filter(([, at]) => now - at < MESSAGE_DEDUPE_MS),
    );
    recentKeys[key] = now;
    set({ recentKeys });

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    set((state) => ({
      notifications: [{ id, eventType, payload, receivedAt: Date.now() }, ...state.notifications].slice(
        0,
        MAX_VISIBLE,
      ),
    }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
      }, AUTO_DISMISS_MS);
    }
  },
  dismiss: (id) => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
}));
