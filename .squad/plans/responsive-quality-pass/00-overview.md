# responsive-quality-pass — plan overview

Entry point for the **responsive-quality-pass** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 150 | [150-story-responsive-quality-pass.md](./150-story-responsive-quality-pass.md) | Responsive quality pass — finish RM-10's mobile table adoption | — | RM-10 (mobile table primitive) |

## Dependency notes

RM-10 ("make data tables mobile-responsive") built the mechanism: below
`sm`, `Table` renders each row as a stacked card and `TableCell`'s `label`
prop supplies the column name that the hidden `<th>` no longer can.

RM-10 converted the three largest tables and stopped. This story finishes
the adoption, which is the single largest measured responsive gap left in
either app.

It is deliberately **not** a general "add breakpoints" sweep — see the
story's own Non-goals for the candidates that were investigated and
rejected on evidence.
