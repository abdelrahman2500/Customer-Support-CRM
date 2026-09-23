import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Story 134's named type scale (`packages/config/tailwind-preset.js`'s
 * `fontSize` key) is invisible to tailwind-merge's built-in config, which
 * only knows Tailwind's own `text-xs`…`text-9xl`. Anything else spelled
 * `text-*` falls through to its **text-colour** group — so `cn("text-subhead
 * text-ink")` saw two colours, resolved the "conflict" in favour of the last
 * one, and silently emitted `text-ink` alone. The heading rendered at the
 * inherited size with no error anywhere.
 *
 * Measured against the real `CardTitle` while implementing Story 170: the
 * rendered class list was `text-ink`, with `text-subhead` gone. Every
 * component in this package styles through `cn`, so for as long as this was
 * unregistered the scale was effectively unusable anywhere inside
 * `@crm/ui` — which is part of why it sat at zero adoption from Story 134
 * until Story 168 spent it on a plain `<h1>` that never went through `cn`.
 *
 * Registering the seven steps in the `font-size` group fixes both halves at
 * once: a size and a colour stop conflicting, and two of these steps still
 * correctly override each other.
 *
 * This list must stay in step with that preset's `fontSize` keys. It is the
 * only place in the repository that restates them, and `cn.spec.ts` asserts
 * the behaviour rather than the list, so a step added to the preset and
 * forgotten here shows up as a dropped class, not a type error.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["caption", "label", "body-sm", "body", "subhead", "heading", "title"] },
      ],
    },
  },
});

/** Standard shadcn/ui helper: merges conditional class names, letting a later
 * Tailwind class win over an earlier conflicting one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
