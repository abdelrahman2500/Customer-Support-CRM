# Story 138 — Arabic Knowledge Base full-text search

---

## Prerequisites

- **Story 102 completed** — created `knowledge_base_articles.search_vector` (a STORED generated column over the **English** config) and the private `searchArticles` `$queryRaw` helper. Its English behaviour is the thing this story must not disturb.
- **Story 109 completed** — see [../kb-multi-locale/109-story-kb-multi-locale.md](../kb-multi-locale/109-story-kb-multi-locale.md). It created `KnowledgeBaseArticleTranslation`, the `KbLocale` enum, `LocaleQueryDto`, and `applyLocale`/`applyLocaleToOne`/`applyLocaleToPage`. It explicitly deferred this story: *"No Arabic-aware full-text search… a real, separable, materially larger sub-feature… deferred to its own future story."*
- **Story 137 completed** (`27a3805`) — see [../add-arabic-locale-tab-editing-for-knowledge-base-articles/137-story-add-arabic-locale-tab-editing-for-knowledge-base-articles.md](../add-arabic-locale-tab-editing-for-knowledge-base-articles/137-story-add-arabic-locale-tab-editing-for-knowledge-base-articles.md). The Arabic authoring UI. It is what makes Arabic content exist and therefore what makes this gap reachable.
- **Story S-8c** — paging on the search path (`page`/`pageSize`/`totalPages`, `applyLocaleToPage`).
- **RM-05 / RM-27** — the `status` and `categoryId` filters the Arabic path must honour.
- **Story 132's migration** is the convention precedent for hand-written SQL — read its header comment before writing this story's migration.

---

## Story Goal

Story 137 gave agents an Arabic authoring UI, so Arabic Knowledge Base content now exists. It cannot be found. `knowledge_base_articles.search_vector` covers the **base article only**, in the English config; `knowledge_base_article_translations` is not indexed and no query path ever searches it.

Add **locale-routed Arabic full-text search**:

1. When the requested locale is `AR` **and** a non-empty `search` is supplied, match Arabic translation rows using PostgreSQL's built-in `arabic` configuration.
2. Return the existing `ArticleSummary` page envelope, honouring `publishedOnly`, `categoryId` and branch scope.
3. Leave English/base-article search **byte-for-byte unchanged**.

**Backend only.** Both frontends already send `search` and `locale`; no client change is expected.

**Explicitly not in scope:** English translation-table FTS, cross-locale search, unioning or co-ranking English and Arabic result sets, any change to `search_vector` or its GIN index, `simple` config, `pg_trgm`, application-level Arabic tokenization, category translation, UI changes, and new filters unrelated to locale.

---

## Context — Read These Files First

1. `apps/api/src/modules/knowledge-base/knowledge-base.service.ts` — the file is **758 lines**. Read these regions specifically:
   - `listArticles` at **line 157** — the agent path. It trims `search`, routes to `searchArticles` with `{ status, categoryId }`, then wraps in `applyLocaleToPage(..., query.locale)`.
   - `listPublishedArticlesForBranch` at **line 369** — the portal path. Same routing with `{ publishedOnly: true }`; its non-search branch builds `where: { branchId, status: "PUBLISHED" }` at **line 397**.
   - `applyLocale` at **line 473** — a batched `findMany({ articleId: { in: [...] }, locale })` that substitutes translation `title`/`body` **after** matching. Reuse this batching shape; **do not** introduce a per-row query.
   - `applyLocaleToOne` at **line 501**, `applyLocaleToPage` at **line 696**.
   - `searchArticles` at **line 573** — the core of this story. **Eight** raw SQL blocks, not four: the row queries occupy **~594–649** and the `COUNT(*)::int` queries **~650–681**, each selected by `publishedOnly` × `hasCategory`. `const total` is at **683** and the return envelope at **684–690**.
   - `interface RawArticleRow` at **line 713** and `toArticleSummary` at **line 731** — the raw column shape every `$queryRaw` block selects and the mapper applied to it.
2. `apps/api/src/modules/knowledge-base/dto/list-articles-query.dto.ts` — the whole file. It already carries `search`, `locale` (`KbLocale`), `status`, `categoryId`, plus `page`/`pageSize` via `PaginationQueryDto`. **No DTO change is required.**
3. `apps/api/prisma/schema.prisma` — `KnowledgeBaseArticleTranslation` at **~line 1411**: `@@unique([articleId, locale])`, `@@index([articleId])`, `onDelete: Cascade`. **`title` and `body` are both NOT NULL**, so `coalesce()` must **not** appear in the index or query expression.
4. `apps/api/prisma/migrations/20260916000000_add_customer_contact_anonymized_at/migration.sql` — the whole file (short). The convention precedent: *"Hand-written rather than generated: `prisma migrate dev` has twice on this repository picked up unrelated pre-existing drift… Zero DROP, zero ALTER of any existing column, constraint or referential action here."*
5. `apps/api/prisma/migrations/20260902063515_add_kb_article_search_vector/migration.sql` — the whole file. Story 102's generated column and its GIN index. **This file's objects must not be touched by this story.**
6. `apps/api/src/modules/knowledge-base/knowledge-base.service.spec.ts` — the search-path tests at **~lines 290–340** assert by reading `prisma.$queryRaw.mock.calls[0]`, joining the template strings and checking substrings (`"'PUBLISHED'"`, `"a.category_id"`) and interpolated `values`. The locale tests at **~lines 391–460** cover translation resolution and *"never queries translations when locale is omitted"*.
7. `apps/api/test/knowledge-base.e2e-spec.ts` — `describe("full-text search (Story 102)")` at **line 348** (3 cases: stemming, AND semantics, relevance ordering), `describe("translations")` at **line 447**, `describe("pagination (Story S-8c)")` at **line 618**.
8. `apps/api/test/portal-knowledge-base.e2e-spec.ts` — `describe("locale")` at **line 207**, the search case at **line 180**, and `describe("pagination (Story S-8c)")` at **line 304** including *"pages a search without surfacing a draft"* at **line 340**.
9. Grep `websearch_to_tsquery` in `apps/api/src` to confirm all eight occurrences live in `searchArticles` and nowhere else.

---

## Product rules (from story)

| | Current behaviour | New behaviour |
|---|---|---|
| `search` + `locale=AR` | English FTS over base article; Arabic terms return **0 rows** | Arabic FTS over `AR` translation rows |
| `search` + `locale=EN` or no locale | English FTS over base article | **Unchanged** |
| No `search` | Plain paginated listing, then `applyLocale` | **Unchanged** |
| Result display | `applyLocale` substitutes AR `title`/`body` after matching | **Unchanged** |
| `publishedOnly` / `categoryId` / branch scope | Enforced on the English path | Enforced identically on the Arabic path |

---

## Design decisions

These four resolve the intake's open questions. Items 1–3 were settled by measurement against the running container at `27a3805`; item 4 is a scoping decision.

### 1 — Locale routing: only `AR` takes the Arabic path

`locale === "AR"` **and** a non-empty trimmed `search` → Arabic translation FTS. Everything else — `locale === "EN"`, `locale` omitted, or no search term — takes the existing path completely unchanged. `EN` must **not** search the translations table; that is the "no English translation-table FTS" non-goal.

### 2 — No union, and the consequence is accepted

Arabic search matches **only** `AR` translation rows. An article with English-only content is therefore **unfindable in an Arabic search**, even when its base content would match. This is a deliberate accepted consequence of non-goal 8, not an oversight — `ts_rank` scores from two different text-search configurations are not comparable, so merging would require inventing a normalisation rule. Record it in the implementation's doc comment so a later reader does not "fix" it.

### 3 — Partial GIN expression index — **verified by EXPLAIN, not assumed**

Use a **partial** expression index scoped to `locale = 'AR'`. This was proven against the live container inside a rolled-back transaction, at 20,000 synthetic rows:

```
Bitmap Heap Scan on t_probe
  Recheck Cond: ((to_tsvector('arabic'::regconfig, ((title || ' '::text) || body)) @@ '''دعم'''::tsquery)
                 AND (locale = 'AR'::knowledge_base."KbLocale"))
  ->  Bitmap Index Scan on t_probe_ar_gin
        Index Cond: (to_tsvector('arabic'::regconfig, ((title || ' '::text) || body)) @@ '''دعم'''::tsquery)
```

Two facts this pins down. First, the planner **does** prove the partial predicate is implied by a query carrying `locale = 'AR'`, so the `t.locale = 'AR'` filter **must stay in the query** — drop it and the index becomes unusable. Second, the query term `الدعم` was normalised to `'دعم'` on the **query** side too, which is what makes the definite-article acceptance criterion pass.

At the table's current size (2 rows) the planner will instead pick the existing `(article_id, locale)` unique index and apply the FTS as a `Filter` — that is correct small-table behaviour and **is not** an index failure. Do not chase it.

### 4 — Mirror the four-way branching; do not refactor the English blocks

The Arabic path gets its own `publishedOnly` × `hasCategory` branching, parallel to the English one. The eight existing English blocks are **not** touched, restructured or deduplicated — consolidating them is explicitly out of scope and would put the load-bearing English regression criterion at risk for no gain in this story.

---

## Backend Tasks

### 1 — The migration

**Create file:** `apps/api/prisma/migrations/<UTC-timestamp>_add_kb_article_translation_arabic_fts_index/migration.sql`

Follow the directory naming already in use (`20260916000000_add_customer_contact_anonymized_at`): a 14-digit UTC timestamp, underscore, snake_case description. Use a timestamp later than `20260916000000`.

**Write the SQL by hand.** Do **not** run `prisma migrate dev` — Story 132's migration header records that it *"has twice on this repository picked up unrelated pre-existing drift"*, and 21 of the 69 existing migrations carry a comment about the `search_vector` generated column for exactly this reason.

```sql
-- Story 138 — Arabic Knowledge Base full-text search.
--
-- Additive only: one partial expression index. Zero DROP, zero ALTER of any
-- existing column, constraint, index or referential action. Story 102's
-- `knowledge_base_articles.search_vector` generated column and its GIN index
-- are deliberately untouched.
--
-- Hand-written rather than generated, following this repository's standing
-- convention (see 20260916000000_add_customer_contact_anonymized_at): `prisma
-- migrate dev` repeatedly misreads `search_vector` as plain-column drift and
-- emits destructive statements alongside the intended change.
--
-- PARTIAL on `locale = 'AR'`: the query always filters on that same predicate,
-- and PostgreSQL was confirmed (EXPLAIN, 20k rows) to prove the implication
-- and choose a Bitmap Index Scan. The index expression below must stay
-- character-for-character identical to the one in
-- `KnowledgeBaseService.searchArticles`, or the planner cannot match it.
--
-- `title`/`body` are NOT NULL on this table, so no `coalesce()` — unlike
-- Story 102's expression over the nullable base-article columns.
CREATE INDEX "knowledge_base_article_translations_arabic_fts_idx"
  ON "knowledge_base"."knowledge_base_article_translations"
  USING GIN (to_tsvector('arabic', "title" || ' ' || "body"))
  WHERE "locale" = 'AR';
```

**No `schema.prisma` change.** Prisma has no representation for an expression index, and the existing base-article GIN index is deliberately absent from the schema for the same reason. Adding anything here would reintroduce the drift this convention avoids.

### 2 — The Arabic search branch

**File:** `apps/api/src/modules/knowledge-base/knowledge-base.service.ts`

Add a private sibling to `searchArticles` (which ends at line **691**). Give it the same signature shape and the same return type, so the two are interchangeable from the caller's perspective:

```ts
/**
 * Story 138 — Arabic full-text search over `AR` translation rows, using
 * PostgreSQL's built-in `arabic` configuration (the `arabic_stem` Snowball
 * dictionary — core Postgres, no extension). `searchArticles` above stays
 * exactly as Story 102 wrote it and continues to serve every other locale.
 *
 * Matches translations only, never the base article: an English-only article
 * is deliberately unfindable in an Arabic search. Unioning the two is out of
 * scope — `ts_rank` scores from two different text-search configurations are
 * not comparable, so merging them would need a normalisation rule this story
 * does not invent.
 *
 * `t.locale = 'AR'` must stay in every query below: the supporting index is
 * PARTIAL on that predicate, and the planner only uses it when the query
 * implies it (confirmed by EXPLAIN against a 20k-row table).
 *
 * The `to_tsvector('arabic', t.title || ' ' || t.body)` expression must stay
 * character-for-character identical to the migration's index expression.
 * No `coalesce()` — both columns are NOT NULL on this table.
 */
private async searchArticlesInArabic(
  branchId: string,
  search: string,
  pagination: { page?: number; pageSize?: number } = {},
  options: {
    publishedOnly?: boolean;
    status?: KnowledgeBaseArticleStatus;
    categoryId?: string;
  } = {},
): Promise<Paginated<ArticleSummary>> {
```

Mirror `searchArticles`' body structure exactly:

- Same `page`/`pageSize`/`offset` derivation, same `DEFAULT_PAGE_SIZE` fallback.
- Same `const publishedOnly = options.publishedOnly || options.status === "PUBLISHED"` collapse (RM-05's rule).
- Same `hasCategory` guard.
- Same `Promise.all([rows, countRows])` shape, four row branches and four count branches.
- Same `COUNT(*)::int` — a bare `COUNT(*)` returns `bigint`, which the driver hands back as a `BigInt` that `JSON.stringify` refuses to serialise (`searchArticles`' own doc comment).
- Same final envelope: `{ items: rows.map(toArticleSummary), total, page, pageSize, totalPages: totalPagesFor(total, pageSize) }`.

Each row query selects the **same `RawArticleRow` columns from the articles table** (line **713** defines that shape) and joins the translations table only as the match target:

```sql
SELECT a.id, a.branch_id AS "branchId", a.title, a.body,
       a.category_id AS "categoryId", kbc.name AS "categoryName", a.status,
       a.published_at AS "publishedAt", a.created_at AS "createdAt",
       a.updated_at AS "updatedAt"
FROM knowledge_base.knowledge_base_articles AS a
JOIN knowledge_base.knowledge_base_article_translations AS t
  ON t.article_id = a.id AND t.locale = 'AR'
LEFT JOIN knowledge_base.knowledge_base_categories AS kbc ON kbc.id = a.category_id
WHERE a.branch_id = ${branchId}
  AND to_tsvector('arabic', t.title || ' ' || t.body)
      @@ websearch_to_tsquery('arabic', ${search})
ORDER BY ts_rank(to_tsvector('arabic', t.title || ' ' || t.body),
                 websearch_to_tsquery('arabic', ${search})) DESC, a.id DESC
LIMIT ${pageSize} OFFSET ${offset}
```

The `publishedOnly` variants add `AND a.status = 'PUBLISHED'`; the `hasCategory` variants add `AND a.category_id = ${categoryId}` — byte-identical to how the English blocks spell those two predicates. The count variants use the same `FROM`/`JOIN`/`WHERE` with `SELECT COUNT(*)::int AS count` and no `ORDER BY`/`LIMIT`/`OFFSET`.

The base-article `a.title`/`a.body` are selected and then overwritten by `applyLocale` downstream — that is the existing behaviour and is why no change to the select list is needed.

### 3 — Route to it

**File:** `apps/api/src/modules/knowledge-base/knowledge-base.service.ts`

In **`listArticles` (line 157)** and **`listPublishedArticlesForBranch` (line 369)**, the existing shape is a single `if (search) { return this.applyLocaleToPage(await this.searchArticles(...), query.locale); }`. Change only the helper selection, keeping the `applyLocaleToPage` wrapper and every argument as-is:

```ts
if (search) {
  const searchPage =
    query.locale === "AR"
      ? await this.searchArticlesInArabic(branchId, search, query, { /* same options */ })
      : await this.searchArticles(branchId, search, query, { /* same options */ });
  return this.applyLocaleToPage(searchPage, query.locale);
}
```

`listArticles` passes `{ status: query.status, categoryId: query.categoryId }`; `listPublishedArticlesForBranch` passes `{ publishedOnly: true }` plus whatever it passes today — **read both call sites and preserve their existing option objects exactly**.

`applyLocaleToPage` still runs on the Arabic path. Every matched article has an `AR` row by construction, so `applyLocale` will substitute it; the call is kept rather than skipped so both paths stay uniform.

### 4 — Frontend

**No frontend changes required.** Both `apps/web` and `apps/portal` already send `search` and `locale` on their KB list requests, and the response envelope is unchanged.

---

## Edge Cases & Failure Modes

- **Empty or whitespace-only `search`.** Both callers already `.trim()` and fall through to the non-search listing path before any routing decision. The Arabic branch must never be reached with an empty term. Enforced at `listArticles` line **157** and `listPublishedArticlesForBranch` line **369**; add no second guard.
- **`locale = 'AR'` with no `search`.** Plain paginated listing plus `applyLocale` — unchanged. Only the combination of both triggers the new path.
- **Article with no `AR` translation row.** The `JOIN … AND t.locale = 'AR'` is an inner join, so it produces no row. This is what satisfies "no Arabic hit when only the base matches" — it falls out of the join, not a filter.
- **Article whose base English content matches the Arabic query.** No Arabic hit. Deliberate (Design decision 2).
- **Draft article with a matching `AR` translation, portal caller.** `publishedOnly` adds `AND a.status = 'PUBLISHED'` to **both** the row and count queries. The count must carry it too, or `total` would leak the existence of a draft — the exact property `listPublishedArticlesForBranch`'s own comment calls *"as much a visibility rule as the branch is"*.
- **Duplicate rows from the join.** `@@unique([articleId, locale])` guarantees at most one `AR` row per article, so the inner join cannot fan out. Do **not** add `DISTINCT` — it would silently mask a future uniqueness regression.
- **`COUNT(*)` type.** Must be `COUNT(*)::int`. A bare `COUNT(*)` is `bigint` → `BigInt` → `JSON.stringify` throws.
- **Pagination determinism.** `ORDER BY ts_rank(...) DESC, a.id DESC`. Many Arabic rows will tie on rank; without the `a.id` tiebreaker a paged search repeats and drops rows, which is the reason `searchArticles`' own doc comment gives for the tiebreaker on this path specifically.
- **Index not used on the current tiny table.** With 2 translation rows the planner picks the `(article_id, locale)` unique index and filters. Correct behaviour, verified; not a defect. Judge index usability at scale, not on the dev dataset.
- **Expression drift between migration and query.** The single highest-risk failure: any difference — a `coalesce()`, different whitespace inside the string literal, a different concatenation order — silently disables the index while all tests still pass. Verify with `EXPLAIN` after the migration is applied.
- **Enum literal in raw SQL.** `t.locale = 'AR'` relies on the implicit cast to `knowledge_base."KbLocale"`. Verified working against the live container; the EXPLAIN output shows it resolved as `'AR'::knowledge_base."KbLocale"`.
- **Uncertainty, disclosed:** the `arabic_stem` Snowball dictionary does **not** handle Arabic broken plurals — `كلمات` was measured **not** to match content containing `كلمة`. Do not write an acceptance test that assumes broken-plural matching; light stemming and definite-article stripping are what this configuration provides.

---

## Test Plan

1. **Unit — Arabic SQL is emitted.** `apps/api/src/modules/knowledge-base/knowledge-base.service.spec.ts`: call the service with `{ search: "دعم", locale: "AR" }` and assert, using the file's existing convention of reading `prisma.$queryRaw.mock.calls[0]` and joining the template strings, that the SQL contains `to_tsvector('arabic'`, `websearch_to_tsquery('arabic'`, and `t.locale = 'AR'`.
2. **Unit — English SQL is unchanged.** Same call with `locale: "EN"` and with `locale` omitted asserts the emitted SQL still contains `a.search_vector` and `websearch_to_tsquery('english'`, and does **not** contain `'arabic'`.
3. **Unit — filters on the Arabic path.** Mirror the two existing cases at **~lines 295–310**: `status: "PUBLISHED"` puts `'PUBLISHED'` in the Arabic SQL; `categoryId` puts `a.category_id` in it and the id in the interpolated `values`.
4. **Unit — no Arabic path without a search term.** `{ locale: "AR" }` with no `search` must not emit any `$queryRaw`, mirroring the existing *"treats a whitespace-only search as no search at all"* case.
5. **Integration (e2e) — exact-form Arabic match.** `apps/api/test/knowledge-base.e2e-spec.ts`: seed an article, `PUT .../translations/AR`, then search `?search=الدعم&locale=AR` and expect the article.
6. **Integration — definite-article match.** Content containing `المرور`, query `مرور`, `locale=AR` → matches. **This is the load-bearing proof the `arabic` config is wired**; it was measured to fail under both `simple` and `english`.
7. **Integration — Arabic stemming.** A different inflection of the same word matches, mirroring the existing English *"matches a different inflection of the same word (stemming)"* case at **line ~403**. Do **not** use a broken plural (see Edge Cases).
8. **Integration — no cross-locale leakage.** An article whose **base English** content contains the search term but which has no `AR` translation returns **no** hit for that term with `locale=AR`.
9. **Integration — English regression.** All three existing cases in `describe("full-text search (Story 102)")` at **line 348** pass **unmodified**.
10. **Integration — portal visibility.** `apps/api/test/portal-knowledge-base.e2e-spec.ts`: a **draft** article with a matching `AR` translation is absent from both `items` **and** `total` for a portal caller searching in Arabic.
11. **Integration — pagination.** An Arabic search across more than one page returns a correct `total`, correct `totalPages`, no repeated or dropped rows between pages, and an empty page past the end — mirroring `describe("pagination (Story S-8c)")` at **line 618** / **line 304**.
12. **Integration — display.** A matched article's returned `title`/`body` are the **AR** values, proving `applyLocaleToPage` still runs on this path.
13. **Regression — unmodified suites.** The rest of `knowledge-base.e2e-spec.ts`, all of `portal-knowledge-base.e2e-spec.ts`, and `knowledge-base.service.spec.ts`'s existing cases pass without edits. **No existing assertion may be weakened** (`CLAUDE.md` §4).

---

## Migration / Rollback

**Apply:** `pnpm --filter @crm/api exec prisma migrate deploy` (or the repo's usual apply step) from the repo root. The statement is a single `CREATE INDEX`.

**Half-applied state:** there is none to worry about — one statement, and `CREATE INDEX` (non-concurrent) is transactional in PostgreSQL, so it either exists or does not.

**If the index is missing or wrong:** queries still return **correct results**, just via a sequential scan. Correctness never depends on the index; only performance does. That makes rollback safe.

**Rollback:** `DROP INDEX "knowledge_base"."knowledge_base_article_translations_arabic_fts_idx";`. Nothing else is created, so nothing else is undone.

**Do not** use `prisma migrate dev` at any point in this story.

---

## Verification Steps

1. **Baseline first:** from the repo root, `pnpm --filter @crm/api test` — record the real current counts before changing anything rather than assuming a historical number.
2. **Backend unit:** `pnpm --filter @crm/api test`
3. **Backend e2e:** `pnpm --filter @crm/api test:e2e`. Docker was healthy at `27a3805` (postgres, redis, minio, mailhog). If it is not at implementation time, record the environmental blocker exactly per `CLAUDE.md` §5 — do **not** fabricate a pass.
4. **Index is actually used** — the check that cannot be skipped. After applying the migration:
   ```
   docker exec -i customer-support-crm-postgres-1 psql -U crm -d crm -c "EXPLAIN (COSTS OFF) SELECT t.article_id FROM knowledge_base.knowledge_base_article_translations AS t WHERE t.locale = 'AR' AND to_tsvector('arabic', t.title || ' ' || t.body) @@ websearch_to_tsquery('arabic','دعم');"
   ```
   On the dev dataset (2 rows) a `Filter` plan is expected and correct. To prove the index is *matchable*, repeat inside a rolled-back transaction against a populated temp table, as this plan's Design decision 3 records.
5. **Index exists and is partial:**
   ```
   docker exec customer-support-crm-postgres-1 psql -U crm -d crm -c "\d knowledge_base.knowledge_base_article_translations"
   ```
   Confirm `knowledge_base_article_translations_arabic_fts_idx` is listed and shows `WHERE (locale = 'AR')`.
6. **Story 102's objects untouched:**
   ```
   docker exec customer-support-crm-postgres-1 psql -U crm -d crm -c "SELECT generation_expression FROM information_schema.columns WHERE table_schema='knowledge_base' AND table_name='knowledge_base_articles' AND column_name='search_vector';"
   ```
   Must still read `to_tsvector('english'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(body, ''::text)))`.
7. **Typecheck:** `pnpm typecheck`
8. **Lint:** `pnpm lint`
9. **Build:** `pnpm build`
10. **Frontend regression:** `pnpm --filter @crm/web test` and `pnpm --filter @crm/portal test` — neither should change, and neither app is edited.
11. **Scope containment:** `git status --short` and `git diff --stat` must list only `knowledge-base.service.ts`, its spec, the two e2e specs, and the one new migration directory. **No `schema.prisma` change**, no frontend file, no other migration.

---

## Done Criteria

- [ ] An Arabic-locale search with a non-empty term matches `AR` translation rows via `to_tsvector('arabic', ...)` / `websearch_to_tsquery('arabic', ...)`, ordered by `ts_rank` DESC with an `a.id DESC` tiebreaker.
- [ ] An exact-form Arabic query matches.
- [ ] A query for `مرور` matches content containing `المرور`.
- [ ] A different inflection of the same word matches (no broken-plural assumption).
- [ ] The response is the existing envelope: `items`/`total`/`page`/`pageSize`/`totalPages`.
- [ ] An article whose base English content matches but which has no `AR` translation produces **no** Arabic hit.
- [ ] An article with no `AR` translation row never produces an Arabic hit.
- [ ] English and Arabic result sets are **not** unioned or merged.
- [ ] English search is byte-for-byte unchanged — same rows, same ordering, same tiebreaker, same `COUNT(*)::int`.
- [ ] `knowledge_base_articles.search_vector` and its GIN index are not modified, dropped or recreated (verified by the `information_schema` query in Verification step 6).
- [ ] The eight existing English raw SQL blocks are unchanged.
- [ ] All three cases in `describe("full-text search (Story 102)")` pass unmodified.
- [ ] `publishedOnly` restricts the Arabic path, in **both** the row and count queries — a draft never appears in `items` or in `total`.
- [ ] `categoryId` filtering works on the Arabic path with the same exact-id semantics.
- [ ] Branch scoping is unchanged.
- [ ] `total` is accurate across pages; `page`/`pageSize`/`totalPages` behave as on the English path, including an empty page past the end.
- [ ] Paged Arabic search neither repeats nor drops rows.
- [ ] `applyLocaleToPage` still runs on the Arabic path — matched articles render AR `title`/`body`.
- [ ] Non-search locale fallback to base content is unchanged.
- [ ] One hand-written migration adds **only** the partial Arabic expression GIN index; zero DROP, zero ALTER.
- [ ] The index expression is character-for-character identical to the query expression, with **no `coalesce()`**.
- [ ] Index usage confirmed by `EXPLAIN`, not assumed.
- [ ] `prisma migrate dev` was not used.
- [ ] `schema.prisma` is unchanged.
- [ ] Unit tests assert the Arabic SQL is emitted for `locale=AR` and that English SQL is emitted otherwise.
- [ ] e2e coverage exists for Arabic search in the agent and/or portal suite.
- [ ] No `apps/web` or `apps/portal` file changed.
- [ ] API unit, API e2e, web, portal, typecheck, lint and build all green.
