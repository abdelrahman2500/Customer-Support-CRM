# kb-multi-locale — plan overview

Entry point for the **kb-multi-locale** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 109 | [109-story-kb-multi-locale.md](./109-story-kb-multi-locale.md) | Knowledge Base — Multi-locale content (Arabic/English) | — | Story 51/54/64/65/102 (KB foundation, portal browsing, search, versioning, full-text search) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 108 closed, from
  the standing, user-approved unblocked backlog (109, 110, 114, 115
  remaining at that point). None of the four has a foundation-completion
  relationship to another (confirmed by two consecutive Recons), so this
  Recon weighed them primarily on **product value** (CLAUDE.md §2 priority
  3, since priorities 1/2 were roughly tied across all four): 109 closes a
  live inconsistency in an *already-shipped, customer-facing* surface —
  `apps/portal`'s Knowledge Base browsing (Story 54) is fully locale-routed
  (`[locale]/(customer)/knowledge-base`) yet every article is English-only
  today, so an Arabic-locale customer silently gets English content. 110
  (saved dashboards) is a greenfield feature with materially higher design
  ambiguity (no widget/layout/sharing schema specified anywhere) and no
  existing consumer. 114/115 rank below any real capability under §2's
  strict lexicographic ordering, however appealing on risk-reduction
  (114) or smallness (115) alone.
- **The gap**: `docs/architecture/10-i18n-and-rtl.md` names the intended
  pattern directly: "Translatable user/domain content, such as Knowledge
  Base articles, uses a per-entity translations pattern: one row per
  entity/locale/field or a locale-keyed JSON column, decided by the
  feature story." `KnowledgeBaseArticle` has only single `title`/`body`
  columns — confirmed directly against `schema.prisma`.
- **Design decision this story makes** (the doc explicitly defers it):
  **one row per entity/locale** (a new `KnowledgeBaseArticleTranslation`
  table), not a locale-keyed JSON column — mirrors the shape
  `KnowledgeBaseArticleVersion` (Story 65) already established for "one
  row per article variant," gives each translation a real relational
  identity, and keeps Prisma's typed query builder fully usable (a JSON
  column would need manual shape validation on every read/write, which
  `class-validator` DTOs already give the request-body path for free with
  a proper table).
- **Why not externally blocked**: purely internal schema/migration work —
  no external provider/credential decision needed, unlike the 8
  deliberately-deferred Stories 116-123.
- **Scope-narrowing decisions** (see the story doc's own Non-Goals for the
  full list and reasoning): the existing base `title`/`body` columns are
  kept, unchanged, as the permanent fallback/default-locale content — this
  story is purely additive (a translation overlay), so every existing
  caller/test that doesn't pass `locale` keeps behaving exactly as before.
  Full-text search (Story 102) stays English-only against the existing
  `search_vector` column — a genuinely separable, large sub-feature
  (Arabic-aware `tsvector`/GIN indexing) deferred to its own future story.
  No admin authoring UI in `apps/web` — translations are set via a new,
  fully-tested API endpoint; a locale-tab editor UI is additive UX layered
  on an unchanged data model, appropriate for a later, separate story. No
  per-locale versioning — `KnowledgeBaseArticleVersion` (Story 65)
  continues to snapshot only the base content, unchanged.
