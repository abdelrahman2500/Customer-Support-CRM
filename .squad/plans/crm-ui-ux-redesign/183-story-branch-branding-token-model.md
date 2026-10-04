# Story 183 — RD-1.6 Branch branding token model

**Objective:** the controlled two-tier branding model (`00-overview.md` §2.13): branches look like themselves without breaking the design system, semantics or contrast.

**Current implementation:** `primaryColor` only tinted a 2px header border through an ad-hoc `--brand-primary` inline variable (`workspace-header.tsx`, `portal-header.tsx`); `secondaryColor` unused; the accent never followed the branch.

**Files:** `packages/ui/src/lib/brand.ts` (+ spec), `packages/ui/src/components/brand-scope.tsx` (+ spec), `packages/ui/src/index.ts`, `packages/config/tailwind-{tokens.css,preset.js}`, `apps/web/src/components/workspace/workspace-{shell,header}.tsx` (+ specs), `apps/portal/src/components/portal/portal-header.tsx` (+ spec), `apps/web/src/test/style-guard.spec.ts` (I/O fix).

**Approach:**
- `deriveBrandTokens(primary, secondary)`: OKLCH maths, no dependency. Tier 1 keeps the colour verbatim as `--brand`/`--brand-secondary`. Tier 2 moves only lightness (hue kept, chroma gamut-clipped) until every pair the core accent guarantees holds, separately for light and dark. Gates: (a) light shift > 0.25 → recognisability, (b) chroma < 0.04 → neutral, (c) within 20° of the danger hue at chroma ≥ 0.1 → alarm.
- `BrandScope`: a `display: contents` wrapper (server-rendered, no flash in the web shell) plus an effect mirroring the variables onto `<html>` for Radix portals, removed on unmount.
- CSS: core `--brand` defaults (indigo per theme); `[data-brand-accent]` rules swap only the accent family, with dark selectors at higher specificity. The headers' edge becomes `border-brand`.
- Plan refinement: in the dark theme, gate (a) is not applied. Hue is preserved, and dark surfaces require lifting dark brands (e.g. navy) further than 0.25. The overview's gate is about the configured (light) appearance.

**Acceptance criteria:**
- [x] Derived accents meet every documented pair in both themes (spec, including a 72-colour hue sweep).
- [x] Gate failures fall back to core indigo while Tier 1 still applies (red, rose, burnt orange → alarm; grey, black, slate → neutral; yellow, pastel → recognisability).
- [x] Neutrals, focus and semantic families are never set by branding (`[data-brand-accent]` rules touch only `--accent*`).
- [x] No branding → no override (spec).

**Verification:** ui 37 files / 373 · portal 48 / 430 · web 90 / 1412; typecheck + lint clean. Visual on dev servers with the live admin branding API (original `#112233`/`#445566` saved and restored after each run): green `#16A34A` → green edge, nav and primary buttons in light and dark; red `#DC2626` → red edge only, indigo buttons kept. A Tailwind CLI compile confirmed `.border-brand` is generated; the dev server needed its webpack cache cleared to pick up the preset change (tooling, not code). Computed styles probed: header border `rgb(22,163,74)`, `<html>` carries the variables after hydration, no console errors.

**Style guard fix:** the guard read every file once per rule and timed out (7.9s > 5s) in the parallel full run. It now reads each root once and shares the result, with an explicit 30s budget. Assertions are unchanged.

**Specs changed by design:** the web/portal header tests asserted the removed `--brand-primary` variable; they now assert the header's `border-brand` edge and the `--brand` token in scope (web assertion moved to the shell, which owns `BrandScope`).

**Non-goals:** admin preview/verdict (RD-1.7); pre-auth (login) branding; server-side portal branding (RD-5.1).
