# align-error-page-titles-with-the-type-scale — plan overview

Entry point for the **align-error-page-titles-with-the-type-scale** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 176 | [176-story-align-error-and-not-found-page-titles-with-the-type-scale.md](./176-story-align-error-and-not-found-page-titles-with-the-type-scale.md) | Align error and not-found page titles with the type scale | — | Story 170 (the scale decision this applies), Story 134 (the scale), Story 175 (HEAD only) |

## Dependency notes

- **Single-story feature, one class per file.** Story 170 put every page title on the named `title` step but scoped itself to `PageHeader`, `CardTitle` and three inline-editable detail views. Six error/not-found shells were outside that range and still carried `text-xl font-semibold`, so the product rendered page titles at two sizes. These six were the only remaining `text-xl` occurrences in either app.
- **Applies Story 170's recorded decision rather than making a new one**, including dropping `font-semibold`: the `title` step declares `fontWeight: 600` in its own `fontSize` tuple, and stating the weight twice is how the two drift apart.

## Verification limitation — a separate, pre-existing defect

Browser verification could **not** confirm the rendered size, and the reason is worth recording because it is a real finding in its own right.

Requesting any unmatched path — `/en/nope`, `/ar/nope` — serves the **root** `not-found.tsx` in both apps, not the localised one. The served HTML contains **no `<link rel="stylesheet">` at all** and a doubled `<html>` element, so the page renders completely unstyled: the `h1` computes to the UA default **32px/700** regardless of its classes. It would have rendered exactly as unstyled at `text-xl`; this story neither caused nor worsened it.

Consequently `[locale]/not-found.tsx` and `[locale]/error.tsx` are effectively unreachable in practice — the only `notFound()` call in `apps/web/src/app` is in `[locale]/layout.tsx` for an invalid locale, which renders the root boundary because the layout has not yet rendered.

What **was** verified instead:

- `.text-title{font-size:1.5rem;line-height:1.25;letter-spacing:-.015em;font-weight:600}` is present in both apps' built stylesheets.
- `class="text-title text-ink"` is present on the served `h1` in both apps.
- So on any page that loads the stylesheet, the heading resolves to 24px/600.

**Deliberately not fixed here** (CLAUDE.md §4): the unstyled root not-found boundary and the unreachable localised boundaries are a routing/document-shell concern, not a type-scale one, and belong in their own story.
