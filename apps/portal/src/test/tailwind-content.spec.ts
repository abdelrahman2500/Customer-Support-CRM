/**
 * Story S-3 regression guard.
 *
 * S-2 moved every shared primitive into `@crm/ui`, which made
 * `packages/ui/src` the only place classes like `bg-accent` or the Select
 * panel's `max-h-[var(--radix-select-content-available-height)]` appear.
 * Tailwind only emits utilities it finds in `content`, so dropping that glob
 * silently ships a stylesheet missing every package-only class — primary
 * buttons render transparent and overlay panels lose their height ceiling,
 * with no build error and no type error to catch it. That is exactly what
 * happened: the glob was present while S-2 was verified but never committed,
 * so `9c62078` shipped broken visuals.
 *
 * Asserting on the config is deliberately cheap. The real proof lives in the
 * built stylesheet, but reading that needs a full `next build`; this catches
 * the only way the glob realistically disappears — an edit to this file.
 */
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";

describe("tailwind content globs", () => {
  const content = config.content as string[];

  it("scans this app's own sources", () => {
    expect(content).toContain("./src/**/*.{ts,tsx}");
  });

  it("scans the shared @crm/ui package", () => {
    expect(
      content.some((glob) => glob.includes("packages/ui/src")),
      "packages/ui/src must be in `content` or every package-only utility is dropped",
    ).toBe(true);
  });
});
