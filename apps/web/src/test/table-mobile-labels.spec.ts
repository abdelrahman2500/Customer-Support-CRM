/**
 * Story 150 regression guard.
 *
 * RM-10 gave `Table` a dual layout: a real `<table>` at `sm` and up, and
 * one stacked card per row below it. In the mobile shape `TableHeader` is
 * `hidden`, so `TableCell`'s `label` prop is the ONLY thing that says what
 * a value means.
 *
 * Nothing enforced that. RM-10 converted three tables and stopped; this
 * story found 93 cells with 17 labels, in 3 of 17 table-bearing files, and
 * Story 149 had already shipped one more unlabelled cell on top. A phone
 * user saw stacks of anonymous values — two indistinguishable dates on
 * "My sessions", two indistinguishable durations on SLA policies.
 *
 * A source-scanning guard, mirroring `design-tokens.spec.ts`'s own
 * approach in this app (and the portal's), because the defect is a missing
 * prop across many files rather than a behaviour in any one of them — a
 * per-component render test would have to be added to each new table to be
 * worth anything, which is exactly the step that gets skipped.
 *
 * ## The allowlist
 *
 * A cell legitimately carries no label when it is not a column of data —
 * the primitive's own doc says to omit it for "a cell that needs no mobile
 * label of its own". Two kinds qualify:
 *
 * - an **actions** cell holding only buttons ("ACTIONS: [Revoke]" is noise);
 * - a **`colSpan`** detail panel, which is an expansion row, not a column.
 *
 * Those are listed explicitly below rather than pattern-matched, so adding
 * one is a deliberate, reviewable act.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOTS = [
  path.resolve(__dirname, ".."),
  path.resolve(__dirname, "../../../portal/src"),
];

/**
 * `<file>:<1-based line>` for every cell that is deliberately unlabelled.
 * Line numbers would rot, so these are keyed by file plus the distinctive
 * text of the cell instead.
 */
const INTENTIONALLY_UNLABELLED: { file: string; because: string; count: number }[] = [
  { file: "api-keys/api-keys-view.tsx", because: "actions cell (Revoke)", count: 1 },
  { file: "roles/role-list-view.tsx", because: "actions cell + colSpan permissions panel", count: 2 },
  { file: "settings/my-sessions-view.tsx", because: "actions cell (Sign out)", count: 1 },
  {
    file: "webhook-subscriptions/webhook-subscriptions-view.tsx",
    because: "actions cell + colSpan delivery-attempts panel",
    count: 2,
  },
  {
    file: "portal/notification-history-view.tsx",
    because: "loading skeleton placeholder cells",
    count: 3,
  },
];

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tsxFiles(full, acc);
    } else if (entry.name.endsWith(".tsx") && !entry.name.includes(".spec.")) {
      acc.push(full);
    }
  }
  return acc;
}

/** Counts `<TableCell ...>` openings and how many carry a `label` prop.
 * Deliberately a scan, not a parse: the shape is unambiguous here and a
 * real parser would be a dependency for one test. */
function countCells(source: string): { total: number; unlabelled: number } {
  const matches = source.matchAll(/<TableCell(\s[\s\S]*?)?>/g);
  let total = 0;
  let unlabelled = 0;
  for (const match of matches) {
    total += 1;
    if (!/\blabel=/.test(match[1] ?? "")) {
      unlabelled += 1;
    }
  }
  return { total, unlabelled };
}

describe("Table mobile labels", () => {
  const perFile = new Map<string, { total: number; unlabelled: number }>();
  for (const root of APP_ROOTS) {
    for (const file of tsxFiles(root)) {
      const counts = countCells(readFileSync(file, "utf8"));
      if (counts.total > 0) {
        perFile.set(path.relative(root, file).replace(/\\/g, "/"), counts);
      }
    }
  }

  it("finds the tables it is meant to be guarding", () => {
    // A sanity check on the scan itself: if a refactor moved or renamed
    // every table, this guard would otherwise pass by finding nothing.
    const totalCells = [...perFile.values()].reduce((sum, c) => sum + c.total, 0);
    expect(perFile.size).toBeGreaterThanOrEqual(15);
    expect(totalCells).toBeGreaterThanOrEqual(85);
  });

  it("gives every data cell a label, except the ones deliberately exempt", () => {
    const allowed = new Map(
      INTENTIONALLY_UNLABELLED.map((entry) => [
        // Match on the tail of the path so both app roots work.
        entry.file,
        entry,
      ]),
    );

    const offenders: string[] = [];
    for (const [file, counts] of perFile) {
      const exemption = [...allowed.entries()].find(([suffix]) => file.endsWith(suffix))?.[1];
      const permitted = exemption?.count ?? 0;
      if (counts.unlabelled > permitted) {
        offenders.push(
          `${file}: ${counts.unlabelled} unlabelled cell(s), ${permitted} allowed` +
            (exemption ? ` (${exemption.because})` : ""),
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps every exemption real, so the allowlist cannot rot", () => {
    // An entry that no longer matches any file, or that allows more cells
    // than the file actually has unlabelled, is stale — fail rather than
    // let the allowlist quietly grow permissive.
    const stale: string[] = [];
    for (const entry of INTENTIONALLY_UNLABELLED) {
      const match = [...perFile.entries()].find(([file]) => file.endsWith(entry.file));
      if (!match) {
        stale.push(`${entry.file}: no such table file`);
      } else if (match[1].unlabelled !== entry.count) {
        stale.push(
          `${entry.file}: allows ${entry.count} but ${match[1].unlabelled} are unlabelled`,
        );
      }
    }

    expect(stale).toEqual([]);
  });
});
