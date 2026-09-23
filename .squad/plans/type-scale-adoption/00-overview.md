# type-scale-adoption — plan overview

Entry point for the **type-scale-adoption** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                                                                                           | Title                                                   | Tracker id | Depends on                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 170 | [170-story-spend-the-named-type-scale-on-page-and-section-headings.md](./170-story-spend-the-named-type-scale-on-page-and-section-headings.md) | Spend the named type scale on page and section headings | —          | Story 134 (the scale), Story 140 (`PageHeader`), Story 154 (`CardTitle`/`SectionCard`), Story 168 (first consumer of `text-title`) |

## Dependency notes

- **Completes the job Story 134 named and deliberately deferred.** `packages/config/tailwind-preset.js` ~lines 130–147 records the finding this story acts on verbatim: "The original recon found headings were `text-lg` for page titles and `text-sm` — body size — for section titles, which is why pages read flat. These steps give later stories somewhere to go. Nothing is re-typeset by this file: applying them is a shared `PageHeader`'s job (NAV-2)." `PageHeader` shipped in Story 140 and kept `text-lg`; the scale has had one consumer since — Story 168's login `h1` — and this closes the gap.
- **Two primitives own the change; no call site chooses a size.** `PageHeader`'s `h1` and `CardTitle`'s heading are edited in `packages/ui`, so all **37** `PageHeader` consumers and all **29** `SectionCard`/`CardTitle` files inherit it without an edit. The only app files touched are the three detail views that hand-roll their own page `h1` because their title is inline-editable and cannot go through `PageHeader` — measured, and they are the only such sites.
- **The hierarchy this produces.** Page title 1.5rem (`title`), section title 1rem (`subhead`), body 0.875rem. Today it is 1.125rem / 0.875rem / 0.875rem — section titles sit at body size, which is the "flat" the recon named. Login already reads at the new top step, so this makes the rest of the product agree with the screen that set the bar.
- **Weight moves into the scale.** `title` and `subhead` each carry `fontWeight: 600` in their own `fontSize` tuple, so `font-semibold` beside them is redundant and is dropped. That is a behaviour-preserving simplification, not a weight change.
- **No token added, revalued or renamed.** Story 134's warning — "a token whose value does not match the utility it replaces would turn a migration into a silent redesign" — does not apply in reverse: this story is the deliberate redesign that scale was defined for, and it changes only which named step each heading points at.
- **Blast radius:** 2 files in `packages/ui`, their 2 specs, 3 app view files. No i18n, no backend, no dependency, no new component, no call-site API change.

## Discovered during implementation — the scale was unusable inside `@crm/ui`

The plan above did not anticipate this, and the story's own new test is what
caught it: **`cn` was silently deleting every named type step.**

`packages/ui/src/lib/cn.ts` runs `twMerge` with tailwind-merge's stock
config, which knows only Tailwind's own `text-xs`…`text-9xl`. Any other
`text-*` class falls through to its **text-colour** group — so
`cn("text-subhead text-ink")` looked like two colours, tailwind-merge
resolved the "conflict" in favour of the last one, and emitted `text-ink`
alone. Measured against the real `CardTitle`: rendered class list
`text-ink`, with `text-subhead` gone, no error and no warning anywhere.

Every component in this package styles through `cn`, so the scale Story 134
defined was **effectively unusable inside `@crm/ui`** for its whole
existence. That is a large part of why it sat at zero adoption: Story 168
spent `text-title` successfully only because a login `h1` is a plain
`className` string that never goes through `cn`.

The fix is `extendTailwindMerge` registering the seven steps in the
`font-size` group — which also restores the correct behaviour in the other
direction, so two named steps still override each other. Guarded by a new
`packages/ui/src/lib/cn.spec.ts` that asserts the **behaviour** for every
step in both orders, rather than restating the registered list: a step added
to the preset and forgotten in `cn.ts` fails there instead of shipping as an
invisible missing class.

This is in scope rather than a separate story: without it, task 2 of the
plan does not work at all.
