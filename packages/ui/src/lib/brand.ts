/**
 * Story 183 (RD-1.6) — the controlled branch-branding model
 * (docs/architecture/13-design-language.md § Branch branding).
 *
 * Tier 1 — identity, always: the raw `primaryColor` becomes `--brand`, used
 * only on decorative surfaces (header brand edge, brand panels). Never text.
 *
 * Tier 2 — interactive accent, only when it passes: the core indigo `accent`
 * family is replaced by one DERIVED from `primaryColor`, separately for light
 * and dark, so that every pair the core accent guarantees still holds:
 *   - accent-foreground on accent / hover / active  ≥ 4.5:1
 *   - accent as link text on surface, sunk and raised ≥ 4.5:1
 *   - accent-hover on accent-surface                  ≥ 4.5:1
 * The derivation keeps the brand's hue and moves only OKLCH lightness (with
 * chroma clipped into the sRGB gamut). Tier 2 is rejected — the core accent
 * stays, Tier 1 still applies — when the brand
 *   (a) would have to move more than RECOGNISABLE_SHIFT in light mode to pass
 *       (very light colours: yellows, pastels),
 *   (b) is effectively neutral (chroma < NEUTRAL_CHROMA): a grey/black
 *       primary would read as disabled or neutral UI, or
 *   (c) sits in the danger-red hue range at high chroma: a red primary
 *       button would read as destructive.
 * Neutrals, focus and every semantic family are never touched here.
 *
 * Pure and domain-free: no DOM, no i18n.
 */
import { contrastRatio, hexToRgb, toChannels } from "./color";
import type { Rgb } from "./color";

export interface AccentSet {
  readonly accent: Rgb;
  readonly hover: Rgb;
  readonly active: Rgb;
  readonly foreground: Rgb;
  readonly surface: Rgb;
}

export type BrandAccentRejection = "recognisability" | "neutral" | "alarm" | "contrast";

export interface BrandTokens {
  /** Tier 1: the configured colour, exactly as given. Decorative use only. */
  readonly brand: Rgb;
  /** Tier 1: decorative gradient partner, if configured. */
  readonly secondary: Rgb | null;
  /** Tier 2: the derived accent families, or null when a gate rejected them. */
  readonly accent: { readonly light: AccentSet; readonly dark: AccentSet } | null;
  readonly rejected: BrandAccentRejection | null;
}

/** The surfaces the derived accent must stay readable on (see tailwind-tokens.css). */
export const BRAND_CONTRAST_SURFACES = {
  light: { surface: [255, 255, 255], sunk: [248, 250, 252], raised: [255, 255, 255] },
  dark: { surface: [15, 23, 42], sunk: [2, 6, 23], raised: [30, 41, 59] },
} as const satisfies Record<"light" | "dark", Record<string, Rgb>>;

const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [15, 23, 42];
const AA = 4.5;
export const RECOGNISABLE_SHIFT = 0.25;
export const NEUTRAL_CHROMA = 0.04;
const ALARM_CHROMA = 0.1;
const ALARM_HUE_DISTANCE = 20;
const STEP = 0.005;

// --- OKLab / OKLCH (Björn Ottosson's reference matrices) --------------------

interface Lch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

const toLinear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255;

export function rgbToOklch([r8, g8, b8]: Rgb): Lch {
  const [r, g, b] = [toLinear(r8), toLinear(g8), toLinear(b8)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

function oklchToLinear({ l: L, c, h }: Lch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH → sRGB, clipping chroma (never hue or lightness) into the gamut. */
export function oklchToRgb(lch: Lch): Rgb {
  const l = Math.min(1, Math.max(0, lch.l));
  let lo = 0;
  let hi = lch.c;
  let linear = oklchToLinear({ ...lch, l });
  if (!inGamut(linear)) {
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...lch, l, c: mid }))) lo = mid;
      else hi = mid;
    }
    linear = oklchToLinear({ ...lch, l, c: lo });
  }
  return linear.map((v) => Math.round(Math.min(255, Math.max(0, fromLinear(Math.min(1, Math.max(0, v))))))) as unknown as Rgb;
}

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const DANGER_HUE = rgbToOklch([220, 38, 38]).h;

// --- Derivation --------------------------------------------------------------

function readable(color: Rgb, surfaces: Record<string, Rgb>): boolean {
  return Object.values(surfaces).every((surface) => contrastRatio(color, surface) >= AA);
}

/** Every pair the core accent guarantees, for one theme. */
export function accentSetPasses(set: AccentSet, theme: "light" | "dark"): boolean {
  const surfaces = BRAND_CONTRAST_SURFACES[theme];
  return (
    [set.accent, set.hover, set.active].every((fill) => contrastRatio(set.foreground, fill) >= AA) &&
    readable(set.accent, surfaces) &&
    contrastRatio(set.hover, set.surface) >= AA
  );
}

function deriveLight(base: Lch): AccentSet | "recognisability" {
  let l = base.l;
  let accent = oklchToRgb(base);
  while (!(contrastRatio(WHITE, accent) >= AA && readable(accent, BRAND_CONTRAST_SURFACES.light))) {
    l -= STEP;
    if (base.l - l > RECOGNISABLE_SHIFT) {
      return "recognisability";
    }
    accent = oklchToRgb({ ...base, l });
  }
  return {
    accent,
    hover: oklchToRgb({ ...base, l: l - 0.06 }),
    active: oklchToRgb({ ...base, l: l - 0.12 }),
    foreground: WHITE,
    surface: oklchToRgb({ l: 0.965, c: Math.min(base.c, 0.035), h: base.h }),
  };
}

function deriveDark(base: Lch): AccentSet | null {
  // Dark surfaces need a LIGHTER accent; hue is preserved, so the brand stays
  // recognisable even when a dark primary has to lift a long way.
  let l = Math.max(base.l, 0.5);
  let accent = oklchToRgb({ ...base, l });
  while (!readable(accent, BRAND_CONTRAST_SURFACES.dark)) {
    l += STEP;
    if (l > 0.95) {
      return null;
    }
    accent = oklchToRgb({ ...base, l });
  }
  const foreground = contrastRatio(INK, accent) >= AA ? INK : WHITE;
  const direction = foreground === INK ? 1 : -1;
  return {
    accent,
    hover: oklchToRgb({ ...base, l: Math.min(0.97, l + direction * 0.06) }),
    active: oklchToRgb({ ...base, l: Math.min(0.98, l + direction * 0.11) }),
    foreground,
    surface: oklchToRgb({ l: 0.28, c: Math.min(base.c, 0.08), h: base.h }),
  };
}

/**
 * Derives a branch's brand tokens from its configured `#rrggbb` colours.
 * Returns null when no valid primary colour is configured (core design only).
 */
export function deriveBrandTokens(
  primaryHex: string | null | undefined,
  secondaryHex?: string | null,
): BrandTokens | null {
  let brand: Rgb;
  try {
    brand = hexToRgb(primaryHex ?? "");
  } catch {
    return null;
  }
  let secondary: Rgb | null = null;
  try {
    secondary = secondaryHex ? hexToRgb(secondaryHex) : null;
  } catch {
    secondary = null;
  }

  const base = rgbToOklch(brand);
  const reject = (rejected: BrandAccentRejection): BrandTokens => ({ brand, secondary, accent: null, rejected });

  if (base.c < NEUTRAL_CHROMA) return reject("neutral");
  if (base.c >= ALARM_CHROMA && hueDistance(base.h, DANGER_HUE) < ALARM_HUE_DISTANCE) return reject("alarm");

  const light = deriveLight(base);
  if (light === "recognisability") return reject("recognisability");
  const dark = deriveDark(base);
  if (!dark || !accentSetPasses(light, "light") || !accentSetPasses(dark, "dark")) return reject("contrast");

  return { brand, secondary, accent: { light, dark }, rejected: null };
}

/**
 * The CSS custom properties that apply `tokens`. `--brand*` (Tier 1) always;
 * `--brand-accent*` / `--brand-dark-accent*` (Tier 2) only when accepted — the
 * `[data-brand-accent]` rules in tailwind-tokens.css read them. Pair with
 * `data-brand-accent` on the same element when `tokens.accent` is non-null.
 */
export function brandCssVariables(tokens: BrandTokens | null): Record<string, string> {
  if (!tokens) {
    return {};
  }
  const variables: Record<string, string> = { "--brand": toChannels(tokens.brand) };
  // Without a configured partner, the gradient partner is the brand itself.
  variables["--brand-secondary"] = toChannels(tokens.secondary ?? tokens.brand);
  if (tokens.accent) {
    for (const [theme, prefix] of [
      ["light", "--brand-accent"],
      ["dark", "--brand-dark-accent"],
    ] as const) {
      const set = tokens.accent[theme];
      variables[prefix] = toChannels(set.accent);
      variables[`${prefix}-hover`] = toChannels(set.hover);
      variables[`${prefix}-active`] = toChannels(set.active);
      variables[`${prefix}-foreground`] = toChannels(set.foreground);
      variables[`${prefix}-surface`] = toChannels(set.surface);
    }
  }
  return variables;
}
