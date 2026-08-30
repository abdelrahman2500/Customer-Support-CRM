# Story 64 — Knowledge Base — Article Search (Foundation)

## Prerequisites

- `knowledge-base-foundation` Story 51: `KnowledgeBaseArticle`, `KnowledgeBaseController`/`KnowledgeBaseService`.
- `customer-portal-knowledge-base-browsing` Story 54: `PortalKnowledgeBaseController`, `listPublishedArticlesForBranch`.

---

## Story Goal

Let a caller (agent or portal Contact) filter the article list by a free-text search term matching `title` or `body`. Closes the gap `KnowledgeBaseArticle`'s own Story 51 doc comment discloses: *"No full-text/vector search consumption."*

**Not in scope**: Postgres `tsvector`/GIN full-text search (ranking, stemming) — deferred until this simpler mechanism's relevance/performance is a *measured* problem, mirroring `reporting-analytics-foundation`'s own "direct queries before materialized views" precedent (`$queryRaw` is used exactly once anywhere in this codebase today, for a trivial healthcheck — a real parameterized raw-SQL query is a bigger architectural "first" than this foundation slice warrants); `pgvector` semantic/embedding-based retrieval (blocked transitively on AI Services — needs a real embedding-model call); `pg_trgm` fuzzy/typo-tolerant matching; searching `category`; result highlighting/snippets; debounced input (no debounce precedent exists anywhere in this codebase — React Query's own caching is enough for a foundation slice).

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma:721-728` — `KnowledgeBaseArticle`'s own doc comment, the exact disclosed gap this story closes.
2. `apps/api/src/modules/knowledge-base/knowledge-base.service.ts` — `listArticles`/`listPublishedArticlesForBranch`, the exact two query sites this story extends; neither is modified in a breaking way (both keep working with zero args exactly as before).
3. `apps/api/src/modules/tickets/dto/list-tickets-query.dto.ts` — the exact `@Query()` DTO shape to mirror; its own doc comment already disclosed "no search... inventing one is out of scope" for *that* story, confirming there is no existing search-param precedent anywhere in this codebase to reuse — this story is the first.
4. `apps/web/src/components/knowledge-base/article-list-view.tsx` / `apps/portal/src/components/knowledge-base/article-list-view.tsx` — the exact list shape (loading/error/empty/populated) both get a search input added to, above the existing list, no other behavior changed.

---

## Design decisions

1. **`contains`/`mode: "insensitive"` Prisma filter on `title` OR `body`, not `tsvector`** — see Story Goal's Not-in-scope for the full reasoning; this needs no migration, no new column, no raw SQL, and is a standard, already-typed Prisma capability.
2. **One new `ListArticlesQueryDto`** (`search?: string`, `@IsOptional() @IsString()`), reused by both the agent (`KnowledgeBaseController`) and portal (`PortalKnowledgeBaseController`) routes — same shape, no reason for two DTOs.
3. **Empty/missing `search` behaves exactly as today** — the `OR` filter clause is only added when `search` is a non-empty string; every existing caller (and every existing test) continues to see the unfiltered list.
4. **No debounce, no new query-key convention beyond what `ticketsQueryKey(filters)` already establishes** — `articlesQueryKey`/`publishedArticlesQueryKey` become functions of `search` (mirrors `use-tickets.ts`'s own `ticketsQueryKey = (filters) => ["tickets", filters]` shape), so a changed search term is its own cache entry; no debounce precedent exists anywhere in this codebase to extend.
5. **No new permission** — reuses `kb:read` (agent) and the portal route's existing no-permission/contact-JWT-scoped shape; this is a read-side filter, not a new capability.

---

## Implementation Tasks

### Backend

1. **New `apps/api/src/modules/knowledge-base/dto/list-articles-query.dto.ts`** — `search?: string`.
2. **`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`** — `listArticles(search?: string)` and `listPublishedArticlesForBranch(branchId: string, search?: string)` both add the same conditional `OR` clause.
3. **`apps/api/src/modules/knowledge-base/knowledge-base.controller.ts`** — `list(@Query() query: ListArticlesQueryDto)`, passes `query.search` through.
4. **`apps/api/src/modules/portal/portal-knowledge-base.controller.ts`** — same `@Query()` addition on its `list()`.
5. **Tests** — see Test Plan.

### Frontend

6. **`apps/web/src/lib/knowledge-base-api.ts`** — `listArticles(search?: string)`, building a query string only when `search` is non-empty (mirrors `tickets-api.ts`'s own `toQueryString` convention).
7. **`apps/portal/src/lib/knowledge-base-api.ts`** — `listPublishedArticles(search?: string)`, same convention.
8. **`apps/web/src/hooks/use-knowledge-base.ts`** — `articlesQueryKey` becomes `(search?: string) => ["knowledge-base-articles", search ?? ""]`; `useArticlesQuery(search?: string)`.
9. **`apps/portal/src/hooks/use-portal-knowledge-base.ts`** — same shape for `publishedArticlesQueryKey`/`usePublishedArticlesQuery`.
10. **`apps/web/src/components/knowledge-base/article-list-view.tsx`** / **`apps/portal/src/components/knowledge-base/article-list-view.tsx`** — a plain, uncontrolled-by-anything-else search `Input`/`input` above the existing list, local `useState`, no debounce.
11. **i18n** — `apps/web/messages/{en,ar}.json` and `apps/portal/messages/{en,ar}.json`: `knowledgeBase.list.searchLabel`/`searchPlaceholder`/`noResults`.
12. **Tests** — see Test Plan.

---

## API contract

- `GET /knowledge-base/articles?search=...` — `kb:read` — same response shape as today; `search` matches `title` or `body`, case-insensitive substring; omitted/empty `search` returns the unfiltered list exactly as before.
- `GET /portal/knowledge-base/articles?search=...` — same filter, applied on top of the existing published-only/branch scoping.

## Tests

**Backend unit** (extend `knowledge-base.service.spec.ts`): no-search returns the unmodified query (regression-proof for existing callers); a search term produces the `OR`/`contains`/`insensitive` where-clause shape; both `listArticles` and `listPublishedArticlesForBranch` covered.

**Backend e2e** (extend `knowledge-base.e2e-spec.ts` and `portal-knowledge-base.e2e-spec.ts`): a real article matched by a title search; a real article matched by a body search; case-insensitivity; a non-matching search returns `[]`; a draft article never appears in a portal search result (existing published-only scoping still holds under a search filter).

**Frontend component**: search input wired to the query hook in both apps; empty vs. no-results states distinguished; every pre-existing list-view test passes unmodified (proves the addition is behavior-preserving by default).

## Regression requirements

Every existing test suite remains green, unweakened — especially both `ArticleListView`'s pre-existing tests, unmodified.

## Migration requirements

None — no schema change.

## Security risks/mitigations

- **No new injection surface**: Prisma's typed `contains`/`mode: "insensitive"` filter is parameterized by the query builder, never raw SQL string interpolation.
- **No new permission surface**: reuses `kb:read` and the portal route's existing scoping.
- **Branch/publication scoping unchanged**: the search filter is `AND`-ed onto the exact same `where` clause every existing call already used — a search term can never widen what a caller can see.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `search` query param works on both `GET /knowledge-base/articles` and `GET /portal/knowledge-base/articles`, matching `title`/`body`, case-insensitive.
- [ ] Omitted/empty `search` behaves identically to before this story, for every existing caller.
- [ ] Both frontends show a working search input above the existing list.
- [ ] Both locales translated for every new string, both apps.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Postgres `tsvector`/GIN full-text search, `pgvector` semantic retrieval, `pg_trgm` fuzzy matching, searching `category`, result highlighting/snippets, debounced input.
- Any README change.
