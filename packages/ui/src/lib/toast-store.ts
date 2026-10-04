"use client";

import { create } from "zustand";
import type { ToastTone } from "./toast";

/**
 * Story 94 — a small, generic, in-memory success-feedback store — the same
 * "Zustand only where genuinely needed" shape `notifications-store.ts`
 * (Story 24) already established, but for a *different* concern: this
 * store is for a mutation the current caller just performed succeeding
 * (ticket created, status updated, ...), never for a domain event pushed
 * from elsewhere (SLA/escalation), which stays exactly `useNotificationsStore`'s
 * job, untouched by this story. Kept as a separate store/component pair
 * (`SuccessToaster`, rendered in its own fixed corner) specifically so the
 * two never collide or get conflated — see that file's own doc comment.
 *
 * Deliberately not persisted, not deduplicated beyond the store's own
 * `add`, and capped the same way (`MAX_VISIBLE`) — a success toast is
 * transient positive feedback, not a notification center.
 */

const AUTO_DISMISS_MS = 5_000;
const MAX_VISIBLE = 3;

export interface SuccessToast {
  id: string;
  /** Already-translated text — resolved by the caller (which has its own
   * `useTranslations()` scope) before calling `add`, exactly like every
   * other translated string this codebase passes across a component
   * boundary (e.g. `ConfirmDialog`'s own `title`/`description` props). */
  message: string;
  /** Story 190 (RD-1.13) — "success" unless a caller of `showToast` says
   * otherwise. */
  tone: ToastTone;
}

/** Story 190 — the store holds every tone now; `SuccessToast` stays the
 * name existing imports use. */
export type Toast = SuccessToast;

interface ToastState {
  toasts: SuccessToast[];
  add: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, tone = "success") => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    set((state) => ({ toasts: [{ id, message, tone }, ...state.toasts].slice(0, MAX_VISIBLE) }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
      }, AUTO_DISMISS_MS);
    }
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Convenience for call sites that just want to fire a success toast
 * (typically a mutation's `onSuccess`) without subscribing to the store. */
export function showSuccessToast(message: string): void {
  useToastStore.getState().add(message, "success");
}

/** Story 190 (RD-1.13) — the same, for any tone. Error toasts are announced
 * assertively (`role="alert"`); the rest politely. */
export function showToast(message: string, options: { tone?: ToastTone } = {}): void {
  useToastStore.getState().add(message, options.tone ?? "success");
}
