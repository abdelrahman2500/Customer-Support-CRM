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

interface PortalNotificationsState {
  notifications: PortalNotification[];
  add: (eventType: PortalNotificationEventType, payload: PortalNotificationPayload) => void;
  dismiss: (id: string) => void;
}

export const usePortalNotificationsStore = create<PortalNotificationsState>((set) => ({
  notifications: [],
  add: (eventType, payload) => {
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
