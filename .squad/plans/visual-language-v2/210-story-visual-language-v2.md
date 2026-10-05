# Story 210 — Visual language v2: tokens and recipes

> CRM product redesign roadmap item **PR-1.1**. Intake: [`../../stories/visual-language-v2/visual-language-v2/intake.md`](../../stories/visual-language-v2/visual-language-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 1; direction: [`../crm-product-redesign/visual-direction.md`](../crm-product-redesign/visual-direction.md) §3–§5.

## Prerequisites

Stories 178–181 and 183 (token layer, dark mode, branding). Decisions PD-1 (indigo) and PD-8 (Latin digits).

## Story Goal

Fix the v2 look in the token layer: warm canvas, ink chrome, chart palette, status spine, four elevation levels — guarded for contrast in both themes — before any screen work.

**Non-goals:** screen redesigns; an accent hue change; backend.

## Design decisions

1. **Canvas:** light `--surface-sunk` 246 245 242 (`#F6F5F2`, chroma ≤ 0.01). Dark unchanged. `CORE_PREVIEW_PALETTE.light.sunk` follows (the mirror spec).
2. **Chrome family**, identical in both themes so the rail is the same ink in light and dark: `chrome #0E1726`, `chrome-raised #1A2538`, `chrome-active #23314A`, `chrome-rule #26334A`, `chrome-ink #F1F5F9`, `chrome-muted #A0AEC4`, `chrome-accent #A5B4FC`. Both dark blocks repeat the values (the guard requires identical dark blocks and full redefinition).
3. **Focus on chrome:** the page focus (`#4338CA`) fails 3:1 on the chrome; `.on-chrome` (components layer) sets `--focus: var(--chrome-accent)` and the ring-offset colour to the chrome.
4. **Viz palette** `viz-1…6`: light indigo/teal/amber/pink/sky/slate (`#4F46E5 #0D9488 #D97706 #DB2777 #0284C7 #64748B`), dark one step lighter (`#818CF8 #2DD4BF #FBBF24 #F472B6 #38BDF8 #94A3B8`); each ≥ 3:1 on `surface`.
5. **Contrast pairs** added to the shared light/dark list: chrome-ink on chrome/-raised/-active, chrome-muted on chrome/-raised, chrome-accent on chrome/-active (3:1), viz on surface (3:1), info/progress/success solid and rule-control on surface-sunk (3:1, the status spine on the canvas). The spec's token parser accepts digits (`--viz-1`).
6. **Recipes** (`packages/ui/src/lib/recipes.ts`, exported as `recipes`): `card`, `column`, `inner`, `liftable` (hover → raised), `floating` (raised surface + overlay shadow), `chrome` (`on-chrome bg-chrome text-chrome-ink`). Spec: resting recipes carry no shadow; token utilities only.
7. **Docs:** `13-design-language.md` gains chrome, viz, spine/urgency edge, the four elevation levels and recipes, the Latin-digits rule (PD-8), and the v2 principles.

## Tasks

1. Tokens (light + both dark blocks) and preset mapping.
2. `.on-chrome` focus scope.
3. Contrast spec additions; parser digit fix.
4. `recipes.ts` + spec + barrel.
5. Mirror palette update; docs.

## Verification Steps

1. ui, web, portal tests; typecheck; lint; prettier on files clean at HEAD.
2. Web and portal builds.
3. Harness: dashboard, tickets, a ticket and the portal home × light/dark × en/ar at 1280 — canvas warm in light, unchanged in dark, no overflow.
4. `git diff --check`; protected checksum; path-scoped commit.

## Done Criteria

- [ ] New tokens and pairs guarded in both themes; focus visible on chrome.
- [ ] Recipes exported and specified.
- [ ] Docs updated; all suites and builds green; harness clean.
