# Story 211 — Primitive kit v2

> CRM product redesign roadmap item **PR-1.2**. Intake: [`../../stories/primitive-kit-v2/primitive-kit-v2/intake.md`](../../stories/primitive-kit-v2/primitive-kit-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 1.

## Prerequisites

Story 210 (recipes, chrome, viz tokens); Story 187 (Dialog, overlay classes).

## Story Goal

Ship the domain-free primitives the redesigned screens are assembled from — accessible, translation-free and RTL-correct — so no screen Story has to invent one.

**Non-goals:** screen adoption; drag-and-drop logic; new dependencies.

## Design decisions

1. **Sheet** — Radix Dialog (focus trap, Escape, overlay, focus return, titled). `side="end"` (default) or `"start"`; `size` sm/md/lg; `SheetHeader/Body/Footer/Title/Description`. Motion: preset keyframes `sheet-in`/`sheet-out` on the individual `translate` property offset by `--sheet-from` (100% LTR / -100% RTL), so one keyframe mirrors; reduced motion is neutralised by the token layer.
2. **Switch** — `<button role="switch" aria-checked>`; the thumb uses `ms-0`/`ms-5` so it mirrors; no Radix dependency.
3. **SegmentedControl** — `role="radiogroup"` of `role="radio"` buttons, roving tabindex, arrows select (next = ArrowRight in LTR, ArrowLeft in RTL), Home/End, wrap; options carry `count` and a tone `dot`; `fill` for the mobile column switcher; checked option = surface + hairline ring (no shadow).
4. **ListToolbar** — search (`type="search"`, own draft, commits on Enter/blur, clear button) · `filters` inline from `sm`, and below `sm` a "Filters (n)" `Sheet` with the same controls · `summary` in `role="status"` · clear-all only when filtered · `actions` at the inline end · `children` row (quick views).
5. **StatCard** — `card` recipe, `text-display tabular-nums`, label, hint, optional 3px inline-start tone edge, `asChild` → the app's link with the `liftable` hover; `undefined` → "—", `loading` → skeleton.
6. **Charts** — `BarChart`, `DonutGauge`, `RatingBar` move verbatim (plus `tabular-nums`; the donut text size becomes an SVG `fontSize`) to `@crm/ui/charts`; web `report-charts.tsx` re-exports them and keeps the domain `ticketStatusBarColor`. New `DistributionBar`: one stacked bar (`role="img"`, labelled) plus a legend of every part with counts, optional links via `linkAs`.
7. **Board / BoardColumn** — `Board`: `role="region"`, horizontal scroll in its own box, scroll-snap below `lg`. `BoardColumn`: `column` recipe, 3px top status spine, header (dot, `h2` title, count pill, actions), body scrolling on its own (`bodyProps` for the drop target), `footer`, and a collapsed 56px rail (vertical title, count) with a named expand button.

## Tasks

1. Components + specs (one spec file each); barrel exports in a dedicated block.
2. Sheet keyframes in the preset.
3. Chart move + web re-export (web `report-charts.spec.tsx` unchanged).

## Verification Steps

1. ui/web/portal tests, typecheck, lint, prettier on touched files; web build.
2. `git diff --check`; protected checksum; path-scoped commit (the barrel staged hunk-only — a concurrent, ended session left unrelated uncommitted changes in `index.ts`).

## Done Criteria

- [ ] Seven primitives with ARIA/keyboard/RTL specs.
- [ ] Charts shared; web specs unchanged.
- [ ] All suites, typecheck, lint and build green.
