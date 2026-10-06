import { defineConfig, devices } from "@playwright/test";

/**
 * Story 234 (PR-7.1, decision PD-9) — the local visual regression baseline.
 *
 * Deliberately separate from `playwright.config.ts`: CI runs that config
 * (`pnpm --filter @crm/e2e test`, `testDir: ./tests`), so these screenshot
 * tests never gate CI. Baselines depend on fonts, the OS renderer and the
 * demo dataset, which differ between machines — they are a local tool for
 * catching visual regressions before a commit, run against servers you have
 * already started:
 *
 *     DEMO_USER_PASSWORD=… pnpm --filter @crm/api prisma:seed:demo
 *     pnpm --filter @crm/api start & pnpm --filter @crm/web start & pnpm --filter @crm/portal start
 *     DEMO_USER_PASSWORD=… pnpm --filter @crm/e2e test:visual            # compare
 *     DEMO_USER_PASSWORD=… pnpm --filter @crm/e2e test:visual:update     # re-baseline
 *
 * Reseed right before a run: the demo dataset's timestamps are relative to
 * when it was seeded, so SLA states and orderings are only reproducible
 * shortly after a seed. Digits are normalised before each capture (see the
 * spec), so clock-dependent text never causes a diff on its own.
 */
export default defineConfig({
  testDir: "./visual",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      // Anti-aliasing differs slightly between runs of the same renderer.
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    ...devices["Desktop Chrome"],
    trace: "off",
  },
  projects: [{ name: "chromium" }],
});
