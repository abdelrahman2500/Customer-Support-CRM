import { describe, expect, it } from "vitest";
import {
  menuCheckableItemClassName,
  menuContentClassName,
  menuItemClassName,
  menuLabelClassName,
  menuSeparatorClassName,
} from "./menu";

/**
 * Story 166 — the menu/select focus indicator used to be `focus:bg-surface-muted`
 * alone. `--surface` (255 255 255) against `--surface-muted` (241 245 249)
 * measures 1.10:1, well under WCAG 2.4.11's 3:1 focus-indicator minimum, and the
 * class string also removes the native outline, so there was nothing else left to
 * see. Because one constant styles every `DropdownMenuItem` and every
 * `SelectItem`, a regression here is invisible in any single component's test —
 * hence an invariant pinned on the constant itself, in the shape
 * `icons.spec.ts` already uses for a `lib/` module.
 */
describe("menuItemClassName", () => {
  it("carries the shared always-on focus ring", () => {
    expect(menuItemClassName).toContain("focus-ring-always");
  });

  it("keeps the focus tint as a second, redundant cue rather than a replacement", () => {
    expect(menuItemClassName).toContain("focus:bg-surface-muted");
  });

  it("uses no raw palette literal", () => {
    expect(menuItemClassName).not.toMatch(/slate-\d/);
    expect(menuItemClassName).not.toMatch(/blue-\d/);
  });

  // Story 187 (RD-1.10) — a plain menu row no longer reserves the check-mark
  // gutter (recon §2.3); only checkable rows opt in to it.
  it("keeps symmetric, direction-neutral geometry without a check gutter", () => {
    expect(menuItemClassName).toContain("px-2");
    expect(menuItemClassName).toContain("rounded-inner");
    expect(menuItemClassName.split(" ")).not.toContain("ps-8");
    expect(menuItemClassName).not.toMatch(/\bpl-|\bpr-/);
  });
});

describe("menuCheckableItemClassName (Story 187)", () => {
  it("is exactly the reading-start check-mark gutter", () => {
    expect(menuCheckableItemClassName).toBe("ps-8");
  });
});

/**
 * The other three constants are deliberately untouched by Story 166 — the
 * containers already supply the 4px (`p-1`) the ring's offset needs, so nothing
 * had to grow to make room for it. Pinned so that stays true.
 */
describe("the surrounding menu constants", () => {
  it("leaves the panel's padding able to contain the item's focus ring", () => {
    expect(menuContentClassName).toContain("p-1");
  });

  it("puts the label on the named type scale and leaves the separator untouched", () => {
    // Story 187 — `text-label` replaces the raw `text-xs font-semibold`.
    expect(menuLabelClassName).toBe("px-2 py-1.5 text-label text-ink-subtle");
    expect(menuSeparatorClassName).toBe("-mx-1 my-1 h-px bg-rule");
  });

  it("is the raised floating surface with open/close motion (Story 187)", () => {
    for (const token of [
      "bg-surface-raised",
      "shadow-raised",
      "rounded-control",
      "data-[state=open]:animate-zoom-in",
      "data-[state=closed]:animate-zoom-out",
    ]) {
      expect(menuContentClassName).toContain(token);
    }
  });

  it("gives neither a focus treatment of its own", () => {
    expect(menuLabelClassName).not.toContain("focus");
    expect(menuSeparatorClassName).not.toContain("focus");
  });
});
