# crm-ui-ux-redesign — progress

Live status of the redesign track. Plan: [`00-overview.md`](./00-overview.md) · audit: [`recon.md`](./recon.md).

## Approved decisions (2026-10-04)

All §12 recommendations in `00-overview.md` are approved as written: D1 indigo accent · D2 Tier-2 brand accent on when gates pass · D3 at-risk ≤ 25% or ≤ 60 min · **D4 keep Arabic-Indic digits** (explicitly confirmed) · D5 cookie-only theme · D6 no permission-gated nav · D7 landing route unchanged · D8 shortcuts optional/Low · D9 no send-and-set-status · D10 light logo plate · D11 40px default controls · D12 presentation map in `@crm/shared`.

## Baseline (before Story 177, `main` @ `3461bcf`)

Unit/component: `@crm/ui` 31 files / 312 tests · `@crm/web` 88 / 1290 · `@crm/portal` 48 / 430 — all passing (one `@crm/ui` run failed under parallel load and passed on immediate re-run; treated as resource contention per the concurrent-sessions note).

Visual evidence is captured with an ad-hoc Playwright harness kept outside the repository (scratchpad `shoot.mjs`): it logs in as the seeded admin and as a fixture portal contact, renders each screen at 320/768/1280 × en/ar × light/dark, and records horizontal overflow, `h1` count, `dir`, `data-theme` and page errors per screenshot.

## Stories

| Track ID | Story | Summary | Verification | Commit | Push | Deferred |
|---|---|---|---|---|---|---|
| RD-0.1 | 177 Design language doc | Recon, overview, progress tracker; `docs/architecture/13-design-language.md`; RTL-06 doc drift fixed | Docs only | `65b3daa` | ✅ | — |
| RD-0.2 | (no commit) Visual baseline | 120 baseline shots (16 screens × 320/768/1280 × en/ar, light) captured outside the repo by design. Automated flags confirm recon: portal chat has no `h1` (A11Y-03), Reports overflows 6px at 1280 | Harness report | — (evidence only) | — | — |
| RD-1.1 | 178 Colour tokens v2 (light) | Indigo accent/focus, sky info, `progress` family, `surface-raised`, `rule-control`, `accent-active`; contrast fixes for ink-subtle, warning solid, danger hover; dead shadcn aliases removed; `color.ts` WCAG helpers + token-contrast guard | ui 317 ✓ · web 1330 ✓ · typecheck/lint ✓ · before/after shots | `26a552f` | ✅ | — |
| RD-1.2 | 179 Shape, elevation, motion, type tokens | Radius control/surface/inner = 8/12/6px; resting/raised/overlay shadows; `section` + responsive `page-x/y`; `body-lg` + `display`; Arabic letter-spacing reset; motion vars + keyframes; global reduced-motion rule; scales registered in `cn` | ui 329 ✓ · token guard 42 ✓ · web build ✓ · shots | `bac28a3` | ✅ | — |
| RD-1.3 | 180 Palette leaks + style guard | 7 raw palette leaks → semantic tokens; `text-danger-solid`-as-text → `danger-foreground`; new `danger-solid-foreground`; repo-wide guard (raw palette, physical direction, `dark:` outside ui, `-solid` as text — QA-05) | ui 329 · portal 430 · web 1363 ✓ · typecheck/lint ✓ | `5ea01c9` | ✅ | — |
| RD-1.4 | 181 Dark mode tokens + theme resolution | Dark token blocks (explicit `[data-theme=dark]` + OS "system", generated from one map), `color-scheme`, dark shadows; `ThemeScript` (blocking inline head script) + `crm-theme` cookie helpers; `darkMode` variant config; logo plate; QA-01 login text opacity fixed; translucent-foreground guard. **Plan correction:** cookie applied by inline script, not a server read, to keep `[locale]` layouts statically generated | ui 334 · portal 430 · web 1410 ✓ · typecheck/lint ✓ · web + portal builds ✓ · 64 shots light/dark × en/ar × 320/1280, `data-theme` verified per shot | `7ca05a1` | ✅ | Arabic glyphs on login render in a fallback face in headless Chromium (also in baseline) → RD-7.5; dark login brand panel is bright (correct contrast) → design review in RD-2.x/7.6 |
| RD-1.5 | 182 Preference controls | `NativeSelect` + `ThemeSwitcher` primitives; 4 locale selects + branch switcher migrated (focus ring added, A11Y-08); theme choice beside every language control, en/ar labels | ui 341 · portal 430 · web 1410 ✓ · typecheck/lint ✓ · 48 shots (dev), 0 overflow incl. 320px | `eb2c1d3` | ✅ | Select (h-8) vs Button (h-9) height alignment → RD-1.8 |
| RD-1.6 | 183 Branch branding model | `deriveBrandTokens` (OKLCH, 3 gates, light+dark accent sets verified against every pair) + `BrandScope` (SSR wrapper + `<html>` mirror for portals); `[data-brand-accent]` rules swap only the accent family; headers use `border-brand`; style guard reads files once (timeout fix) | ui 373 · portal 430 · web 1412 ✓ · typecheck/lint ✓ · live branding green/red × light/dark (original branding restored) | (pending) | (pending) | Dark-theme gate (a) intentionally not applied (documented) |
