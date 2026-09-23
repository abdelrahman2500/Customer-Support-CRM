import { describe, expect, it } from "vitest";
import { cn } from "./cn";

/**
 * Stories 170 and 172 — the regression guard for the two ways tailwind-merge
 * mishandles a class built from a project-specific scale key.
 *
 * Both were measured against the real components before being fixed, and
 * both were silent:
 *
 *   - An unknown `text-*` was read as a *colour*, so `cn("text-subhead
 *     text-ink")` emitted `text-ink` alone and the size was **dropped**.
 *   - An unknown `p-*`/`rounded-*`/`shadow-*` matched no group, so nothing
 *     conflicted and both classes survived — `cn("p-surface", "p-shell")`
 *     emitted both, meaning two steps of the same scale did **not** override
 *     each other and a caller could not replace a component's own spacing.
 *
 * These assert the *behaviour* for every step of every scale rather than the
 * registered lists, so a step added to `tailwind-preset.js` and forgotten in
 * `cn.ts` fails here instead of shipping as an invisible class bug.
 */
const TEXT_SCALE = ["caption", "label", "body-sm", "body", "subhead", "heading", "title"] as const;
const SPACING_SCALE = [
  "tight",
  "inline",
  "stack",
  "surface",
  "shell",
  "field-x",
  "field-y",
] as const;
const RADIUS_SCALE = ["surface", "inner", "pill"] as const;
const SHADOW_SCALE = ["resting", "overlay"] as const;

describe("cn", () => {
  it("still merges Tailwind's own conflicting classes, last one winning", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
    expect(cn("rounded-sm", "rounded-lg")).toBe("rounded-lg");
  });

  it("still keeps classes that genuinely do not conflict", () => {
    expect(cn("w-full", "max-w-sm")).toBe("w-full max-w-sm");
    // Tailwind's own semantics: an axis utility narrows a shorthand rather
    // than replacing it, and tailwind-merge keeps both for that reason.
    expect(cn("p-surface", "px-2")).toBe("p-surface px-2");
  });

  describe("the named type scale", () => {
    it.each(TEXT_SCALE)("keeps text-%s alongside a text colour", (step) => {
      const result = cn(`text-${step}`, "text-ink");

      expect(result).toContain(`text-${step}`);
      expect(result).toContain("text-ink");
    });

    it.each(TEXT_SCALE)("keeps text-%s when the colour comes first", (step) => {
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

  describe("the named spacing scale", () => {
    it.each(SPACING_SCALE)("lets p-%s override Tailwind's own padding", (step) => {
      expect(cn("p-4", `p-${step}`)).toBe(`p-${step}`);
    });

    it.each(SPACING_SCALE)("lets Tailwind's own padding override p-%s", (step) => {
      expect(cn(`p-${step}`, "p-4")).toBe("p-4");
    });

    it("lets one named step override another", () => {
      expect(cn("p-surface", "p-shell")).toBe("p-shell");
      expect(cn("gap-inline", "gap-stack")).toBe("gap-stack");
    });

    /** One `theme.spacing` entry has to reach every group that reads the
     * scale, not just `p-*` — this is what makes that true. */
    it("reaches the other spacing-driven groups too", () => {
      expect(cn("gap-2", "gap-inline")).toBe("gap-inline");
      expect(cn("px-3", "px-field-x")).toBe("px-field-x");
      expect(cn("py-2", "py-field-y")).toBe("py-field-y");
      expect(cn("mb-2", "mb-stack")).toBe("mb-stack");
      expect(cn("mt-stack", "mt-1")).toBe("mt-1");
    });
  });

  describe("the named radius scale", () => {
    it.each(RADIUS_SCALE)("lets rounded-%s override Tailwind's own radius", (step) => {
      expect(cn("rounded-md", `rounded-${step}`)).toBe(`rounded-${step}`);
    });

    it("lets one named step override another", () => {
      expect(cn("rounded-surface", "rounded-pill")).toBe("rounded-pill");
    });
  });

  describe("the named elevation scale", () => {
    it.each(SHADOW_SCALE)("lets shadow-%s override Tailwind's own shadow", (step) => {
      expect(cn("shadow-sm", `shadow-${step}`)).toBe(`shadow-${step}`);
    });

    it("lets one named step override another", () => {
      expect(cn("shadow-resting", "shadow-overlay")).toBe("shadow-overlay");
    });
  });
});
