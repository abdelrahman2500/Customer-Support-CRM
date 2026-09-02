> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/kb-multi-locale/kb-multi-locale/intake.md`

---

## Feature

- **Feature name (display):** Knowledge Base — Multi-locale content (Arabic/English)
- **Feature slug (folder under `plans/`):** `kb-multi-locale`

## Title

```text
Story 109 — Knowledge Base: Multi-locale content (Arabic/English)
```

## Description

```text
docs/architecture/10-i18n-and-rtl.md names the intended pattern directly:
"Translatable... Knowledge Base articles, uses a per-entity translations
pattern... decided by the feature story." KnowledgeBaseArticle has only
single title/body columns today, yet apps/portal's KB browsing (Story 54)
is already fully locale-routed -- Arabic-locale customers silently get
English-only content. This story adds a new
KnowledgeBaseArticleTranslation table (one row per article/locale, chosen
over a locale-keyed JSON column to mirror KnowledgeBaseArticleVersion's
existing per-variant-row shape and keep Prisma's typed query builder
usable), a new API endpoint to set/list translations, locale-aware
fallback resolution on every existing read path, and wires the portal
reader to request content in its own active locale.
```

## Acceptance criteria

```text
- [ ] New KnowledgeBaseArticleTranslation table/enum; no data backfill;
      every existing read/write path behaves identically when locale is
      omitted.
- [ ] PUT .../:id/translations/:locale upserts (kb:update); GET
      .../:id/translations lists them (kb:read); both branch/404-scoped.
- [ ] Article read endpoints (agent + portal), given ?locale=AR, return
      the AR translation when one exists, else the base content.
- [ ] searchArticles (Story 102) unmodified -- English-only search stays
      as-is.
- [ ] Portal's ArticleListView/ArticleDetailView request content in the
      visitor's own active locale.
- [ ] Unit coverage for locale-fallback resolution and the new
      translation endpoints.
- [ ] e2e coverage: set an AR translation, verify a portal ?locale=AR
      request returns it; verify the no-translation/omitted-locale case
      still returns base content.
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures.
```

## Dependencies

- Story 51 — KB foundation (`KnowledgeBaseArticle`).
- Story 54 — Customer Portal KB browsing (`PortalKnowledgeBaseController`,
  the locale-routed reader UI this story's value depends on).
- Story 64 — `ListArticlesQueryDto`'s existing `search` field, extended
  with `locale`.
- Story 65 — `KnowledgeBaseArticleVersion`'s per-row shape, mirrored by
  the new translations table.
- Story 102 — `searchArticles`'s existing English-only full-text search,
  explicitly left unmodified.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Arabic-aware full-text search (a separate, later story).
- An admin authoring UI (locale tab/switcher) in apps/web's KB editor.
- Any change to apps/web's own KB list/detail views.
- Per-locale versioning.
- Any locale beyond EN/AR.
