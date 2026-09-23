# harden-fixed-width-form-controls-for-narrow-viewports — plan overview

Entry point for the **harden-fixed-width-form-controls-for-narrow-viewports** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 174 | [174-story-harden-fixed-width-form-controls-for-narrow-viewports.md](./174-story-harden-fixed-width-form-controls-for-narrow-viewports.md) | Harden fixed-width form controls for narrow viewports | — | Story 173 (whose sweep found this), Story 150 (the scan this extends), RM-10/`FilterBar` (untouched), Story 170 (`w-56 text-title`) |

## Dependency notes

- **Single-story feature.** Found by Story 173's own post-implementation browser sweep, which reported 22/23 routes clean at 320px in both locales — `/quick-replies` was the one holdout, overflowing identically in EN and AR (`scrollWidth` 329 vs `clientWidth` 320).
- **Root cause was one class.** `quick-replies-view.tsx` line 195 carried `w-72` — a fixed 288px control inside a `SectionCard` whose content box measures 272px at a 320px viewport. The form is rendered unconditionally, so every narrow-screen user reached it.
- **It extends Story 150 rather than reopening it.** That story investigated filter rows and rejected them on reasoning that still holds — `min-w-[10rem]` controls sit in `FilterBar`, which is `flex-col` below `sm` and stacks them full-width. **Fixed `w-*` is a different class**: it cannot shrink wherever it sits, and Story 150's scan never covered it. The 11 `min-w-*` filter selects are deliberately untouched here.
- **One mechanical transform, 25 controls, 12 files:** `w-N` → `w-full sm:w-N`, the idiom already present at six call sites (`filter-bar.tsx` line 64, `customer-list-view.tsx` ×2, `article-list-view.tsx`, `reports-view.tsx`, `ticket-list-view.tsx`). Provably inert at ≥640px — `sm:w-N` wins once the breakpoint is active — and measured so: the proven control is **288px at both 1440 and 834**, exactly as before, and 238px (its container's full width) at 320.
- **Deliberate exclusions:** four `Skeleton` placeholders and the absolutely-positioned mention-autocomplete `<ul>` keep their fixed widths. A full-width skeleton would misrepresent the control it stands in for, and a positioned popover is not a control in flow.
- **Result:** the 23-route × EN/AR sweep at 320×640 now reports **23/23 clean in both locales**, with the API confirmed alive after each run.
- **Blast radius:** 12 production files plus one spec, all under `apps/web/src/components/`. `apps/portal` and `packages/**` untouched (portal's single fixed width, `sm:w-64`, is already guarded), so those suites are expected unchanged.
