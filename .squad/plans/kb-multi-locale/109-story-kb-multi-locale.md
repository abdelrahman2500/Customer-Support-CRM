# Story 109 — Knowledge Base: Multi-locale content (Arabic/English)

## Goal

Let a Knowledge Base article carry real, distinct Arabic content
alongside its existing (English) content, and have the Customer Portal's
already-locale-routed KB browsing (Story 54) actually serve it — closing
`docs/architecture/10-i18n-and-rtl.md`'s own named gap ("Translatable...
Knowledge Base articles, uses a per-entity translations pattern...
decided by the feature story").

## Non-goals

- The existing base `title`/`body` columns on `KnowledgeBaseArticle` are
  kept, unchanged, as the permanent fallback/default-locale content —
  this story is purely additive. Every existing caller/test that never
  passes `locale` behaves identically to before.
- No Arabic-aware full-text search. Story 102's `searchArticles` stays
  exactly as-is, matching only the existing English `search_vector`
  column — a real, separable, materially larger sub-feature (a per-locale
  `tsvector`/GIN index, `to_tsvector('arabic', ...)` for Arabic content)
  that doesn't block this story's actual goal (serving already-set
  Arabic content to portal readers) and is deferred to its own future
  story.
- No admin authoring UI in `apps/web`'s KB editor (no locale tab/switcher
  in the article-edit screen). Translations are set through a new, fully
  tested API endpoint (`PUT .../translations/:locale`) — real, valuable,
  and independently useful (e.g. a future admin UI, a bulk-import script,
  direct API use) even before a dedicated editor screen exists. A
  locale-tab editor is additive UX on an unchanged data model, appropriate
  for a later, separate story.
- No change to `apps/web`'s own KB list/detail views — agents managing
  content see the base article, unaffected by this story.
- No per-locale versioning. `KnowledgeBaseArticleVersion` (Story 65)
  continues to snapshot only the base content on publish, unchanged.
- No locale beyond `EN`/`AR` — the only two locales `next-intl`'s own
  catalogs (`messages/en.json`/`messages/ar.json`) support anywhere in
  this repository.

## Design

### Schema (`apps/api/prisma/schema.prisma`)

- New enum `KbLocale { EN AR }` (`knowledge_base` schema).
- New model `KnowledgeBaseArticleTranslation`: `id`, `articleId` (FK,
  `onDelete: Cascade`), `locale: KbLocale`, `title: String`,
  `body: String`, `createdAt`, `updatedAt`. `@@unique([articleId, locale])`
  — at most one translation per article per locale. `@@index([articleId])`.
- `KnowledgeBaseArticle` gains `translations KnowledgeBaseArticleTranslation[]`.
- Migration: creates the enum + table only. **No data backfill** — an
  article with no `AR` translation row already falls back correctly to
  its own base `title`/`body` (see Design, below), which is exactly
  today's real content; a backfilled "EN" row would be redundant with
  that same fallback, not a behavior change.

### Backend (`apps/api/src/modules/knowledge-base`)

- `ListArticlesQueryDto`/`getArticle`/`getPublishedArticleForBranch`
  gain an optional `locale?: KbLocale` (via `?locale=EN|AR`, `@IsEnum`).
  Every read method resolves locale via one shared helper: if `locale`
  is given and a matching `KnowledgeBaseArticleTranslation` row exists,
  its `title`/`body` are returned instead of the base article's own —
  otherwise the base `title`/`body`, unchanged. Fetched via
  `include: { translations: locale ? { where: { locale } } : false }` —
  at most one extra row per article, no N+1.
- `searchArticles`'s raw SQL is untouched — still matches only the base
  `search_vector` column (English), regardless of any `locale` param (see
  Non-goals).
- New `SetArticleTranslationDto { title: string; body: string }` (both
  required, `MinLength(1)`, mirrors `CreateArticleDto`'s own validation
  level).
- New service methods: `setArticleTranslation(articleId, locale, dto)` —
  `findArticleInScope` first (branch/404 guarantee, unchanged), then
  `prisma.knowledgeBaseArticleTranslation.upsert(...)` keyed on
  `articleId_locale`; `listArticleTranslations(articleId)` — same scope
  guarantee, returns every translation for that article.
- New routes on `KnowledgeBaseController` (agent-facing, reuses existing
  permissions — no new permission key, mirrors Story 65's own "reuses
  `kb:read`" precedent):
  - `PUT knowledge-base/articles/:id/translations/:locale` (`kb:update`).
  - `GET knowledge-base/articles/:id/translations` (`kb:read`).
- `PortalKnowledgeBaseController`'s two existing routes forward
  `query.locale` through unchanged otherwise — portal callers were
  already using `ListArticlesQueryDto` for `search`; the new `locale`
  field is optional on the same DTO, so no new query-param plumbing.

### Portal (`apps/portal`)

- `knowledge-base-api.ts`: `listPublishedArticles(search?, locale?)` /
  `getPublishedArticle(id, locale?)` add a `locale` query param (same
  `toQueryString` helper, extended).
- `use-portal-knowledge-base.ts`: both hooks accept `locale`, pass it
  through; query keys include `locale` so switching locale doesn't serve
  a stale cached response for the other one.
- `article-list-view.tsx`/`article-detail-view.tsx`: pass the active
  `next-intl` locale (already destructured off `useParams()` in both
  files today, previously unused for this purpose) into the query hooks,
  uppercased to match `KbLocale`'s `EN`/`AR` values.

## Acceptance criteria

- [ ] New `KnowledgeBaseArticleTranslation` table/enum; no data backfill;
      every existing KB read/write path behaves identically when `locale`
      is omitted.
- [ ] `PUT .../:id/translations/:locale` upserts a translation (agent,
      `kb:update`); `GET .../:id/translations` lists them (agent,
      `kb:read`); both scoped through the existing branch/404 guarantee.
- [ ] `GET .../articles`, `GET .../articles/:id`, and their two portal
      counterparts, given `?locale=AR`, return the `AR` translation's
      `title`/`body` when one exists, else the base article's own —
      identical to today's response when `locale` is omitted or no
      translation exists for the requested locale.
- [ ] `searchArticles` (Story 102) is unmodified — full-text search
      still matches only the base English content.
- [ ] Portal's `ArticleListView`/`ArticleDetailView` request content in
      the visitor's own active locale.
- [ ] Unit coverage: locale-fallback resolution (translation present /
      absent / `locale` omitted) across all four read methods;
      `setArticleTranslation` (`upsert` semantics, scope/404 guarantee);
      `listArticleTranslations`.
- [ ] e2e coverage: an admin sets an `AR` translation, then a portal
      request with `?locale=AR` returns it; a request with no matching
      translation (or `locale` omitted) still returns the base content,
      end to end.
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures.

## Verification plan

```
pnpm --filter @crm/api exec prisma migrate dev --name add_kb_article_translations
pnpm --filter @crm/api exec vitest run src/modules/knowledge-base
pnpm --filter @crm/portal exec vitest run src/hooks/use-portal-knowledge-base.spec.ts src/components/knowledge-base
npx vitest run test/knowledge-base.e2e-spec.ts test/portal-knowledge-base.e2e-spec.ts --no-file-parallelism   # from apps/api, .env sourced
pnpm --filter @crm/api test
pnpm --filter @crm/portal test
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full sweep
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
