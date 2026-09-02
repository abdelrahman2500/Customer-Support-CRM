# knowledge-base-fulltext-search — plan overview

Entry point for the **knowledge-base-fulltext-search** feature. Stories
execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 102 | [102-story-knowledge-base-fulltext-search.md](./102-story-knowledge-base-fulltext-search.md) | Knowledge Base — Full-Text Search | — | `knowledge-base-foundation` Story 51, `knowledge-base-search` Story 64 |

## Dependency notes

- Selected via the same whole-repository Recon that produced Stories
  99/100/101 — last of the four candidates, run after Customer list
  search per that Recon's own sequencing (a smaller, more directly
  precedented change than this one, which requires a new migration).
- **The gap**: `KnowledgeBaseService`'s own doc comment (Story 64)
  discloses it verbatim — *"a plain `contains`/`mode: 'insensitive'`
  filter... not `tsvector`/GIN full-text search, which this codebase has
  no existing raw-SQL precedent for... deliberately deferred until this
  simpler mechanism's relevance/performance is a measured problem."*
  `docs/architecture/04-data-and-multitenancy.md`,
  `08-supporting-domains.md`, and `12-risks-tradeoffs-and-scope.md` all
  independently name `tsvector` as Knowledge Base's own documented
  **initial** search mechanism (`pgvector` embeddings are a separate,
  later, explicitly-AI-driven capability — out of scope here, see
  Non-Goals).
- **Infrastructure already provisioned, unused**: `schema.prisma`'s own
  `datasource` block already declares `extensions = [pgvector(map:
  "vector"), pg_trgm]`, and the very first migration
  (`20260825111416_init/migration.sql`) already runs `CREATE EXTENSION
  IF NOT EXISTS "pg_trgm"` and `"vector"` — provisioned ahead of need per
  the architecture docs' own roadmap, but neither extension is consumed
  by any model, index, or query anywhere in this codebase yet. `pg_trgm`
  (trigram similarity/typo-tolerance) is a different technique from
  `tsvector` full-text search and is not named anywhere in the
  architecture docs as Knowledge Base's mechanism — left untouched,
  available for a genuinely separate future story. `pgvector` is
  explicitly named only for AI-embeddings retrieval, explicitly excluded
  by this Story's own mandate ("not vector/semantic/RAG").
- **No Prisma preview-feature change**: Prisma's own `fullTextSearch`
  preview feature (a `search:` filter operator) is NOT enabled in this
  schema (`previewFeatures = ["postgresqlExtensions"]` only) and adding it
  would flip a client-wide feature flag for one query — instead, the
  actual `tsvector`-matching query goes through `$queryRaw` (this
  codebase's own existing, if singular, precedent —
  `health.controller.ts`'s `$queryRaw\`SELECT 1\``, already flagged as the
  ligitimate escape hatch by Story 64's own doc comment), keeping every
  other Prisma-typed call site (`createArticle`/`updateArticle`/
  `getArticle`/`listArticleVersions`) completely untouched.
- **Dependency correctness**: builds only on infrastructure already fully
  in place — `KnowledgeBaseArticle` (Story 51), `listArticles`/
  `listPublishedArticlesForBranch`'s existing `search?` parameter and
  `ListArticlesQueryDto` (Story 64) — same request shape, same
  `search` query param, on both the agent (`kb:read`) and portal
  (`@PortalRoute()`) routes. No frontend change needed at all — both
  `ArticleListView`s (web/portal) already just pass their `search` string
  straight through; only the backend matching mechanism changes.
- **Architectural coherence**: one new generated column + one GIN index on
  the existing `KnowledgeBaseArticle` table, mirroring this repository's
  "extend the existing aggregate root, don't invent a new one" convention
  used throughout.
- **Product value**: real word-stemming/multi-word/ranked matching
  (`websearch_to_tsquery`+`ts_rank`) instead of a brittle raw substring
  match — searching "connect" now also finds "connecting"/"connection",
  and results rank by relevance instead of always by `updatedAt`.
- **Risk reduction**: none specific; purely additive (existing rows
  backfill their generated column automatically on migration; no
  application code outside the two `list*` methods changes).
- **Smallness**: bounded to one migration, one new private raw-SQL helper
  method, two call sites updated to use it — no new permission, no new
  route, no frontend change.
