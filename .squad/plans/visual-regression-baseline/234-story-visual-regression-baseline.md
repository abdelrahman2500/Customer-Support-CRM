# Story 234 — Visual regression baseline

> CRM product redesign roadmap item **PR-7.1** (PD-9). Intake: [`../../stories/visual-regression-baseline/visual-regression-baseline/intake.md`](../../stories/visual-regression-baseline/visual-regression-baseline/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 7.

## Prerequisites

Stories 232, 233.

## Story Goal

Committed screenshot baselines for the hero screens, run locally.

**Non-goals:** CI gating; screenshots of every route.

## Design decisions

1. **`apps/e2e/playwright.visual.config.ts`** — `testDir: ./visual`, one worker, `snapshotPathTemplate: {testDir}/__screenshots__/{arg}{ext}`, `animations: disabled`, `caret: hide`, `maxDiffPixelRatio: 0.01`; no `webServer` (runs against started servers). CI's `pnpm --filter @crm/e2e test` uses the default config (`./tests`), so it never runs these.
2. **`visual/hero-screens.spec.ts`** — per variant (en/ar × light/dark) and width (1280/390): logins (anonymous), agent workspace (dashboard, board, a known demo ticket) as `sara`, portal (home, the same ticket) as `layla`; skipped without `DEMO_USER_PASSWORD`.
3. **Stability** — every digit in the page's text becomes `0` before capture (dates, times, SLA durations and counts move with each seed); reseed right before running.
4. **Scripts** — `test:visual`, `test:visual:update`; `tsconfig.json` includes the config and `visual/`.

## Verification Steps

1. Reseed, `test:visual:update` (24 tests, 56 baselines), then `test:visual` twice (24/24 each).
2. e2e typecheck/lint; Playwright default suite 10/10.

## Done Criteria

- [ ] Baselines committed and stable; CI unchanged.
