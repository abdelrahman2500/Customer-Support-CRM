> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/knowledge-base-fulltext-search/knowledge-base-fulltext-search/intake.md`

---

## Feature

- **Feature name (display):** Knowledge Base — Full-Text Search
- **Feature slug (folder under `plans/`):** `knowledge-base-fulltext-search`

## Title

```text
Story 102 — Knowledge Base: Full-Text Search
```

## Description

```text
KnowledgeBaseService's own Story 64 doc comment discloses the gap: a
plain contains/mode:"insensitive" filter, "not tsvector/GIN full-text
search... deliberately deferred". The architecture docs independently
name tsvector as Knowledge Base's own documented initial search
mechanism (pgvector embeddings are a separate, later, AI-driven
capability). This story adds a generated tsvector column + GIN index on
KnowledgeBaseArticle and matches via websearch_to_tsquery/ts_rank
through $queryRaw (this codebase's existing, if singular, raw-SQL
precedent), replacing the substring filter on both the agent and portal
KB list endpoints. No frontend change - both ArticleListViews already
just pass the same search string through.
```

## Acceptance criteria

```text
- [ ] New migration: generated search_vector tsvector column
      (to_tsvector('english', title || ' ' || body), STORED) + GIN index
      on knowledge_base.knowledge_base_articles. No backfill step needed
      (GENERATED ALWAYS computes existing rows automatically).
- [ ] schema.prisma: KnowledgeBaseArticle gains
      searchVector Unsupported("tsvector")?.
- [ ] New KnowledgeBaseService.searchArticles(branchId, search, options)
      private helper: $queryRaw matching via
      search_vector @@ websearch_to_tsquery('english', search), ordered by
      ts_rank(...) DESC. options.publishedOnly for the portal path.
- [ ] listArticles/listPublishedArticlesForBranch branch: no search ->
      exact existing Prisma findMany path unchanged; a search -> the new
      full-text path. Empty/whitespace search is a pure no-op, same as
      today.
- [ ] Word-stemming works (e.g. "connect" matches "connecting"); multiple
      words AND-match; results ranked by relevance, not always by
      updatedAt/publishedAt.
- [ ] Branch scoping preserved; portal path still PUBLISHED-only.
- [ ] createArticle/updateArticle need no code change - the generated
      column is maintained by Postgres itself.
- [ ] New/updated tests: knowledge-base.service.spec.ts (mocked
      $queryRaw), knowledge-base.e2e-spec.ts (real Postgres/GIN index).
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or its
      documented isolated-file fallback), pnpm typecheck, pnpm lint, and
      pnpm build all pass.
```

## Dependencies

- Story 51 — `knowledge-base-foundation` (`KnowledgeBaseArticle`).
- Story 64 — `knowledge-base-search` (`listArticles`/
  `listPublishedArticlesForBranch`'s existing `search?` param,
  `ListArticlesQueryDto`, both `ArticleListView`s already wired to it).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Vector/semantic/embeddings search (`pgvector` — a separate, later,
  AI-driven capability per the architecture docs; explicitly excluded by
  this story's own mandate).
- `pg_trgm` trigram/fuzzy/typo-tolerant matching — a different technique,
  not named anywhere as Knowledge Base's mechanism.
- A Prisma `fullTextSearch` preview-feature flag change.
- Any frontend change — both `ArticleListView`s (web/portal) are
  unaffected.
- A "sort by relevance vs. date" UI toggle, or any advanced search syntax
  exposed to the user.
