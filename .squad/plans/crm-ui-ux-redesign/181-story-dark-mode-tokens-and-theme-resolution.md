# Story 181 — RD-1.4 Dark-mode token layer and theme resolution

**Objective:** dark mode from the foundation (`00-overview.md` §2.5): tuned dark tokens, OS-preference "system" default, explicit light/dark via cookie, no flash, no per-component colour branching.

**Current implementation:** light tokens only; no `darkMode` config; 0 `dark:` classes; the four root `<html>` renderers (`apps/{web,portal}/src/app/[locale]/layout.tsx`, `apps/{web,portal}/src/app/not-found.tsx`) set `lang`/`dir`/fonts only. `[locale]` layouts are statically generated (`generateStaticParams`).

**Files:** `packages/config/tailwind-tokens.css`, `tailwind-preset.js` (`logo-plate`), `packages/ui/src/lib/theme.ts` (+ spec), `packages/ui/src/components/theme-script.tsx`, `packages/ui/src/index.ts`, both apps' `tailwind.config.ts`, the four root renderers, both headers (logo plate), both login pages (QA-01), `apps/web/src/test/{token-contrast,style-guard}.spec.ts`, `docs/architecture/13-design-language.md`.

**Approach:**
- One value map generates two identical dark blocks: `:root[data-theme="dark"]` (explicit) and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` (system); `color-scheme` per theme; dark shadows.
- `ThemeScript` (blocking inline script in `<head>`) applies an explicit cookie choice before paint; `suppressHydrationWarning` on `<html>`.
- `darkMode: ["variant", …]` mirrors the token selectors (for rare `dark:` use inside `@crm/ui` only).
- Logo plate: a constant light `--logo-plate` behind uploaded logos (D10).
- QA-01: login brand-panel text made opaque (`/80` alpha was 4.62:1 on indigo and fails in dark), glow 20% → 10%; guard rejects translucent foreground text. QA-04: stale "light only" header comment rewritten.

**Plan correction (documented):** the overview said the cookie is "read server-side in `[locale]/layout.tsx`". Repository reality: those layouts are statically generated, and a `cookies()` read would make every route dynamic, which is a rendering/performance behaviour change. The inline-script approach meets the same "no flash" criterion without it. The design doc is updated to match.

**Acceptance criteria:**
- [x] Every §2.2 dark pair meets its ratio; the system block equals the explicit block; every light colour token has a dark value (spec).
- [x] OS dark + no cookie → dark; cookie forces light/dark (spec of script + preference helpers; visual check below).
- [x] `color-scheme` follows the theme (native controls).
- [x] No translucent foreground text anywhere (guard).

**Verification:** ui 33 files / 334 tests · portal 48 / 430 · web 90 / 1410; typecheck + lint clean in all three; both production builds; visual light/dark × en/ar × 320/1280 on the production servers.

**Non-goals:** the theme switcher UI (RD-1.5); per-user persistence (D5); branch brand tokens (RD-1.6).
