/**
 * Story S-3 — class strings shared by the floating surfaces
 * (`DropdownMenu`, `Popover`, and `Select`'s own content), so a menu, a
 * popover and a select panel are the same object visually.
 *
 * Values match `Select`'s existing content styling from Story 23 exactly, so
 * adopting them changes nothing about how a select already looks.
 */

/** A floating panel: portalled, above page chrome, bounded to the viewport.
 *
 * `max-h-[var(--radix-popper-available-height)]` is the containment fix the
 * recon logged as D2: Radix measures the space between the trigger and the
 * viewport edge and publishes it as that custom property, so a long list
 * scrolls inside the panel instead of growing past the fold. Paired with
 * `overflow-y-auto`, the panel can never extend the page. */
export const menuContentClassName =
  "z-50 max-h-[var(--radix-popper-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border border-rule bg-surface p-1 text-ink shadow-md";

/** A row inside a menu. `ps-8 pe-2` leaves room at the reading-start edge
 * for a check indicator, matching `SelectItem`'s own geometry.
 *
 * Story 166 — `focus:bg-surface-muted` used to be the whole focus indicator,
 * and `--surface` (255 255 255) against `--surface-muted` (241 245 249)
 * measures 1.10:1, under WCAG 2.4.11's 3:1 minimum. `.focus-ring-always` is
 * the treatment `tailwind-tokens.css` already documents for exactly this case
 * ("the select trigger, menu items"), and `SelectTrigger` already leads its
 * own class string with it. The tint stays as a second, redundant cue.
 *
 * The ring paints 2px of offset plus a 2px ring — 4px outside the item's box,
 * which is exactly the `p-1` both containers already have (`DropdownMenu`'s
 * `menuContentClassName` above, `Select`'s own `Viewport`), so nothing clips
 * it and neither padding needs to grow. */
export const menuItemClassName =
  "focus-ring-always relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 ps-8 pe-2 text-sm outline-none transition-colors focus:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export const menuLabelClassName = "px-2 py-1.5 text-xs font-semibold text-ink-subtle";

export const menuSeparatorClassName = "-mx-1 my-1 h-px bg-rule";
