# Story 184 — RD-1.7 Branding admin preview and verdict

**Objective:** admins see what their colours will do (both themes) before saving, with a plain-language reason when the accent is not applied.

**Current implementation:** `apps/web/src/components/admin/branding-view.tsx` takes hex values as plain text, previews them as two flat swatches, and gives no hint that a colour may be unreadable on buttons. The layout radios lack the token focus ring (recon A11Y-08).

**Files:** `apps/web/src/components/admin/{branding-view,brand-preview}.tsx`, `branding-view.spec.tsx`, `apps/web/messages/{en,ar}.json`, `packages/ui/src/lib/brand.ts` + `index.ts` (`CORE_PREVIEW_PALETTE`), `apps/web/src/test/token-contrast.spec.ts` (drift guard), `apps/{web,portal}/src/design-tokens.spec.ts` (timeout only).

**Approach:**
- `BrandPreview` runs the same `deriveBrandTokens` the app uses and renders a miniature header (brand edge), primary action, link and an `info` status badge in light and dark side by side. Inline colours, because two themes render at once; they come from `CORE_PREVIEW_PALETTE`, which a spec keeps equal to the token file.
- A `role="status"` verdict (none / accepted / neutral / alarm / recognisability / contrast), localized en/ar.
- A native `type="color"` picker beside each hex field (labelled "Pick {field}"); the text stays authoritative.
- `focus-ring` on the layout radios.

**Acceptance criteria:**
- [x] Preview matches the shipped derivation (same function; spec asserts accepted/rejected colours on the preview button).
- [x] Verdict localized and live while editing (spec).
- [x] Save behaviour unchanged (existing mutation specs pass).

**Verification:** web 90 files / 1414 · portal 48 / 430 · ui 37 / 373; typecheck + lint clean. Two existing specs were rescoped because the new UI legitimately duplicates content: the colour picker shares the hex value (the test now asserts the labelled field's value), and the brand name also heads both previews (the test now asserts it inside the light preview, and that the default name is gone everywhere). The pre-existing `design-tokens.spec.ts` (web and portal) exceeded vitest's 5s default under the parallel full run (8.6s); it now has an explicit 30s budget with assertions unchanged, which was needed to verify this Story. Visual: branding page × 320/1280 × en/ar × light/dark (8 shots, 0 overflow); the live branch colour `#112233` correctly reports "header edge only (too close to grey)".

**Non-goals:** new branding fields; a colour library; pre-auth branding.
