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
 * for a check indicator, matching `SelectItem`'s own geometry. */
export const menuItemClassName =
  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 ps-8 pe-2 text-sm outline-none transition-colors focus:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export const menuLabelClassName = "px-2 py-1.5 text-xs font-semibold text-ink-subtle";

export const menuSeparatorClassName = "-mx-1 my-1 h-px bg-rule";
