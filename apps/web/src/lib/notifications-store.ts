import { create } from "zustand";

/**
 * Story 24 — in-memory-only store for transient branch notifications.
 * Deliberately not persisted anywhere (no localStorage, no backend, no
 * database): per the intake's binding decisions, there is no notification
 * center, no read/unread state, and no per-user inbox. This store exists
 * only to let `BranchNotifications` (mounted once in `(agent)/layout.tsx`)
 * and `NotificationToaster` (rendered alongside it) share the current,
 * transient list without prop-drilling — the same "Zustand only where
 * genuinely needed" decision named for this project's stack.
 */

export type BranchNotificationEventType = "sla.at_risk" | "sla.breached" | "ticket.escalated";

/** Mirrors `SlaAtRiskEvent`/`SlaBreachedEvent` — `apps/api/src/modules/sla-policies/sla-detection.events.ts`. */
export interface SlaDetectionNotificationPayload {
  ticketId: string;
  branchId: string;
  targetType: "response" | "resolution";
  targetAt: string;
}

/** Mirrors `TicketEscalatedEvent` — `apps/api/src/modules/tickets/tickets.events.ts`. */
export interface TicketEscalatedNotificationPayload {
  ticket: { id: string; subject: string };
  actorUserId: string | null;
}

export type BranchNotificationPayload =
  | SlaDetectionNotificationPayload
  | TicketEscalatedNotificationPayload;

export interface BranchNotification {
  id: string;
  eventType: BranchNotificationEventType;
  payload: BranchNotificationPayload;
  receivedAt: number;
}

/** Transient: each notification auto-dismisses after this long, in addition
 * to being manually dismissible. Keeps the stack from growing unbounded
 * without introducing any persisted "read" concept. */
const AUTO_DISMISS_MS = 10_000;
/** Caps how many notifications render at once — "support multiple incoming
 * events without breaking the UI" without needing a scrollable inbox. */
const MAX_VISIBLE = 5;

interface NotificationsState {
  notifications: BranchNotification[];
  add: (eventType: BranchNotificationEventType, payload: BranchNotificationPayload) => void;
  dismiss: (id: string) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  add: (eventType, payload) => {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
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
