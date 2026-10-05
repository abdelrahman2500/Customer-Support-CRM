/**
 * Story 210 (PR-1.1, visual language v2) — the surface recipes.
 *
 * One named class string per surface role, so every screen builds the same
 * hierarchy from the same parts instead of re-deciding borders, radius and
 * shadow. Elevation has exactly four levels (visual-direction.md §5):
 *
 *   0 flat on the canvas · 1 a card (surface + hairline) · 2 the hover of a
 *   draggable card · 3 anything floating (dragged card, menu, sheet, dialog).
 *
 * Borders before shadows: resting surfaces never carry a shadow.
 */
export const recipes = {
  /** Level 1 — a card on the canvas. */
  card: "rounded-surface border border-rule bg-surface",
  /** A board column or grouped panel: a quiet tray holding level-1 cards. */
  column: "rounded-surface border border-rule-subtle bg-surface-muted/60",
  /** A block inside a card (a summary, a quoted value). */
  inner: "rounded-inner bg-surface-muted",
  /** Level 2 — the hover of something that can be picked up. */
  liftable: "transition-shadow duration-fast ease-standard hover:shadow-raised",
  /** Level 3 — floating above the page. */
  floating: "rounded-surface border border-rule bg-surface-raised shadow-overlay",
  /** The ink chrome (rail, header band); scopes the focus ring too. */
  chrome: "on-chrome bg-chrome text-chrome-ink",
} as const;

export type Recipe = keyof typeof recipes;
