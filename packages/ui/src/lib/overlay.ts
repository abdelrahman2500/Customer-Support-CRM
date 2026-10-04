/**
 * Story S-3 — the overlay/panel class strings shared by `Dialog` (new here)
 * and `AlertDialog` (Story 94).
 *
 * Extracted rather than copied because the two are the same surface with one
 * semantic difference — `role="dialog"` versus `role="alertdialog"`, and a
 * close affordance versus a forced decision. Letting them carry independent
 * copies of the scrim colour, the panel border, the centring transform and
 * the RTL correction is exactly how two dialogs end up 2px apart.
 *
 * Story 187 (RD-1.10) — the design language's overlay surface: a raised
 * panel (`surface-raised`, `rounded-surface`, `shadow-overlay`) bounded to the
 * viewport with internal scrolling, opening with a fade and a slight zoom.
 * Widths live in `overlayPanelSizeClassName` below. Block layout is kept on
 * purpose (no flex): every existing `ConfirmDialog` lays out exactly as before.
 */

/** Full-viewport scrim. `--overlay` is S-1's dedicated scrim token, not a
 * step of `--ink`, used here at 50%, fading in and out. */
export const overlayClassName =
  "fixed inset-0 z-50 bg-overlay/50 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";

/**
 * The centred panel.
 *
 * `start-1/2` + `-translate-x-1/2` centres in LTR; `rtl:translate-x-1/2`
 * flips the sign under `dir="rtl"`, because `start-1/2` resolves to `right`
 * there and the transform has to move the panel the other way. This is the
 * one place in the package where a physical-axis transform needs an explicit
 * RTL counterpart — logical utilities cannot express it.
 *
 * Batch 8 (UX audit) — `w-[calc(100%-2rem)]`, not a bare `w-full`: on a very
 * narrow viewport (~320px) the panel otherwise touches both screen edges,
 * relying on nothing but its own `p-6` for breathing room. This guarantees a
 * 1rem gutter on each side below `max-w-md`; above it, `max-w-md` is
 * reached first and this has no effect at all.
 *
 * Story 187 — the zoom animates the individual `scale` property, which CSS
 * applies AFTER the centring translate. With the default centre origin the
 * scale also shrinks that translate, so the panel drifted ~2% of its width
 * off centre while opening (measured 3–8px). Pinning the origin to the
 * panel's inline-start top corner — the point the translate is measured
 * from — keeps the centre fixed for the whole animation. There is no logical
 * `origin-*` utility, so RTL takes the mirrored corner explicitly, exactly
 * like `rtl:translate-x-1/2` above.
 */
export const overlayPanelClassName =
  "fixed start-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 origin-top-left rtl:origin-top-right overflow-y-auto rounded-surface border border-rule bg-surface-raised p-6 text-ink shadow-overlay focus:outline-none rtl:translate-x-1/2 data-[state=open]:animate-zoom-in data-[state=closed]:animate-zoom-out";

/** Story 187 (RD-1.10) — dialog widths, applied after the panel class (`cn` lets the later `max-w-*` win). */
export const overlayPanelSizeClassName = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
} as const;
export type OverlayPanelSize = keyof typeof overlayPanelSizeClassName;
