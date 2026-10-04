# Story 179 — RD-1.2 Shape, elevation, motion and type tokens

**Objective:** encode `00-overview.md` §2.6–§2.9 and §2.12 as tokens.

**Current implementation:** radius tokens mirror `rounded-md`/`rounded-sm` (.375rem/.125rem); two shadows (Tailwind's sm/md, pure black); no motion tokens; seven-step type scale with `label` tracked at 0.06em; no Arabic letter-spacing reset; `Skeleton`'s pulse ignores reduced motion.

**Files:** `packages/config/tailwind-tokens.css`, `packages/config/tailwind-preset.js`, `packages/ui/src/lib/cn.ts` (+ spec), `apps/web/src/test/token-contrast.spec.ts`.

**Approach:**
- Radius: `control` 8px (new) · `surface` 12px · `inner` 6px.
- Elevation: ink-tinted `resting`, new `raised`, softer/larger `overlay`.
- Spacing: `section` 1.5rem, responsive `page-x`/`page-y` (1 → 1.5 at sm → 2rem at lg).
- Type: rem line-heights; new `body-lg` 16/26 and `display` 30/36; `label` tracking 0.02em; `:lang(ar)` resets letter-spacing on tracked steps and lifts body line-height.
- Motion: duration/easing variables, `fade`/`zoom` keyframes in the preset (no plugin dependency), and a global `prefers-reduced-motion` neutraliser.
- Register every new scale in `cn.ts` (Story 172 precedent).

**Acceptance criteria:**
- [x] New utilities (`rounded-control`, `shadow-raised`, `p-section`, `px-page-x`, `text-body-lg`, `text-display`, `duration-base`, `animate-zoom-in`) resolve.
- [x] `cn` merges every new step correctly (spec per step).
- [x] Arabic reset and reduced-motion rule are guarded by spec.

**Verification:** ui 32 files / 329 tests; web token guard 42 tests; ui/web typecheck + lint clean; `@crm/web` production build passes; visual check (production server): login, dashboard, ticket × 320/1280 × en/ar — cards take the 12px radius, no overflow, RTL intact.

**Non-goals:** primitives adopting the new tokens (RD-1.8–1.10); page padding adoption (RD-2.3).
