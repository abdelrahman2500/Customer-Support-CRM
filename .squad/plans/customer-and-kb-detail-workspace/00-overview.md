# customer-and-kb-detail-workspace — plan overview

| NN  | Title | Depends on |
|-----|-------|------------|
| 159 | Propagate the detail-page workspace pattern to Customer Detail and KB Article Detail | 154 (`SectionCard`), 156 (the pattern) |

## The pattern being propagated

Story 156 established three things on ticket detail. Two apply to both pages here; the third applies to only one.

1. **Visible identity with an explicit edit mode.** Applies to both.
2. **`SectionCard` for coherent groups.** Customer detail already has it (Story 154); KB gets it for version history.
3. **Two-column workspace.** Customer detail yes; **KB article detail no** — see below.

## Why KB gets no column split

Ticket detail had eleven stacked cards competing for attention. KB article detail is a *content editor*: its body `Textarea` is the work surface, and it already lives inside Story 137's locale `Tabs`. Splitting it would narrow the editor to gain a sidebar with nothing to put in it. The brief's own instruction — "do not redesign the knowledge-base domain", "presentation hierarchy, not domain redesign" — points the same way.

## Deliberately excluded

- Re-migrating customer detail's five `SectionCard`s (Story 154 did it).
- Any KB domain change: article/translations API, publishing, permissions, locale behaviour, content storage.
- The other 41 `SectionCard` and 6 `QueryStateCard` candidates.
