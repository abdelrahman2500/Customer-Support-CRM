> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/migrate-section-cards/migrate-remaining-section-cards-to-sectioncard/intake.md`

---

## Feature

- **Feature name (display):** Migrate section cards
- **Feature slug (folder under `plans/`):** `migrate-section-cards`

## Tracker (metadata only)

- **Work item id:** `160`
- **Labels:** ui, design-system, refactor

---

## Title

```
Migrate remaining section cards to SectionCard and guard the pattern
```

---

## Premise verification (measured at HEAD 4edfca9)

A source scan classified every `<Card>` in `apps/web/src` and `apps/portal/src`
that either carries `p-surface` or is immediately followed by an `<h2>`.

| Bucket | Count | Disposition |
|---|---|---|
| **Exact pattern** — `<Card … p-surface>` whose first child is `<h2 className="text-sm font-semibold text-ink">` | **31** (web 26, portal 5) | migrate |
| Other `p-surface` Cards — skeleton placeholders, KPI tiles, `PageHeader` wrappers, `asChild` `<form>`/`<section>` surfaces, metadata grids | 25 | **leave alone** |

Structural variation across the 31: exactly one. `dashboard-view.tsx:305` carries
`elevation="raised"`, which `SectionCard` already accepts as a prop. None of the
31 has an action in its heading row, a conditional heading, a custom `className`
on the `Card` beyond `p-surface`, or any other prop.

**The migration is DOM-identical**, not a redesign:

- `Card` and `SectionCard` both default to `elevation="flat"`, and `SectionCard`
  composes `cn("p-surface", className)` onto the same `Card`.
- `SectionCard`'s default `headingLevel` is `"h2"`, and `CardTitle` renders
  exactly `className="text-sm font-semibold text-ink"`.

So the full web/portal suites passing **unchanged** is itself the proof the
change is a no-op.

---

## Description

```
Story 154 introduced `SectionCard` (and `CardTitle`'s `as` prop) so one
primitive owns the "titled section on a surface" shape. Adoption since then has
been incidental — Story 155 migrated three admin list views, Story 159 migrated
the KB version-history panel — and 31 sites still hand-write the composition.

That duplication is how the heading-level drift Story 154 had to fix arose in
the first place: when the shape lives in 31 places, a change to it lands in
some of them. Nothing prevents the 32nd copy from being written tomorrow.

Migrate the sites that are genuinely this pattern, and add a source-scanning
guard so a new hand-written copy fails the test suite.
```

---

## Acceptance criteria

```
Migration
- Every site matching <Card ... p-surface> + <h2 class="text-sm font-semibold
  text-ink"> uses SectionCard instead.
- Children, heading text, heading level, layout, spacing, tokens and Card
  behaviour are unchanged. `elevation="raised"` is passed through, not dropped.
- No Card that is not this pattern is touched: skeletons, KPI tiles,
  PageHeader wrappers and `asChild` form/section surfaces stay as they are.
- No section reordered, no content hierarchy changed, no new styling.
- SectionCard's API is NOT extended for this story.

Guard
- A source-scanning guard in each app's existing design-tokens.spec.ts fails on
  a newly hand-written section-card composition.
- The guard matches the semantic combination (Card + p-surface + the canonical
  heading shape), not all Cards, and produces zero false positives against the
  25 legitimate non-section Card usages.
- Web and portal keep separate guards, matching the existing architecture.

Regression
- web + portal + ui suites, typecheck, lint, build all green, with no test
  weakened and no snapshot rebaselined to accommodate the change.
- h2 stays h2; accessible names unchanged; FormField associations intact.
- No physical-direction utility and no raw palette class introduced.
- No API, query, business-logic, permission or routing change.
```

---

## Out of scope

- Redesigning cards or changing `Card`'s visual design.
- Navigation, ticket, customer or KB redesign.
- `QueryStateCard` mass migration.
- Badge-sharing architecture, new design-token system, dark mode.
- Backend, API, business logic, permissions.
