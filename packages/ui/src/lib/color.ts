/**
 * Story 178 (RD-1.1) — WCAG 2.x colour maths shared by the token contrast
 * guard and (RD-1.6) the branch-brand derivation. Pure functions, no DOM.
 *
 * Colours are `[r, g, b]` triples in 0–255, the same shape the design tokens
 * store as space-separated channels (`--accent: 79 70 229`).
 */
export type Rgb = readonly [number, number, number];

/** `#rrggbb` (or `rrggbb`) → `[r, g, b]`. Throws on anything else. */
export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    throw new Error(`Expected a #rrggbb colour, received "${hex}"`);
  }
  const value = match[1]!;
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as unknown as Rgb;
}

/** `"79 70 229"` (a token's channel string) → `[79, 70, 229]`. */
export function parseChannels(channels: string): Rgb {
  const parts = channels.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    throw new Error(`Expected three 0-255 channels, received "${channels}"`);
  }
  return parts as unknown as Rgb;
}

/** `[r, g, b]` → `"r g b"`, the token channel format. */
export function toChannels(rgb: Rgb): string {
  return rgb.map((part) => Math.round(part)).join(" ");
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG 2.x contrast ratio, 1–21. Order of arguments does not matter. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
