# add-arabic-knowledge-base-full-text-search — plan overview

Entry point for the **add-arabic-knowledge-base-full-text-search** feature. Stories execute in order by their `NN` prefix.

Story 109 built the Knowledge Base translation model and deferred Arabic-aware search to *"its own future story"*, reasoning it did not block serving already-set Arabic content. Story 137 then shipped the Arabic authoring UI, so Arabic content now exists — and cannot be found. `knowledge_base_articles.search_vector` is a generated column over `to_tsvector('english', …)` covering the **base article only**; `knowledge_base_article_translations` is not indexed and no query path searches it. Measured against the live container at `27a3805`: the existing `search_vector` returned **0** rows for the Arabic term `الدعم`, while the translations table returned a hit for each of `الدعم`, `دعم` and `التواصل`.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 138 | [138-story-add-arabic-knowledge-base-full-text-search.md](./138-story-add-arabic-knowledge-base-full-text-search.md) | Arabic Knowledge Base full-text search — locale-routed Arabic FTS over `AR` translation rows using PostgreSQL's built-in `arabic` configuration, backed by one hand-written partial expression GIN index. Adds a sibling `searchArticlesInArabic` helper; the eight existing English raw SQL blocks are untouched. Backend only. | — *(created via `--no-tracker`)* | Stories 102, 109, 137 (`27a3805`) |

## Dependency notes

- **Story 102** created `search_vector`, its GIN index and the `searchArticles` `$queryRaw` helper. Its English behaviour is the load-bearing thing Story 138 must not disturb — the plan forbids touching any of the eight existing blocks or the generated column.
- **Story 109** ([../kb-multi-locale/109-story-kb-multi-locale.md](../kb-multi-locale/109-story-kb-multi-locale.md)) created the translation model, `KbLocale`, and `applyLocale`/`applyLocaleToPage`, and named this work in its own Non-goals. That deferral's stated reason — Arabic content not yet existing — no longer holds.
- **Story 137** ([../add-arabic-locale-tab-editing-for-knowledge-base-articles/137-story-add-arabic-locale-tab-editing-for-knowledge-base-articles.md](../add-arabic-locale-tab-editing-for-knowledge-base-articles/137-story-add-arabic-locale-tab-editing-for-knowledge-base-articles.md)) is what makes the gap reachable.
- **Story S-8c** owns paging on the search path; **RM-05/RM-27** own the `status` and `categoryId` filters the Arabic path must honour.
- **No DTO, controller or frontend dependency.** `ListArticlesQueryDto` already carries `search`, `locale`, `status`, `categoryId` and pagination, and both apps already send `search` and `locale`.

## Decisions settled by measurement before planning

A technical spike ran against the live `pgvector/pgvector:pg16` container (PostgreSQL **16.15**). Its findings are what make this plan concrete rather than speculative:

- **PostgreSQL 16 ships a built-in `arabic` configuration** (one of 29), using the core `arabic_stem` Snowball dictionary. **No extension is required** — an earlier assessment that claimed otherwise was wrong and is corrected here.
- `to_tsvector('arabic', …)` performs real stemming, **definite-article stripping** (`الخاصة`→`خاص`) and **hamza normalisation** (`إعادة`→`اعاد`). `simple` and `english` produce byte-identical output for Arabic — all three share the `default` parser, so Arabic already tokenises; only stemming differs. A query for `مرور` matches `المرور` under `arabic` and **does not** under `simple`, which is why `simple` was rejected.
- **A partial GIN expression index is planner-matchable**, proven by `EXPLAIN` inside a rolled-back transaction at 20,000 rows: `Bitmap Index Scan` on the partial index, with the query term itself stemmed. The `locale = 'AR'` predicate must stay in the query for the planner to prove implication.
- **`title`/`body` are NOT NULL** on the translations table, so the expression carries **no `coalesce()`** — unlike Story 102's expression over the nullable base columns. The index and query expressions must match character-for-character.
- **The Prisma generated-column drift hazard is project-wide, not story-specific.** 21 of 69 migrations reference `search_vector` across unrelated schemas; Story 132's migration documents the standing mitigation — hand-written SQL, never `prisma migrate dev`. Story 138 follows it as routine, not as an exception.

## Deliberately excluded

English translation-table FTS; cross-locale search; unioning or co-ranking English and Arabic results (`ts_rank` scores from two configurations are not comparable); any change to `search_vector`, its expression or its GIN index; refactoring the eight existing English raw SQL blocks; the `simple` configuration; `pg_trgm`; application-level Arabic tokenisation or normalisation (`arabic_stem` already does it natively); category translation; UI changes; and new filters unrelated to locale.

**One accepted consequence, recorded so it is a decision rather than a surprise:** because the result sets are not unioned, an article with English-only content is **unfindable in an Arabic search**, even when the reader would understand the English.
