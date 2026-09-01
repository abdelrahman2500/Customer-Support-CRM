import { create } from "zustand";

/**
 * Story 94 — portal counterpart of `apps/web/src/lib/toast-store.ts` (same
 * shape, independently re-declared per this codebase's convention). A
 * small, generic, in-memory success-feedback store — deliberately separate
 * from `usePortalNotificationsStore` (`apps/portal/src/lib/notifications-store.ts`),
 * which stays exactly the real-time `ticket.updated`/`channel.message.created`
 * domain-event consumer it already was, untouched by this story.
 */

const AUTO_DISMISS_MS = 5_000;
const MAX_VISIBLE = 3;

export interface SuccessToast {
  id: string;
  message: string;
}

interface ToastState {
  toasts: SuccessToast[];
  add: (message: string) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    set((state) => ({ toasts: [{ id, message }, ...state.toasts].slice(0, MAX_VISIBLE) }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
      }, AUTO_DISMISS_MS);
    }
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function showSuccessToast(message: string): void {
  useToastStore.getState().add(message);
}
