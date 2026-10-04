# Story 182 — RD-1.5 Preference controls: language and theme

**Objective:** one accessible, token-styled control for each preference, and a theme choice wherever the language can be chosen.

**Current implementation:** four hand-styled native locale `<select>`s (web/portal login and header) that disagree on height (h-8/h-9), radius (`rounded-md`/`rounded-surface`) and focus ring (the two header selects and the web branch switcher had none — recon A11Y-08). No theme control exists (RD-1.4 left the cookie with no UI).

**Files:** `packages/ui/src/components/{native-select,theme-switcher}.tsx` (+ specs), `packages/ui/src/index.ts`, `apps/web/src/components/workspace/workspace-header.tsx`, `apps/web/src/app/[locale]/(auth)/login/page.tsx`, `apps/portal/src/components/portal/portal-header.tsx`, `apps/portal/src/app/[locale]/(auth)/login/page.tsx`, both apps' `messages/{en,ar}.json`, two login specs, `apps/web/src/test/style-guard.spec.ts`.

**Approach:** `NativeSelect` (domain-free, `focus-ring`, `rounded-control`, `border-rule-control`, sm 32px / md 40px) replaces the four locale selects and the branch switcher; `ThemeSwitcher` (system/light/dark, labels via props, reads the cookie after mount, applies instantly via `applyThemePreference`) sits beside each language control. Locale path logic stays in each app (it is routing). Plan refinement: the overview's "LocaleSwitcher" is realised as `NativeSelect` + the apps' existing locale logic, since the list and the navigation are app concerns.

**Acceptance criteria:**
- [x] Locale switching unchanged (same `buildLocalePath`/`handleSwitchLocale`; existing navigation specs pass).
- [x] Theme applies instantly and persists (component spec).
- [x] Both controls named and keyboard-operable; all five selects carry the token focus ring.
- [x] No overflow at 320px in en/ar, light/dark (Story 173 constraint).

**Verification:** ui 35 files / 341 · portal 48 / 430 · web 90 / 1410; typecheck + lint clean. Two login specs counted every `option` on the page; they now count the locale switcher's options via `within(select)` (same assertion, scoped, since the theme switcher adds three). The style guard's `dark:` rule was tightened to ignore object keys (`dark: t(…)`). Visual (dev servers): web/portal login + dashboard/home × 320/768/1280 × en/ar × light/dark — 48 shots, 0 overflow.

**Non-goals:** user menu (RD-2.1/2.6); Button/control height alignment (RD-1.8).
