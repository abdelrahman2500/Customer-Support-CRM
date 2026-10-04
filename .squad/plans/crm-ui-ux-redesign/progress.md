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
| RD-1.2 | 179 Shape, elevation, motion, type tokens | Radius control/surface/inner = 8/12/6px; resting/raised/overlay shadows; `section` + responsive `page-x/y`; `body-lg` + `display`; Arabic letter-spacing reset; motion vars + keyframes; global reduced-motion rule; scales registered in `cn` | ui 329 ✓ · token guard 42 ✓ · web build ✓ · shots | (pending) | (pending) | — |
