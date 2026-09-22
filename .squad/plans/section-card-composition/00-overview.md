# section-card-composition — plan overview

Entry point for the **section-card-composition** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 154 | [154-story-section-card-composition.md](./154-story-section-card-composition.md) | Section card composition | — | Story 139 (Card adoption), Story 140 (PageHeader) |

## Dependency notes

Story 139 migrated 70 hand-rolled surfaces to `Card` but deliberately did **not**
adopt `CardTitle`: it renders `h3`, while the 49 section headings across both
apps are `h2` sitting under a `PageHeader` `h1`. Adopting it would have skipped
a heading level and broken `portal-home-view.spec.tsx`'s `level: 2` assertion.

That left `CardTitle` — and with it `CardHeader`/`CardContent`/`CardFooter`/
`CardDescription` — at **zero** consumers, while the composition they exist to
express was hand-written 49 times.

This story fixes the cause (the fixed heading level) and gives the composition
a name, then migrates a bounded representative set.

## Deliberately excluded

- Migrating all 49 sites. Seven were migrated across both apps; the rest are
  left for the surface stories that will restructure those pages anyway.
- `Card asChild` sites (`portal-home-view.tsx`) — they carry `<section>`
  landmarks that `SectionCard` does not express. Forcing them through it would
  drop a landmark.
- Deleting `CardHeader`/`CardContent`/`CardFooter`/`CardDescription`.
- Any visual change to `Card` itself.
