import { describe, expect, it } from "vitest";
import { cn } from "./cn";

/**
 * Story 170 — the regression guard for the defect that story hit.
 *
 * tailwind-merge's built-in config only knows Tailwind's own `text-xs`…
 * `text-9xl`, so it routed every step of this project's named type scale
 * (`packages/config/tailwind-preset.js`'s `fontSize` key) into its
 * **text-colour** group. `cn("text-subhead text-ink")` therefore saw two
 * colours, resolved the "conflict" in favour of the last, and dropped the
 * size — silently, with the heading rendering at the inherited size.
 *
 * These tests assert the *behaviour* rather than the registered list, so a
 * step added to the preset and forgotten in `cn.ts` fails here instead of
 * shipping as an invisible missing class.
 */
describe("cn", () => {
  it("still merges Tailwind's own conflicting classes, last one winning", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  describe("the project's named type scale", () => {
    const STEPS = ["caption", "label", "body-sm", "body", "subhead", "heading", "title"] as const;

    it.each(STEPS)("keeps text-%s alongside a text colour", (step) => {
      const result = cn(`text-${step}`, "text-ink");

      expect(result).toContain(`text-${step}`);
      expect(result).toContain("text-ink");
    });

    it.each(STEPS)("keeps text-%s when the colour comes first", (step) => {
      const result = cn("text-ink", `text-${step}`);

      expect(result).toContain(`text-${step}`);
      expect(result).toContain("text-ink");
    });

    it("lets one named step override another, since both are sizes", () => {
      expect(cn("text-subhead", "text-title")).toBe("text-title");
    });

    it("lets a named step override one of Tailwind's own sizes, and the reverse", () => {
      expect(cn("text-sm", "text-subhead")).toBe("text-subhead");
      expect(cn("text-title", "text-lg")).toBe("text-lg");
    });
  });
});
