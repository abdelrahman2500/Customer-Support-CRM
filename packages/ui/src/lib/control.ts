/**
 * Story 186 (RD-1.9) — the one class string every text-entry control shares
 * (Input, Textarea, the Select trigger), so their borders, radius, hover and
 * invalid states cannot drift apart again.
 *
 *  - `border-rule-control` is the ≥3:1 boundary WCAG 1.4.11 asks of a control
 *    (the old `rule-strong` was 1.48:1 on white).
 *  - `aria-[invalid=true]` turns the border to the danger fill. `FormField`
 *    already sets `aria-invalid` from its `error`, so every field with an
 *    error shows it, not just the text below it.
 *  - No shadow: the flat, bordered control is the design language's look.
 *
 * Focus is applied by the caller (`focus-ring`, or `focus-ring-always` for
 * Radix triggers that receive focus programmatically).
 */
export const controlClassName =
  "w-full rounded-control border border-rule-control bg-surface text-sm text-ink transition-colors duration-fast ease-standard placeholder:text-ink-subtle hover:border-ink-subtle disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger-solid";

/**
 * Final UX pass — the surface of a control you *choose* with rather than
 * type into: Select and Combobox triggers, NativeSelect. A quiet ink tint
 * (it reads on a white card and on the warm canvas alike, and inverts with
 * the theme) instead of the outlined box — an outline around every filter
 * and dropdown made the screens read as a form. Identified by its value and
 * chevron (WCAG 1.4.11 does not ask a boundary of a labelled control);
 * hover and press deepen the tint, focus keeps the ring, and an invalid
 * choice still shows the danger edge. Text fields keep `controlClassName`:
 * an empty one has nothing else to show where it is.
 */
export const choiceControlClassName =
  "w-full rounded-control border border-transparent bg-ink/[0.05] text-sm text-ink transition-colors duration-fast ease-standard placeholder:text-ink-subtle hover:bg-ink/[0.08] data-[state=open]:bg-ink/[0.08] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger-solid";

/** Heights for single-line controls: comfortable 40px, compact 32px. */
export const controlHeightClassName = {
  md: "h-10 px-3",
  sm: "h-8 px-2.5 text-xs",
} as const;

export type ControlSize = keyof typeof controlHeightClassName;
