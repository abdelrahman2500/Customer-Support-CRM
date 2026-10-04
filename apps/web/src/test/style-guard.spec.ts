import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Story 180 (RD-1.3) — the repository-wide styling guard for the design
 * language (docs/architecture/13-design-language.md). Scans production
 * `.ts`/`.tsx` in apps/web, apps/portal and packages/ui and fails on:
 *
 *  - a raw Tailwind palette class (`text-emerald-600`, `bg-white`, …): colour
 *    must come from semantic tokens so it follows light/dark themes and stays
 *    out of reach of branch branding;
 *  - a physical-direction utility (`ml-2`, `text-left`, `border-r`, …): layout
 *    must use logical properties so RTL mirrors by construction;
 *  - a `dark:` variant outside packages/ui: themes are produced by tokens,
 *    not by per-screen overrides.
 *
 * Comment lines are ignored (the codebase's doc comments quote historical
 * class strings), as are `*.spec.*` files and the test setup folders.
 */
const REPO = resolve(__dirname, "../../../..");
const ROOTS = ["apps/web/src", "apps/portal/src", "packages/ui/src"];

const BOUNDARY_BEFORE = String.raw`(?:^|[\s"'\`:{(])`;
const BOUNDARY_AFTER = String.raw`(?=[\s"'\`)}]|$)`;

const PALETTE_FAMILIES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RAW_PALETTE = new RegExp(
  `${BOUNDARY_BEFORE}(?:bg|text|border|ring|ring-offset|divide|fill|stroke|from|via|to|outline|placeholder|decoration|caret|accent|shadow)-` +
    `(?:(?:${PALETTE_FAMILIES})-\\d{2,3}|white|black)(?:\\/\\d{1,3})?${BOUNDARY_AFTER}`,
);

/** A Tailwind value — number/fraction, keyword or arbitrary `[..]` — so prose
 * such as "right-aligned" in a multi-line JSX comment is not a utility. */
const VALUE = String.raw`(?:\d[\w./]*|px|auto|full|\[[^\]]+\])`;
const PHYSICAL_DIRECTION = new RegExp(
  `${BOUNDARY_BEFORE}-?(?:` +
    `(?:m|p|scroll-m|scroll-p)[lr]-${VALUE}|` +
    `(?:left|right)-${VALUE}|` +
    String.raw`border-[lr](?:-\d+)?|` +
    String.raw`rounded-(?:[lr]|[tb][lr])(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|control|surface|inner|pill))?|` +
    String.raw`text-(?:left|right)|float-(?:left|right)|clear-(?:left|right)|` +
    `space-x-${VALUE}` +
    `)${BOUNDARY_AFTER}`,
);

const DARK_VARIANT = new RegExp(`${BOUNDARY_BEFORE}dark:`);

/**
 * `-solid` is the fill/icon step (≥ 3:1), not a text step — sky `info-solid`
 * is only 4.10:1 on white and `danger-solid` 3.70:1 on the dark surface.
 * Text uses `-foreground` (docs/architecture/13-design-language.md).
 */
const SOLID_AS_TEXT = new RegExp(
  `${BOUNDARY_BEFORE}(?:[\\w-]+:)*text-(?:success|warning|danger|info|progress)-solid${BOUNDARY_AFTER}`,
);
/** Files whose `text-*-solid` colours an icon-only control (non-text, 3:1). */
const SOLID_AS_TEXT_ALLOWED = new Set([
  // The dismiss button renders only CloseIcon, with an aria-label.
  "packages/ui/src/components/success-toaster.tsx",
]);

function productionFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "test" || entry === "node_modules") continue;
      files.push(...productionFiles(path));
    } else if (/\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) {
      files.push(path);
    }
  }
  return files;
}

function isComment(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("{/*")
  );
}

function violations(pattern: RegExp, roots: string[]): string[] {
  const found: string[] = [];
  for (const root of roots) {
    for (const file of productionFiles(join(REPO, root))) {
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (!isComment(line) && pattern.test(line)) {
            found.push(`${relative(REPO, file)}:${index + 1}: ${line.trim()}`);
          }
        });
    }
  }
  return found;
}

describe("style guard patterns", () => {
  it.each([
    "text-emerald-600",
    'className="bg-white p-4"',
    "hover:bg-red-500",
    "border-red-200",
    "text-black/50",
  ])("flags the raw palette class in %s", (sample) => {
    expect(RAW_PALETTE.test(sample)).toBe(true);
  });

  it.each(["text-danger-foreground", "bg-surface", "border-rule-control", "text-ink-subtle"])(
    "accepts the semantic token %s",
    (sample) => {
      expect(RAW_PALETTE.test(sample)).toBe(false);
    },
  );

  it.each(["ml-2", "pr-4", "-mr-1", "left-0", "text-right", "border-l-2", "rounded-tl-md", "space-x-2"])(
    "flags the physical-direction utility %s",
    (sample) => {
      expect(PHYSICAL_DIRECTION.test(`className="${sample}"`)).toBe(true);
    },
  );

  it.each([
    "ms-2",
    "pe-4",
    "start-0",
    "text-start",
    "border-s-2",
    "rounded-ss-md",
    "gap-x-2",
    'side="left"',
    "four right-aligned numbers",
  ])(
    "accepts %s",
    (sample) => {
      expect(PHYSICAL_DIRECTION.test(`className="${sample}"`)).toBe(false);
    },
  );

  it("flags a -solid step used as text, but not the fill or its foreground", () => {
    expect(SOLID_AS_TEXT.test('className="text-danger-solid"')).toBe(true);
    expect(SOLID_AS_TEXT.test('className="hover:text-info-solid"')).toBe(true);
    expect(SOLID_AS_TEXT.test('className="text-danger-solid-foreground"')).toBe(false);
    expect(SOLID_AS_TEXT.test('className="bg-danger-solid"')).toBe(false);
  });

  it("flags a dark: variant", () => {
    expect(DARK_VARIANT.test('className="dark:bg-surface"')).toBe(true);
    expect(DARK_VARIANT.test("const darkMode = true")).toBe(false);
  });
});

describe("design-language style guard", () => {
  it("finds production files in every scanned package", () => {
    for (const root of ROOTS) {
      expect(productionFiles(join(REPO, root)).length).toBeGreaterThan(0);
    }
  });

  it("uses no raw Tailwind palette class", () => {
    expect(violations(RAW_PALETTE, ROOTS)).toEqual([]);
  });

  it("uses no physical-direction utility", () => {
    expect(violations(PHYSICAL_DIRECTION, ROOTS)).toEqual([]);
  });

  it("keeps dark: variants inside packages/ui", () => {
    expect(violations(DARK_VARIANT, ["apps/web/src", "apps/portal/src"])).toEqual([]);
  });

  it("colours text with -foreground, never a -solid step", () => {
    const found = violations(SOLID_AS_TEXT, ROOTS).filter(
      (entry) => !SOLID_AS_TEXT_ALLOWED.has(entry.slice(0, entry.indexOf(":")).replace(/\\/g, "/")),
    );
    expect(found).toEqual([]);
  });
});
