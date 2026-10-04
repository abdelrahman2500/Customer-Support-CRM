/**
 * Story 190 (RD-1.13) — the one toast treatment, shared by `SuccessToaster`
 * and both apps' `NotificationToaster`s.
 *
 * The region is 320px-safe: on phones `inset-x-4` leaves a 1rem gutter on
 * both edges (the old `w-full … end-4` was 100vw wide and overflowed the
 * start edge by 1rem, recon RS-01); from `sm` it is a 24rem column at the
 * reading-end edge. Callers add the vertical edge (`top-4`/`bottom-4`).
 */
export const toastRegionClassName =
  "pointer-events-none fixed inset-x-4 z-50 sm:inset-x-auto sm:end-4 sm:w-96";

/** The always-mounted polite live list inside the region (recon A11Y-10). */
export const toastListClassName = "flex flex-col gap-2";

export const toastCardClassName =
  "pointer-events-auto flex rounded-surface border bg-surface-raised p-3 text-sm text-ink shadow-overlay animate-fade-in";

export type ToastTone = "success" | "info" | "warning" | "error";

export const toastToneClassName: Record<ToastTone, string> = {
  success: "border-success-border",
  info: "border-info-border",
  warning: "border-warning-border",
  error: "border-danger-border",
};
