import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseChannels } from "@crm/ui";
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
  for (const match of block.matchAll(/--([a-z-]+):\s*(\d+\s+\d+\s+\d+)\s*;/g)) {
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

  it("carries white text on the destructive fill and its hover", () => {
    expect(contrastRatio(WHITE, get("danger-solid"))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(WHITE, get("danger-solid-hover"))).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
