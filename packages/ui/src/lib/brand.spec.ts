import { describe, expect, it } from "vitest";
import {
  BRAND_CONTRAST_SURFACES,
  RECOGNISABLE_SHIFT,
  accentSetPasses,
  brandCssVariables,
  deriveBrandTokens,
  oklchToRgb,
  rgbToOklch,
} from "./brand";
import { contrastRatio, hexToRgb } from "./color";

describe("OKLCH conversion", () => {
  it.each(["#4F46E5", "#16A34A", "#0EA5E9", "#DC2626", "#FACC15", "#0F172A"])(
    "round-trips %s within one channel step",
    (hex) => {
      const rgb = hexToRgb(hex);
      const back = oklchToRgb(rgbToOklch(rgb));
      back.forEach((channel, i) => expect(Math.abs(channel - rgb[i]!)).toBeLessThanOrEqual(1));
    },
  );
});

describe("deriveBrandTokens", () => {
  it("returns null without a valid #rrggbb primary colour", () => {
    expect(deriveBrandTokens(null)).toBeNull();
    expect(deriveBrandTokens("")).toBeNull();
    expect(deriveBrandTokens("indigo")).toBeNull();
  });

  it("keeps the configured colour verbatim as the Tier 1 brand, accepted or not", () => {
    for (const hex of ["#4F46E5", "#FACC15", "#DC2626", "#6B7280"]) {
      expect(deriveBrandTokens(hex)!.brand).toEqual(hexToRgb(hex));
    }
    expect(deriveBrandTokens("#0EA5E9", "#22C55E")!.secondary).toEqual(hexToRgb("#22C55E"));
    expect(deriveBrandTokens("#0EA5E9", "not-a-colour")!.secondary).toBeNull();
  });

  it("uses a brand that already passes exactly as given in light mode", () => {
    const tokens = deriveBrandTokens("#4F46E5")!;
    expect(tokens.rejected).toBeNull();
    expect(tokens.accent!.light.accent).toEqual(hexToRgb("#4F46E5"));
  });

  it.each([
    ["green", "#16A34A"],
    ["sky", "#0EA5E9"],
    ["teal", "#0D9488"],
    ["navy", "#1E3A8A"],
    ["violet", "#7C3AED"],
    ["fuchsia", "#C026D3"],
  ])("accepts a %s brand, darkening/lightening it until every pair passes", (_name, hex) => {
    const tokens = deriveBrandTokens(hex)!;
    expect(tokens.rejected).toBeNull();
    expect(accentSetPasses(tokens.accent!.light, "light")).toBe(true);
    expect(accentSetPasses(tokens.accent!.dark, "dark")).toBe(true);
    // Hue is preserved: the derived accent is still recognisably this brand.
    const hueOf = (rgb: readonly [number, number, number]) => rgbToOklch(rgb).h;
    const drift = Math.abs(hueOf(tokens.accent!.light.accent) - hueOf(hexToRgb(hex))) % 360;
    expect(Math.min(drift, 360 - drift)).toBeLessThan(12);
  });

  it.each([
    ["red", "#DC2626"],
    ["crimson", "#B91C1C"],
    ["rose", "#E11D48"],
    // ~14° from the danger hue: the ~20° band is deliberately conservative.
    ["burnt orange", "#C2410C"],
  ])("rejects a %s accent as alarm-coloured (it would read as destructive)", (_name, hex) => {
    expect(deriveBrandTokens(hex)).toMatchObject({ accent: null, rejected: "alarm" });
  });

  it.each([
    ["grey", "#6B7280"],
    ["black", "#000000"],
    ["slate", "#334155"],
  ])("rejects a %s accent as neutral (it would read as disabled)", (_name, hex) => {
    expect(deriveBrandTokens(hex)).toMatchObject({ accent: null, rejected: "neutral" });
  });

  it.each([
    ["yellow", "#FACC15"],
    ["pastel mint", "#A7F3D0"],
  ])(
    `rejects a %s accent that must move more than ${RECOGNISABLE_SHIFT} lightness to pass`,
    (_name, hex) => {
      expect(deriveBrandTokens(hex)).toMatchObject({ accent: null, rejected: "recognisability" });
    },
  );

  it("never produces an accepted accent that fails a documented pair (sweep)", () => {
    for (let hue = 0; hue < 360; hue += 15) {
      for (const [l, c] of [
        [0.45, 0.15],
        [0.6, 0.18],
        [0.75, 0.12],
      ] as const) {
        const hex = `#${oklchToRgb({ l, c, h: hue })
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")}`;
        const tokens = deriveBrandTokens(hex)!;
        if (tokens.accent) {
          expect(accentSetPasses(tokens.accent.light, "light")).toBe(true);
          expect(accentSetPasses(tokens.accent.dark, "dark")).toBe(true);
          for (const surface of Object.values(BRAND_CONTRAST_SURFACES.dark)) {
            expect(contrastRatio(tokens.accent.dark.accent, surface)).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });
});

describe("brandCssVariables", () => {
  it("is empty without branding", () => {
    expect(brandCssVariables(null)).toEqual({});
  });

  it("emits only Tier 1 variables when the accent is rejected", () => {
    const variables = brandCssVariables(deriveBrandTokens("#DC2626", "#F59E0B"));
    expect(variables).toEqual({ "--brand": "220 38 38", "--brand-secondary": "245 158 11" });
  });

  it("emits light and dark accent families when accepted", () => {
    const variables = brandCssVariables(deriveBrandTokens("#4F46E5"));
    expect(variables["--brand-accent"]).toBe("79 70 229");
    for (const prefix of ["--brand-accent", "--brand-dark-accent"]) {
      for (const suffix of ["", "-hover", "-active", "-foreground", "-surface"]) {
        expect(variables[`${prefix}${suffix}`]).toMatch(/^\d+ \d+ \d+$/);
      }
    }
  });
});
