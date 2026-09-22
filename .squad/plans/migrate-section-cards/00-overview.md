# migrate-section-cards — plan overview

Entry point for the **migrate-section-cards** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 160 | [160-story-migrate-remaining-section-cards-to-sectioncard.md](./160-story-migrate-remaining-section-cards-to-sectioncard.md) | Migrate remaining section cards to `SectionCard` and guard the pattern | 160 | Story 154 (`SectionCard`, `CardTitle as`) |

## Dependency notes

Story 154 built `SectionCard`; adoption since has been incidental (Story 155
migrated three admin list views, Story 159 the KB version-history panel). This
story finishes the adoption and closes it with a guard, so the shape cannot be
hand-written a 32nd time.

### Why the whole set, in one story

The migration is **DOM-identical**, which is what makes 31 sites tractable: the
full web and portal suites passing *unchanged* is itself the proof that nothing
moved. `Card` and `SectionCard` both default to `elevation="flat"`;
`SectionCard` composes `cn("p-surface", className)` onto the same `Card`; its
default `headingLevel` is `"h2"`; and `CardTitle` renders exactly
`className="text-sm font-semibold text-ink"`.

A partial migration would be strictly worse than none: the guard is the point
of the story, and a guard cannot be written while known-violating sites remain.
Leaving some behind would mean either no guard at all, or a guard carrying an
exemption list of sites nobody decided to keep.

### What the story deliberately does not do

`SectionCard`'s API is not extended. Every one of the 31 sites is representable
today — the single structural variation, `elevation="raised"` on
`dashboard-view.tsx:305`, is already a supported prop. Widening a primitive's
API to absorb an awkward call site is how a shared component stops being
shared, and no call site here forces the question.
