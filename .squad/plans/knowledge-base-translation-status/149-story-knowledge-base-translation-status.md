# Story 149 — Knowledge Base translation status

## Prerequisites

- Story 109 — `KnowledgeBaseArticleTranslation`, locale resolution, `PUT`/`GET .../translations`.
- Story 137 — Arabic authoring UI (`ArticleDetailView`'s locale tabs).
- Story 138 — Arabic full-text search (constrains query shape only; not modified).

## Goal

Make an article's translation state visible from the Knowledge Base article
list, so an agent can see at a glance which articles still need Arabic
instead of opening each one.

## What "translation status" means here

Taken from the existing product model — **not invented for this story**:

- `KnowledgeBaseArticle.title`/`body` are the base content. Story 137's
  **English tab edits these directly** via the ordinary article `PATCH`.
  Every article therefore always has English content.
- `KnowledgeBaseArticleTranslation` holds one row per `(articleId, locale)`,
  and Story 137's **Arabic tab writes the `locale: AR` row** via
  `PUT .../translations/AR`.
- `KbLocale` has exactly two members, `EN` and `AR`.

So the only translation that can be present or absent is Arabic, and
translation status is a **single boolean per article**:
`hasArabicTranslation`. There is no third state to model — an article either
has an `AR` row or falls back to its base English content, which is exactly
what `applyLocale` already does at read time.

An `EN` translation row is *possible* to write through the Story 109
endpoint but is never produced by the product's own authoring UI and is
never what the list is asking about, so it is deliberately not counted.

## Non-goals

- **A "needs Arabic" filter.** Justified on measurement, not taste:
  `listArticles` has two paths, and the search path is raw SQL with an
  existing `publishedOnly × hasCategory × (rows|count)` template explosion —
  8 literals in `searchArticles`, plus its Arabic sibling
  `searchArticlesInArabic`. A third filter dimension would roughly double
  both. That is disproportionate to the convenience, and the indicator is
  independently useful. Recorded as deferred, not forgotten.
- Any change to translation *authoring* (Story 137 owns that).
- Any portal-facing change. The portal falls back to English silently by
  design; a customer has no use for "this article is untranslated".
- Any change to `searchArticles`/`searchArticlesInArabic` SQL, the
  `search_vector` column, or locale resolution.
- Translation freshness ("the Arabic is older than the English"). There is
  no product concept for it today and inventing one is out of scope.

## Design

### Query shape — why a post-processing step, not `include`

`listArticles` returns rows from **two** different sources:

1. the Prisma `paginate(...)` path (no search), and
2. `$queryRaw` (search — Story 102 English, Story 138 Arabic).

A Prisma relation `include`/`_count` can only serve path 1. Rather than
implement the status twice — once as an `include`, once as extra SQL in
eight more template literals — this reuses the shape the same file already
established for exactly this problem: `applyLocale`, documented as
resolving translations "in one batched query (never N+1)".

`attachTranslationStatus(articles)` mirrors it exactly:

```
one findMany: where { articleId: { in: [...pageIds] }, locale: "AR" }
             select { articleId }        // ids only, never title/body
-> Set<articleId>
-> articles.map(a => ({ ...a, hasArabicTranslation: set.has(a.id) }))
```

**One query per page, regardless of page size**, on both paths, with zero
SQL changes. An empty page short-circuits without querying at all.

### Type

`ArticleListItem = ArticleSummary & { hasArabicTranslation: boolean }`,
mirroring `TicketsService`'s own existing `TicketSummary` / `TicketListItem`
split. Keeping it off `ArticleSummary` is deliberate: `getArticle` and every
portal read return `ArticleSummary`, and none of them should grow an
agent-facing field.

### UI

A fourth column on the existing agent `Table` in `ArticleListView`, using
the existing shared `Badge` — `success` when translated, `secondary`
(neutral, not `destructive`) when not. An untranslated article is a normal,
valid state, not an error, and the base English content still serves every
reader; colouring it red would misrepresent it.

No new component, no new primitive, no portal change.

## Files expected to change

| File | Change |
|------|--------|
| `apps/api/src/modules/knowledge-base/knowledge-base.service.ts` | `ArticleListItem` type, `attachTranslationStatus`, `listArticles` return type |
| `apps/api/src/modules/knowledge-base/knowledge-base.controller.ts` | return type only |
| `apps/api/test/knowledge-base.e2e-spec.ts` | translation-status cases |
| `apps/web/src/lib/knowledge-base-api.ts` | `ArticleListItem` type on the list response |
| `apps/web/src/components/knowledge-base/article-list-view.tsx` | fourth column + badge |
| `apps/web/src/components/knowledge-base/article-list-view.spec.tsx` | column tests |
| `apps/web/messages/en.json`, `apps/web/messages/ar.json` | column + badge copy |

## Acceptance criteria

- [ ] `GET /knowledge-base/articles` returns `hasArabicTranslation` on every item.
- [ ] `true` exactly when an `AR` translation row exists; `false` otherwise.
- [ ] Mixed states within one page resolve per-article, not per-page.
- [ ] Correct across pagination, and on the search path as well as the plain listing path.
- [ ] Exactly **one** additional DB query per page, independent of page size — asserted, not assumed.
- [ ] An empty page issues no additional query.
- [ ] Ordering, pagination semantics, the response envelope, branch scoping and permissions are unchanged.
- [ ] `getArticle` and every portal response are byte-for-byte unchanged.
- [ ] The agent list shows a translated/untranslated badge per row, in both locales.

## Verification plan

- `apps/api` unit + `knowledge-base.e2e-spec.ts` (translation present / missing / mixed / paginated / searched / empty).
- An explicit N+1 guard: count `knowledge_base_article_translations` queries for a multi-article page and assert it is 1.
- `apps/web` unit (`article-list-view.spec.tsx`).
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Final `git diff` audit.
