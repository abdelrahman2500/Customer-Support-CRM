import { describe, expect, it } from "vitest";
import {
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

  it("keeps its reading-direction-relative geometry", () => {
    expect(menuItemClassName).toContain("ps-8");
    expect(menuItemClassName).toContain("pe-2");
    expect(menuItemClassName).not.toMatch(/\bpl-|\bpr-/);
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

  it("leaves the label and separator untouched", () => {
    expect(menuLabelClassName).toBe("px-2 py-1.5 text-xs font-semibold text-ink-subtle");
    expect(menuSeparatorClassName).toBe("-mx-1 my-1 h-px bg-rule");
  });

  it("gives neither a focus treatment of its own", () => {
    expect(menuLabelClassName).not.toContain("focus");
    expect(menuSeparatorClassName).not.toContain("focus");
  });
});
