# Story 102 — Knowledge Base: Full-Text Search

## Prerequisites

- `knowledge-base-foundation` Story 51 — `KnowledgeBaseArticle` (branch-scoped
  aggregate root, `title`/`body`/`category`/`status`).
- `knowledge-base-search` Story 64 — `listArticles`/
  `listPublishedArticlesForBranch`'s existing `search?` parameter,
  `ListArticlesQueryDto`, both `ArticleListView`s (web/portal) already
  wired to it.

All are complete and already merged to `main`.

## Story Goal

Replace `searchWhereClause`'s plain `contains`/`mode: "insensitive"`
substring match with real PostgreSQL full-text search
(`tsvector`/`websearch_to_tsquery`/`ts_rank`) on `KnowledgeBaseArticle`,
closing the gap `KnowledgeBaseService`'s own Story 64 doc comment already
discloses, and that `docs/architecture/04-data-and-multitenancy.md`/
`08-supporting-domains.md`/`12-risks-tradeoffs-and-scope.md` all
independently name as this domain's own documented initial search
mechanism.

## Non-Goals

- **Not vector/semantic/embeddings search.** `pgvector` (already
  provisioned at the DB level, per `00-overview.md`) is explicitly named
  in the architecture docs only for a later, AI-driven embeddings
  retrieval capability — a genuinely different, larger feature (would need
  an embeddings-generation pipeline, a model/provider decision, and a
  RAG-shaped consumer) than this Story's mandate ("PostgreSQL full-text
  search only — explicitly not vector/semantic/RAG").
- **Not `pg_trgm`/trigram fuzzy matching.** Also already provisioned but
  unused; a genuinely different technique (typo-tolerant similarity, not
  word-stemmed full-text matching) that no architecture doc names as
  Knowledge Base's mechanism. Left untouched for a genuinely separate
  future story if typo-tolerance is ever a measured need.
- **No Prisma `fullTextSearch` preview feature.** Stays off
  (`previewFeatures = ["postgresqlExtensions"]`, unchanged) — the
  full-text match itself goes through `$queryRaw`, not a new Prisma
  client-wide query-builder capability.
- **No frontend change.** Both `ArticleListView`s (web/portal) already
  send the exact same `search` string; only the backend matching
  mechanism changes. No new UI for advanced search syntax, filters, or a
  "sort by relevance vs. date" toggle.
- **No change to `createArticle`/`updateArticle`/`getArticle`/
  `getPublishedArticleForBranch`/`listArticleVersions`.** The generated
  `search_vector` column is maintained by Postgres itself on every
  `title`/`body` write — no application code needs to populate or update
  it, ever.
- **No backfill migration step.** `GENERATED ALWAYS AS (...) STORED`
  computes every existing row's value automatically as part of the
  `ALTER TABLE ... ADD COLUMN` statement itself — no separate `UPDATE`.
- **English-only text search configuration** (`to_tsvector('english',
  ...)`/`websearch_to_tsquery('english', ...)`), matching this codebase's
  existing "no runtime-configurable search language" scope (Arabic-locale
  UI strings are unaffected — this only concerns article-content
  stemming).

## Design decisions

1. **New migration**: a generated, indexed `tsvector` column on
   `knowledge_base.knowledge_base_articles`:
   ```sql
   ALTER TABLE "knowledge_base"."knowledge_base_articles"
     ADD COLUMN "search_vector" tsvector
     GENERATED ALWAYS AS (
       to_tsvector('english', coalesce("title", '') || ' ' || coalesce("body", ''))
     ) STORED;

   CREATE INDEX "knowledge_base_articles_search_vector_idx"
     ON "knowledge_base"."knowledge_base_articles"
     USING GIN ("search_vector");
   ```
   `GENERATED ALWAYS ... STORED` (not a trigger): Postgres maintains it on
   every `INSERT`/`UPDATE` of `title`/`body` automatically, and existing
   rows are computed as part of the `ALTER TABLE` itself — no backfill
   step, no application code ever writes to this column.

2. **`schema.prisma`**: `KnowledgeBaseArticle` gains
   ```prisma
   /// Story 102 — generated column (see this story's own migration SQL):
   /// `to_tsvector('english', title || ' ' || body)`, STORED, with a GIN
   /// index. `Unsupported` because Prisma Client has no native `tsvector`
   /// type — matched via `$queryRaw` in `KnowledgeBaseService`'s new
   /// `searchArticles` helper, never read or written through the client's
   /// typed `create`/`update`/`findMany` API (Postgres maintains it
   /// itself; `Unsupported` fields are automatically excluded from every
   /// generated input type, so no existing call site needs to change).
   searchVector Unsupported("tsvector")?
   ```

3. **New private `KnowledgeBaseService.searchArticles(branchId, search,
   options?: { publishedOnly?: boolean })`** — the actual `$queryRaw`
   full-text query, used by both `listArticles` (agent, no
   `publishedOnly`) and `listPublishedArticlesForBranch` (portal,
   `publishedOnly: true`):
   ```ts
   private async searchArticles(
     branchId: string,
     search: string,
     options: { publishedOnly?: boolean } = {},
   ): Promise<ArticleSummary[]> {
     const rows = options.publishedOnly
       ? await this.prisma.$queryRaw<RawArticleRow[]>`
           SELECT id, branch_id AS "branchId", title, body, category, status,
                  published_at AS "publishedAt", created_at AS "createdAt",
                  updated_at AS "updatedAt"
           FROM knowledge_base.knowledge_base_articles
           WHERE branch_id = ${branchId}
             AND status = 'PUBLISHED'
             AND search_vector @@ websearch_to_tsquery('english', ${search})
           ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${search})) DESC
         `
       : await this.prisma.$queryRaw<RawArticleRow[]>`
           SELECT id, branch_id AS "branchId", title, body, category, status,
                  published_at AS "publishedAt", created_at AS "createdAt",
                  updated_at AS "updatedAt"
           FROM knowledge_base.knowledge_base_articles
           WHERE branch_id = ${branchId}
             AND search_vector @@ websearch_to_tsquery('english', ${search})
           ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${search})) DESC
         `;
     return rows.map(toArticleSummary);
   }
   ```
   `websearch_to_tsquery` (not `plainto_tsquery`/`to_tsquery`): the
   standard choice for an unstructured, user-typed search box — handles
   multi-word AND-by-default matching, quoted phrases, and stray
   punctuation without throwing (unlike `to_tsquery`, which requires
   pre-formatted operator syntax and errors on invalid input). Ranked by
   `ts_rank` descending — the one deliberate behavior upgrade over the
   old `contains` filter (which always ordered by `updatedAt`/
   `publishedAt` regardless of match quality): a real full-text search's
   core value is relevance ranking, and doing the full query (not just an
   id lookup) in raw SQL costs no extra complexity over a two-step
   id-then-refetch approach while preserving that order. Uses Prisma's
   tagged-template `$queryRaw` (parameterized/injection-safe), never
   `$queryRawUnsafe`.

   `RawArticleRow` is a local interface matching `toArticleSummary`'s
   existing input shape exactly (`status` arrives as a plain string from
   `$queryRaw`, safely narrowed since it always originates from the
   `KnowledgeBaseArticleStatus` column).

4. **`listArticles`/`listPublishedArticlesForBranch`** branch on whether
   `search` is present/non-blank: no search → the exact existing Prisma
   `findMany` path (`updatedAt`/`publishedAt` order, unchanged); a search
   → the new `searchArticles` path. Mirrors `searchWhereClause`'s own
   existing "empty/missing search is always a pure no-op" convention
   (whitespace-only trimmed to empty, same as never having searched).

## Files expected to change

- `apps/api/prisma/schema.prisma` — `searchVector` field on `KnowledgeBaseArticle`.
- `apps/api/prisma/migrations/<timestamp>_add_kb_article_search_vector/migration.sql` — generated column + GIN index.
- `apps/api/src/modules/knowledge-base/knowledge-base.service.ts` — `searchArticles` helper, `listArticles`/`listPublishedArticlesForBranch` branch on it; `searchWhereClause` removed (dead code once both call sites stop using it).
- `apps/api/src/modules/knowledge-base/knowledge-base.service.spec.ts` — new unit tests (mocked `$queryRaw`).
- `apps/api/test/knowledge-base.e2e-spec.ts` — new full-text-search e2e tests (real Postgres).

No frontend files change.

## Acceptance / Done Criteria

- A search for a word finds articles containing a *different inflection*
  of that word in `title`/`body` (e.g. "connecting" matches a search for
  "connect") — the concrete capability `contains` could never provide.
- Multiple search words match articles containing all of them (AND
  semantics, `websearch_to_tsquery`'s default) — not just a literal
  substring of the whole phrase.
- Results are ordered by relevance (`ts_rank` descending), not always by
  `updatedAt`/`publishedAt`.
- An empty/whitespace-only `search` reproduces the exact pre-Story-102
  query (`updatedAt`/`publishedAt` order, no `WHERE` addition).
- A search matching nothing returns `[]`, not an error.
- Both `GET /knowledge-base/articles?search=...` (agent, `kb:read`) and
  `GET /portal/knowledge-base/articles?search=...` (portal) use the new
  matching; the portal path still returns only `PUBLISHED` articles.
- Branch scoping is preserved exactly: a search never returns another
  branch's articles.
- `createArticle`/`updateArticle` still succeed unmodified — the
  generated column requires no application-code write.

## Verification Plan

- `apps/api prisma:generate`, `apps/api` migrate (`--create-only` +
  `deploy`, this sandbox's established safe two-step per `CLAUDE.md` §5,
  since a single `migrate dev` has previously hung on an advisory-lock
  timeout here).
- `apps/api` unit: new `searchArticles`-path tests in
  `knowledge-base.service.spec.ts` (mocked `$queryRaw`) — then the full
  `pnpm --filter @crm/api test`.
- `apps/api` e2e: new tests in `knowledge-base.e2e-spec.ts` against the
  real Postgres/GIN index, run in isolation first, then a full
  `pnpm --filter @crm/api test:e2e` sweep (accepting the pre-existing,
  documented environmental failures — realtime-presence, reporting
  historical-data date-boundary pollution — as unrelated, per `CLAUDE.md`
  §5/§13 and this session's own Story 100/101 verification).
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `git status --short` / `git diff --stat` review before commit.
