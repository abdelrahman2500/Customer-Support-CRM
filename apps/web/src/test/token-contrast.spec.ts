import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sharedThemeExtend from "@crm/config/tailwind-preset";
import { CORE_PREVIEW_PALETTE, contrastRatio, parseChannels } from "@crm/ui";
import type { Rgb } from "@crm/ui";

/**
 * Story 178 (RD-1.1) — guards the WCAG contrast promises that
 * docs/architecture/13-design-language.md makes about the design tokens.
 * It reads the real token file, so a palette edit that breaks a pair
 * fails here rather than in someone's eyes.
 */
const TOKENS = resolve(__dirname, "../../../../packages/config/tailwind-tokens.css");

function readThemeBlock(source: string, selector: string): Map<string, Rgb> {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) {
    throw new Error(`No "${selector} {" block in tailwind-tokens.css`);
  }
  const end = source.indexOf("}", start);
  const block = source.slice(start, end);
  const tokens = new Map<string, Rgb>();
  // Story 210 (PR-1.1) — token names may carry digits (`--viz-1`).
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(\d+\s+\d+\s+\d+)\s*;/g)) {
    tokens.set(match[1]!, parseChannels(match[2]!));
  }
  return tokens;
}

const WHITE: Rgb = [255, 255, 255];
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

type Pair = readonly [foreground: string, background: string, minimum: number];

const SEMANTIC_FAMILIES = ["success", "warning", "danger", "info", "progress"] as const;

const LIGHT_PAIRS: Pair[] = [
  ["ink", "surface", AA_TEXT],
  ["ink-strong", "surface", AA_TEXT],
  ["ink-muted", "surface", AA_TEXT],
  ["ink-muted", "surface-muted", AA_TEXT],
  ["ink-subtle", "surface", AA_TEXT],
  ["ink-subtle", "surface-sunk", AA_TEXT],
  ["ink-subtle", "surface-raised", AA_TEXT],
  ["ink-subtle", "surface-muted", AA_TEXT],
  ["ink-subtle", "accent-surface", AA_TEXT],
  ["accent-foreground", "accent", AA_TEXT],
  ["accent-foreground", "accent-hover", AA_TEXT],
  ["accent-foreground", "accent-active", AA_TEXT],
  ["accent", "surface", AA_TEXT],
  ["accent", "surface-sunk", AA_TEXT],
  ["accent-hover", "accent-surface", AA_TEXT],
  ["focus", "surface", AA_NON_TEXT],
  ["focus", "surface-sunk", AA_NON_TEXT],
  ["rule-control", "surface", AA_NON_TEXT],
  ["rule-control", "surface-sunk", AA_NON_TEXT],
  ...SEMANTIC_FAMILIES.flatMap((family): Pair[] => [
    [`${family}-foreground`, "surface", AA_TEXT],
    [`${family}-foreground`, `${family}-subtle`, AA_TEXT],
    [`${family}-foreground`, `${family}-surface`, AA_TEXT],
    [`${family}-solid`, "surface", AA_NON_TEXT],
  ]),
  // Story 210 (PR-1.1) — the ink chrome (rail and header band).
  ["chrome-ink", "chrome", AA_TEXT],
  ["chrome-ink", "chrome-raised", AA_TEXT],
  ["chrome-ink", "chrome-active", AA_TEXT],
  ["chrome-muted", "chrome", AA_TEXT],
  ["chrome-muted", "chrome-raised", AA_TEXT],
  ["chrome-accent", "chrome", AA_NON_TEXT],
  ["chrome-accent", "chrome-active", AA_NON_TEXT],
  // Story 210 — the chart palette on cards and the status spine on the canvas.
  ...[1, 2, 3, 4, 5, 6].map((n): Pair => [`viz-${n}`, "surface", AA_NON_TEXT]),
  ...(["info", "progress", "success"] as const).map((family): Pair => [
    `${family}-solid`,
    "surface-sunk",
    AA_NON_TEXT,
  ]),
  ["rule-control", "surface-sunk", AA_NON_TEXT],
];

describe("design token contrast (light)", () => {
  const tokens = readThemeBlock(readFileSync(TOKENS, "utf8"), ":root");
  const get = (name: string): Rgb => {
    const value = tokens.get(name);
    if (!value) {
      throw new Error(`Token --${name} is not defined in the light :root block`);
    }
    return value;
  };

  it.each(LIGHT_PAIRS)("--%s on --%s meets %s:1", (foreground, background, minimum) => {
    expect(contrastRatio(get(foreground), get(background))).toBeGreaterThanOrEqual(minimum);
  });

  it("resets letter-spacing on every tracked type step for Arabic (Story 179)", () => {
    const source = readFileSync(TOKENS, "utf8");
    for (const step of ["label", "heading", "title", "display"]) {
      expect(source).toContain(`:lang(ar) .text-${step}`);
    }
  });

  it("neutralises animation and transition under prefers-reduced-motion (Story 179)", () => {
    const source = readFileSync(TOKENS, "utf8");
    const rule = source.slice(source.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(rule).toContain("animation-duration: 0.01ms !important");
    expect(rule).toContain("transition-duration: 0.01ms !important");
  });

  // Story 210 (PR-1.1) — the page focus colour is too dark for the ink
  // chrome, so chrome surfaces scope the ring to --chrome-accent instead.
  it("scopes the focus ring to the chrome accent on chrome surfaces", () => {
    const source = readFileSync(TOKENS, "utf8");
    expect(source).toMatch(/\.on-chrome \{\s*--focus: var\(--chrome-accent\);/);
    expect(contrastRatio(get("chrome-accent"), get("chrome"))).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(get("chrome-accent"), get("chrome-raised"))).toBeGreaterThanOrEqual(
      AA_NON_TEXT,
    );
  });

  it("carries white text on the destructive fill and its hover", () => {
    expect(contrastRatio(WHITE, get("danger-solid"))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(WHITE, get("danger-solid-hover"))).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

/**
 * Story 181 (RD-1.4) — the dark theme. The explicit `[data-theme="dark"]`
 * block and the `prefers-color-scheme` ("system") copy must carry identical
 * values, and every pair the light theme promises must hold in dark too.
 */
describe("design token contrast (dark)", () => {
  const source = readFileSync(TOKENS, "utf8");
  const dark = readThemeBlock(source, ':root[data-theme="dark"]');
  const system = readThemeBlock(source, ':root:not([data-theme="light"])');
  const get = (name: string): Rgb => {
    const value = dark.get(name);
    if (!value) {
      throw new Error(`Token --${name} is not defined in the dark block`);
    }
    return value;
  };

  it("defines the system-preference block identically to the explicit dark block", () => {
    expect(dark.size).toBeGreaterThan(40);
    expect(Object.fromEntries(system)).toEqual(Object.fromEntries(dark));
  });

  it("redefines every colour token the light theme defines, except the constant logo plate", () => {
    const light = readThemeBlock(source, ":root");
    const missing = [...light.keys()].filter((name) => name !== "logo-plate" && !dark.has(name));
    expect(missing).toEqual([]);
  });

  it.each(LIGHT_PAIRS)("--%s on --%s meets %s:1", (foreground, background, minimum) => {
    expect(contrastRatio(get(foreground), get(background))).toBeGreaterThanOrEqual(minimum);
  });

  it("keeps the accent readable on raised surfaces (menus, dialogs)", () => {
    expect(contrastRatio(get("accent"), get("surface-raised"))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(get("focus"), get("surface-raised"))).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(get("rule-control"), get("surface-raised"))).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it("carries the destructive foreground on the fill and its hover", () => {
    expect(contrastRatio(get("danger-solid-foreground"), get("danger-solid"))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(get("danger-solid-foreground"), get("danger-solid-hover"))).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });
});

/**
 * Story 184 (RD-1.7) — the branding preview renders light and dark side by
 * side from CORE_PREVIEW_PALETTE, so it must mirror the real tokens.
 */
describe("CORE_PREVIEW_PALETTE mirrors the token file", () => {
  const source = readFileSync(TOKENS, "utf8");
  const blocks = {
    light: readThemeBlock(source, ":root"),
    dark: readThemeBlock(source, ':root[data-theme="dark"]'),
  };
  const TOKEN_FOR = {
    brand: "brand",
    surface: "surface",
    sunk: "surface-sunk",
    ink: "ink",
    inkMuted: "ink-muted",
    rule: "rule",
    infoSurface: "info-surface",
    infoForeground: "info-foreground",
  } as const;

  it.each(["light", "dark"] as const)("matches the %s tokens", (theme) => {
    const palette = CORE_PREVIEW_PALETTE[theme];
    const tokens = blocks[theme];
    for (const [key, token] of Object.entries(TOKEN_FOR)) {
      expect([...palette[key as keyof typeof TOKEN_FOR]], key).toEqual(tokens.get(token));
    }
    for (const [key, token] of Object.entries({
      accent: "accent",
      hover: "accent-hover",
      active: "accent-active",
      foreground: "accent-foreground",
      surface: "accent-surface",
    })) {
      expect([...palette.accent[key as keyof typeof palette.accent]], key).toEqual(tokens.get(token));
    }
  });
});

/**
 * Story 187 (RD-1.10) — overlay motion and the comfortable card padding.
 * A dialog is centred with translate(-50%, -50%); a zoom keyframe that
 * animated `transform` would overwrite that while the dialog opens.
 */
describe("surface and overlay tokens (Story 187)", () => {
  it.each(["zoom-in", "zoom-out"])("%s animates scale and opacity, never transform", (name) => {
    const frames = (sharedThemeExtend as { keyframes: Record<string, Record<string, object>> })
      .keyframes[name]!;
    for (const step of Object.values(frames)) {
      expect(step).not.toHaveProperty("transform");
      expect(step).toHaveProperty("scale");
    }
  });

  it("gives cards the comfortable 1.25rem padding through --space-surface", () => {
    const source = readFileSync(TOKENS, "utf8");
    const light = source.slice(source.indexOf(":root {"), source.indexOf("}", source.indexOf(":root {")));
    expect(light).toMatch(/--space-surface:\s*1\.25rem;/);
  });
});
