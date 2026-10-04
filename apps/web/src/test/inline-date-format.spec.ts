/**
 * Story 194 (RD-1.17) regression guard. Every date the two apps show goes
 * through `@crm/ui`'s `formatDateTime`/`formatDate`/`formatTime` with the
 * active UI locale. Inline `toLocale*String(` calls were how four screens
 * ended up formatting dates in the browser's locale instead of the UI's
 * (recon RTL-02), and how 29 sites each carried their own copy of the same
 * decision. Covers both apps by reading the portal's sources from disk, the
 * same way `table-mobile-labels.spec.ts` does.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOTS = [path.resolve(__dirname, ".."), path.resolve(__dirname, "../../../portal/src")];
const INLINE_DATE_FORMAT = /\.toLocale(?:Date|Time)?String\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.spec\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("date formatting", () => {
  it("has no inline toLocale*String( calls in either app", () => {
    const offenders: string[] = [];
    for (const root of APP_ROOTS) {
      for (const file of sourceFiles(root)) {
        readFileSync(file, "utf8")
          .split(/\r?\n/)
          .forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;
            if (INLINE_DATE_FORMAT.test(line)) {
              offenders.push(`${path.relative(root, file)}:${index + 1}  ${trimmed}`);
            }
          });
      }
    }
    expect(
      offenders,
      `Use formatDateTime / formatDate / formatTime from @crm/ui with the UI locale:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
