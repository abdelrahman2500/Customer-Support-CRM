> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/visual-language-v2/visual-language-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Visual language v2: tokens and recipes
- **Feature slug (folder under `plans/`):** `visual-language-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-1.1**, global Story **210**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Visual language v2: tokens and recipes
```

---

## Description

```
Story 210 — PR-1.1 of the CRM product redesign (roadmap:
.squad/plans/crm-product-redesign/00-overview.md Phase 1; direction:
visual-direction.md §3–§5).

GOAL
Decide the look in the token layer before any screen is redesigned: the
warm canvas, the ink chrome, the chart palette, the status spine and the
four-level elevation rule, with every new colour pair contrast-guarded in
both themes.

CONTEXT (main @ the roadmap commit after 21ee9ea)
- packages/config/tailwind-tokens.css: RGB-channel CSS variables; light
  :root, :root[data-theme="dark"] and the prefers-color-scheme copy (the
  guard spec requires identical dark blocks and every light colour token
  redefined in dark, except logo-plate).
- packages/config/tailwind-preset.js maps tokens to utilities.
- apps/web/src/test/token-contrast.spec.ts asserts the documented pairs;
  CORE_PREVIEW_PALETTE (packages/ui/src/lib/brand.ts) mirrors surface-sunk.
- docs/architecture/13-design-language.md is the binding design language.
- Approved: PD-1 indigo accent kept; PD-8 Latin digits in Arabic.

REQUIRED OUTCOME
1. surface-sunk (light) → warm paper #F6F5F2; dark unchanged.
2. New chrome family (chrome, -raised, -active, -rule, -ink, -muted,
   -accent), identical in both themes; `.on-chrome` scopes the focus ring
   to chrome-accent.
3. New viz-1…6 palette (light/dark), colour-blind-safe order.
4. Contrast pairs for chrome text, chrome focus, viz on surface, status
   solids on the canvas — light and dark.
5. `recipes` (card, column, inner, liftable, floating, chrome) in @crm/ui.
6. 13-design-language.md updated (chrome, viz, spine/urgency edge,
   elevation levels and recipes, Latin digits per PD-8, v2 principles).
```

---

## Acceptance criteria

```
- [ ] Every new token pair meets AA (4.5 text / 3 non-text) in light and
      dark (spec); dark blocks stay identical (existing guard).
- [ ] Focus is visible on the chrome (scoped ring, spec).
- [ ] CORE_PREVIEW_PALETTE mirrors the new canvas (existing spec).
- [ ] No screen changes beyond the token re-skin; ui/web/portal tests,
      typecheck, lint, builds green; harness light/dark × en/ar shows the
      canvas with no regressions.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none.
- **Depends on code areas or other stories:** Stories 178–181, 183 (tokens, dark mode, branding).

## Extra notes (optional)

- The chrome is consumed from PR-2.1; viz from PR-1.2 (charts); recipes from PR-1.3 onwards.

## Technical hints (optional)

- Files: `packages/config/tailwind-{tokens.css,preset.js}`, `packages/ui/src/lib/{recipes.ts,recipes.spec.ts,brand.ts}`, `packages/ui/src/index.ts`, `apps/web/src/test/token-contrast.spec.ts`, `docs/architecture/13-design-language.md`.

## Out of scope

- Screen redesigns (later Stories), accent hue change (PD-1: indigo kept), any backend change.
