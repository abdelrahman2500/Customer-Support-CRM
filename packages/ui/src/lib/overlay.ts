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
 * The values are unchanged from `AlertDialog`, so every existing
 * `ConfirmDialog` renders identically.
 */

/** Full-viewport scrim. `--overlay` is S-1's dedicated scrim token
 * (slate-950), not a step of `--ink`, used here at 40%. */
export const overlayClassName = "fixed inset-0 z-50 bg-overlay/40";

/**
 * The centred panel.
 *
 * `start-1/2` + `-translate-x-1/2` centres in LTR; `rtl:translate-x-1/2`
 * flips the sign under `dir="rtl"`, because `start-1/2` resolves to `right`
 * there and the transform has to move the panel the other way. This is the
 * one place in the package where a physical-axis transform needs an explicit
 * RTL counterpart — logical utilities cannot express it.
 */
export const overlayPanelClassName =
  "fixed start-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-rule bg-surface p-6 shadow-lg focus:outline-none rtl:translate-x-1/2";
