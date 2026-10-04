/**
 * Story S-3 — class strings shared by the floating surfaces
 * (`DropdownMenu`, `Popover`, and `Select`'s own content), so a menu, a
 * popover and a select panel are the same object visually.
 *
 * Story 187 (RD-1.10) — the panel is the design language's raised floating
 * surface (`surface-raised`, `shadow-raised`, `rounded-control`) with a fade +
 * slight zoom on open/close, shared by DropdownMenu, Select and Popover.
 */

/** A floating panel: portalled, above page chrome, bounded to the viewport.
 *
 * `max-h-[var(--radix-popper-available-height)]` is the containment fix the
 * recon logged as D2: Radix measures the space between the trigger and the
 * viewport edge and publishes it as that custom property, so a long list
 * scrolls inside the panel instead of growing past the fold. Paired with
 * `overflow-y-auto`, the panel can never extend the page. */
export const menuContentClassName =
  "z-50 max-h-[var(--radix-popper-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-control border border-rule bg-surface-raised p-1 text-ink shadow-raised data-[state=open]:animate-zoom-in data-[state=closed]:animate-zoom-out";

/** A row inside a menu. `px-2` on both edges; an item that can show a check
 * mark (SelectItem) adds `menuCheckableItemClassName` below.
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
  "focus-ring-always relative flex w-full cursor-pointer select-none items-center gap-2 rounded-inner px-2 py-1.5 text-sm outline-none transition-colors duration-fast focus:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/**
 * Story 187 (RD-1.10) — the start gutter for an item that may show a check
 * mark (Select). Plain menu items no longer reserve it, so a DropdownMenu
 * row is not indented for a check mark it can never show (recon §2.3).
 */
export const menuCheckableItemClassName = "ps-8";

export const menuLabelClassName = "px-2 py-1.5 text-label text-ink-subtle";

export const menuSeparatorClassName = "-mx-1 my-1 h-px bg-rule";
