import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, parseChannels, relativeLuminance, toChannels } from "./color";

describe("color", () => {
  it("parses #rrggbb with or without the hash, case-insensitively", () => {
    expect(hexToRgb("#4F46E5")).toEqual([79, 70, 229]);
    expect(hexToRgb("4f46e5")).toEqual([79, 70, 229]);
  });

  it("rejects anything that is not six hex digits", () => {
    expect(() => hexToRgb("#fff")).toThrow();
    expect(() => hexToRgb("indigo")).toThrow();
  });

  it("round-trips token channel strings", () => {
    expect(parseChannels(" 79 70  229 ")).toEqual([79, 70, 229]);
    expect(toChannels([79.4, 70, 228.6])).toBe("79 70 229");
    expect(() => parseChannels("79 70")).toThrow();
    expect(() => parseChannels("79 70 300")).toThrow();
  });

  it("computes WCAG relative luminance at the extremes", () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 6);
  });

  it("computes WCAG contrast ratios symmetrically", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 6);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBe(1);
    // Indigo-600 on white — the value docs/architecture/13-design-language.md cites.
    const ratio = contrastRatio(hexToRgb("#4F46E5"), hexToRgb("#FFFFFF"));
    expect(ratio).toBeCloseTo(6.29, 2);
    expect(contrastRatio(hexToRgb("#FFFFFF"), hexToRgb("#4F46E5"))).toBe(ratio);
  });
});
