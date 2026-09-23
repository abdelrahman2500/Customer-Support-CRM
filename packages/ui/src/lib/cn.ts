import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The project's four named design scales
 * (`packages/config/tailwind-preset.js`'s `fontSize`, `spacing`,
 * `borderRadius` and `boxShadow` keys), registered with tailwind-merge so it
 * can reason about them.
 *
 * ## Why this is needed at all
 *
 * tailwind-merge ships knowing Tailwind's own scales and nothing else. A
 * class built from a project-specific key is therefore unrecognised, and it
 * fails in one of two ways depending on the group — both silent, both
 * measured against the real components:
 *
 *   1. **Dropped.** An unknown `text-*` falls through to the *text-colour*
 *      group, so `cn("text-subhead text-ink")` looked like two colours,
 *      tailwind-merge resolved the "conflict" in favour of the last, and
 *      emitted `text-ink` alone. The heading rendered at the inherited size
 *      with no error anywhere. (Story 170.)
 *   2. **Never merged.** An unknown `p-*`/`rounded-*`/`shadow-*` matches no
 *      group at all, so nothing conflicts and both classes survive:
 *      `cn("p-4", "p-surface")` emitted `"p-4 p-surface"`, and — worse —
 *      `cn("p-surface", "p-shell")` emitted `"p-surface p-shell"`. Two steps
 *      of the *same* scale did not override each other, so a caller's
 *      `className` could not replace a component's own padding or radius and
 *      which rule actually won fell to stylesheet source order. (Story 172.)
 *
 * Every component in this package styles through `cn`, so for as long as
 * these were unregistered the design vocabulary was only partly usable
 * inside `@crm/ui` — which is part of why the type scale sat at zero
 * adoption from Story 134 until Story 168 spent it on a plain `<h1>` that
 * never went through `cn`.
 *
 * ## Why the `theme` key rather than `classGroups`
 *
 * One `theme` entry teaches tailwind-merge the scale itself, and every
 * built-in group that reads that scale picks it up at once — `spacing`
 * alone covers `p`/`px`/`py`/`pt`/`ps`/`m`/`gap`/`space`/`inset` and the
 * rest. Story 170 originally registered the type scale as a
 * `classGroups["font-size"]` override, which worked but only for `text-*`;
 * Story 172 moved it here so all four scales are declared one way.
 *
 * These lists must stay in step with that preset's keys. They are the only
 * place in the repository that restates them, and `cn.spec.ts` asserts the
 * resulting *behaviour* rather than the lists, so a step added to the preset
 * and forgotten here surfaces as a failing merge rather than as an invisible
 * missing or duplicated class.
 */
const TEXT_SCALE = ["caption", "label", "body-sm", "body", "subhead", "heading", "title"];
const SPACING_SCALE = ["tight", "inline", "stack", "surface", "shell", "field-x", "field-y"];
const RADIUS_SCALE = ["surface", "inner", "pill"];
const SHADOW_SCALE = ["resting", "overlay"];

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: TEXT_SCALE,
      spacing: SPACING_SCALE,
      radius: RADIUS_SCALE,
      shadow: SHADOW_SCALE,
    },
  },
});

/** Standard shadcn/ui helper: merges conditional class names, letting a later
 * Tailwind class win over an earlier conflicting one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
