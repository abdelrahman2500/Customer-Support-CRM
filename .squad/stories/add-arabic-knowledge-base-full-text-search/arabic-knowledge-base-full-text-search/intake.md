> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/add-arabic-knowledge-base-full-text-search/arabic-knowledge-base-full-text-search/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Arabic Knowledge Base full-text search
- **Feature slug (folder under `plans/`):** `add-arabic-knowledge-base-full-text-search`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** *(none — `squad new-story add-arabic-knowledge-base-full-text-search` was refused because `naming.includeTrackerId` is true and no id was supplied; created via the established `--no-tracker --title` fallback, the same path Stories 136 and 137 record)*
- **Work item type:** `Story` — backend capability
- **Status:** `Planned`
- **Assignee:** `(unassigned)`
- **Labels:** `knowledge-base`, `i18n`, `search`, `backend`

---

## Title

```
Arabic Knowledge Base full-text search
```

---

## Description

```
Approved from the post-Story-137 recon and a dedicated technical spike, both
run at commit 27a3805.

THE GAP, MEASURED AGAINST THE RUNNING DATABASE

Story 137 gave agents an Arabic authoring UI, so Arabic Knowledge Base
content now exists. It cannot be found.

`knowledge_base_articles.search_vector` is a STORED generated column:

    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))

It covers the BASE article only. `knowledge_base_article_translations` is
not indexed at all, and no query path ever searches it. Verified against
the live container at 27a3805, with 17 articles and 2 real AR translation
rows present:

  - querying the existing `search_vector` for the Arabic term "الدعم"
    returned 0 rows;
  - querying the translations table with `to_tsvector('arabic', ...)`
    returned 1 row for each of "الدعم", "دعم" and "التواصل".

So an Arabic reader gets Arabic article bodies (Story 109's `applyLocale`
substitutes them after matching) but cannot search for them in Arabic. An
English query returns rows rendered in Arabic.

WHAT THE SPIKE ESTABLISHED — MEASURED, NOT ASSUMED

The database is PostgreSQL 16.15 (`pgvector/pgvector:pg16`, host port
5433). It ships 29 built-in text-search configurations, including
`arabic`, which uses the built-in `arabic_stem` Snowball dictionary. No
extension is required. Installed extensions are `pg_trgm`, `plpgsql` and
`vector`.

Verified output on real Arabic text:

  to_tsvector('arabic','كيفية إعادة تعيين كلمة المرور الخاصة بك')
    -> 'اعاد':2 'بك':7 'تعيين':3 'خاص':6 'كلم':4 'كيف':1 'مرور':5

That is real stemming, definite-article stripping (الخاصة -> خاص) and
hamza normalization (إعادة -> اعاد). By contrast `simple` and `english`
produce byte-identical output for Arabic text — all three share the
`default` parser, so Arabic already tokenizes; only stemming differs.
Measured match behaviour: with the `arabic` config a query for "مرور"
matches content containing "المرور"; with `simple` it does not.

`to_tsvector(regconfig, text)`, `websearch_to_tsquery(regconfig, text)`
and `ts_rank` are all IMMUTABLE, so an expression index using a literal
config is legal.

GOAL

Locale-routed Arabic full-text search over Knowledge Base articles, using
PostgreSQL's built-in `arabic` configuration and an expression GIN index
on the translations table. English search behaviour is preserved exactly.

This is a BACKEND SEARCH story. No UI redesign, no new filters.
```

---

## Acceptance criteria

```
ARABIC SEARCH
- [ ] When the request locale is Arabic AND a non-empty search term is
      supplied, the search matches Arabic translation rows using
      `to_tsvector('arabic', ...)` and `websearch_to_tsquery('arabic', ...)`,
      ordered by `ts_rank` descending with a stable id tiebreaker.
- [ ] An exact-form Arabic query matches (e.g. a query for "الدعم" matches
      content containing "الدعم").
- [ ] A definite-article difference matches: a query for "مرور" matches
      content containing "المرور". This is the single clearest proof the
      `arabic` config is actually in use rather than `simple`/`english` —
      it was measured to fail under both of those.
- [ ] Arabic stemming matches a different inflection of the same word,
      mirroring the existing English stemming case in
      `knowledge-base.e2e-spec.ts`'s `describe("full-text search (Story 102)")`.
- [ ] The result shape is the existing `ArticleSummary` page envelope
      (`items`/`total`/`page`/`pageSize`/`totalPages`) — a caller cannot
      tell from the response shape which search path ran, which is the
      property `listArticles`' own doc comment already states.

NO CROSS-LOCALE LEAKAGE
- [ ] An article whose BASE (English) content matches the Arabic query but
      which has no matching AR translation does NOT produce an Arabic hit.
- [ ] An article with no AR translation row at all never produces an
      Arabic hit.
- [ ] Arabic and English result sets are NOT unioned or merged.

ENGLISH REGRESSION — LOAD-BEARING
- [ ] English/base-article search behaviour is byte-for-byte unchanged: the
      same rows, the same `ts_rank` ordering, the same `id DESC`
      tiebreaker, the same `COUNT(*)::int` total.
- [ ] `knowledge_base_articles.search_vector` and its GIN index are NOT
      modified, dropped or recreated.
- [ ] All three existing cases in
      `knowledge-base.e2e-spec.ts` `describe("full-text search (Story 102)")`
      (stemming, AND semantics, relevance ordering) pass unmodified.

VISIBILITY AND FILTERS
- [ ] `publishedOnly` still restricts results to `status = 'PUBLISHED'`;
      a draft is never surfaced to a portal caller, including through
      `total`.
- [ ] `categoryId` filtering still works on the Arabic path, matching the
      agent path's existing exact-id semantics.
- [ ] Branch scoping is unchanged — results stay confined to the caller's
      branch.

PAGINATION AND COUNT
- [ ] The Arabic path returns an accurate `total` counting every matching
      row regardless of page, using the same `COUNT(*)::int` convention
      (a bare `COUNT(*)` returns `bigint`, which the driver hands back as
      a `BigInt` that `JSON.stringify` refuses to serialise — see
      `searchArticles`' own doc comment).
- [ ] `page`/`pageSize`/`totalPages` behave exactly as on the English path,
      including an empty page past the end.
- [ ] Ordering is deterministic across pages (rank DESC plus an id
      tiebreaker), so a paged Arabic search does not repeat or drop rows.

DISPLAY BEHAVIOUR UNCHANGED
- [ ] Story 109's locale-aware display is intact: results still pass
      through `applyLocale`/`applyLocaleToPage`, so a matched article
      renders its AR `title`/`body`.
- [ ] An article with no translation for the requested locale still falls
      back to base content on non-search paths — unchanged.

MIGRATION AND INDEX
- [ ] A hand-written migration adds ONLY the Arabic expression GIN index on
      `knowledge_base.knowledge_base_article_translations`.
- [ ] The migration contains zero DROP and zero ALTER of any existing
      column, constraint, index or referential action.
- [ ] The index expression matches the query expression EXACTLY, so
      PostgreSQL can actually use it; this is verified with `EXPLAIN`
      against the running database, not assumed.
- [ ] `prisma migrate dev` is NOT used to generate the migration.
- [ ] No change to `schema.prisma` unless the chosen index shape strictly
      requires one (the existing base GIN index is deliberately not
      represented there either).

TESTS
- [ ] Unit tests in `knowledge-base.service.spec.ts` assert the Arabic SQL
      is emitted for an Arabic-locale search, following that file's own
      existing convention of inspecting `prisma.$queryRaw.mock.calls`
      template strings and interpolated values.
- [ ] API e2e coverage for Arabic search in
      `apps/api/test/knowledge-base.e2e-spec.ts` and/or
      `apps/api/test/portal-knowledge-base.e2e-spec.ts`.
- [ ] Existing Knowledge Base unit, e2e and portal tests pass unmodified.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** None. Story 137 (`27a3805`) is complete and pushed.
- **Depends on code areas or other stories:**
  - **Story 102** — created `search_vector` and the `searchArticles` `$queryRaw` helper. Its English behaviour is the thing this story must not disturb.
  - **Story 109** — created `KnowledgeBaseArticleTranslation`, `KbLocale`, `LocaleQueryDto`, `applyLocale`/`applyLocaleToOne`/`applyLocaleToPage`, and explicitly deferred this work: *"No Arabic-aware full-text search… a real, separable, materially larger sub-feature… deferred to its own future story."*
  - **Story 137 (`27a3805`)** — the Arabic authoring UI. It is what makes Arabic content exist, and therefore what makes this gap reachable.
  - **Story S-8c** — paging on the search path (`page`/`pageSize`/`totalPages`, `applyLocaleToPage`).
  - **RM-05 / RM-27** — the `status` and `categoryId` filters the Arabic path must honour.

## Extra notes

- **Docker is currently available** (postgres, redis, minio, mailhog all healthy), so API e2e is runnable for this story. Do not assume it stays available; record an environmental blocker per `CLAUDE.md` §5 if it does not.
- The Prisma generated-column drift hazard is **not specific to this story**: 21 of 69 migrations reference `search_vector`, across unrelated schemas (tickets, audit, webhooks, api-keys, tasks, customer-notes). Story 132's migration states the established mitigation outright — *"Hand-written rather than generated: `prisma migrate dev` has twice on this repository picked up unrelated pre-existing drift."* Follow that convention; it is routine here, not exceptional.

## Technical hints

- Repos/roots: `.`. Primary language: `typescript`.

**The real code paths, verified at 27a3805:**

- `apps/api/src/modules/knowledge-base/knowledge-base.service.ts`
  - `listArticles` (~line 157) — agent path; trims `search`, routes to `searchArticles`, then `applyLocaleToPage(..., query.locale)`.
  - `listPublishedArticlesForBranch` (~line 369) — portal path; same routing, passing `{ publishedOnly: true }`. Its non-search branch builds `where: { branchId, status: "PUBLISHED" }` at ~line 397.
  - `searchArticles` (private, ~line 573) — **eight** raw SQL blocks: four row queries and four `COUNT(*)::int` queries, selected by `publishedOnly` × `hasCategory`. Every one hardcodes
    `a.search_vector @@ websearch_to_tsquery('english', ${search})` and
    `ORDER BY ts_rank(a.search_vector, websearch_to_tsquery('english', ${search})) DESC, a.id DESC`.
  - `applyLocale` (~line 473) — batched `findMany({ articleId: { in: [...] }, locale })`, substituting translation `title`/`body` **after** matching. Reuse this batching shape; do not introduce a per-row query.
  - `RawArticleRow` (below `applyLocaleToPage`) — the raw column shape the `$queryRaw` blocks select.
- `apps/api/src/modules/knowledge-base/dto/list-articles-query.dto.ts` — already carries `search`, `locale` (`KbLocale`), `status`, `categoryId`, plus `page`/`pageSize` from `PaginationQueryDto`. **No DTO change is expected.**
- `apps/api/src/modules/knowledge-base/knowledge-base.controller.ts` — no change expected.
- `apps/api/src/modules/portal/portal-knowledge-base.controller.ts` — no change expected; it already passes `ListArticlesQueryDto` straight through.
- `apps/api/prisma/schema.prisma` — `KnowledgeBaseArticleTranslation` at ~line 1411: `@@unique([articleId, locale])`, `@@index([articleId])`, `onDelete: Cascade`. `title` and `body` are both **NOT NULL**, so `coalesce()` is unnecessary in the index/query expression.

**The shape validated against the live database** (this exact query returned the expected row at 27a3805):

```sql
SELECT a.id, ...
FROM knowledge_base.knowledge_base_articles AS a
JOIN knowledge_base.knowledge_base_article_translations AS t
  ON t.article_id = a.id AND t.locale = 'AR'
WHERE to_tsvector('arabic', t.title || ' ' || t.body)
      @@ websearch_to_tsquery('arabic', $search)
ORDER BY ts_rank(to_tsvector('arabic', t.title || ' ' || t.body),
                 websearch_to_tsquery('arabic', $search)) DESC, a.id DESC
```

A partial index scoped to `locale = 'AR'` is the safest shape, since the query already filters on it — but the planner only uses a partial index when the query's predicate implies the index predicate, so the `t.locale = 'AR'` filter must stay in the query. **Confirm the final SQL and the index usage with `EXPLAIN` against the running container before finalizing the plan.**

**Existing test conventions to match:**

- `apps/api/src/modules/knowledge-base/knowledge-base.service.spec.ts` — the search-path tests (~lines 290-340) assert by reading `prisma.$queryRaw.mock.calls[0]`, joining the template strings and checking for substrings such as `"'PUBLISHED'"` and `"a.category_id"`, and checking interpolated `values`. Its locale tests (~lines 391-460) cover translation resolution and the "never queries translations when locale is omitted" case.
- `apps/api/test/knowledge-base.e2e-spec.ts` — `describe("full-text search (Story 102)")` at line 348 (3 cases), `describe("translations")` at line 447, `describe("pagination (Story S-8c)")` at line 618.
- `apps/api/test/portal-knowledge-base.e2e-spec.ts` — `describe("locale")` at line 207 and the search/pagination cases at lines 180 and 304-340, including *"pages a search without surfacing a draft"*.

## Out of scope

- **English translation-table FTS** — only `AR` rows are indexed and searched.
- **Cross-locale search**, and **merging or co-ranking English and Arabic result sets**. `ts_rank` scores from two different configurations are not directly comparable; defining a merge rule is a separate decision.
- **Refactoring the four English raw-SQL branches** unless strictly required for correctness. They are behaviourally equivalent in their FTS predicate and already covered by tests; consolidating them is a separate, optional cleanup.
- **Any change to `knowledge_base_articles.search_vector`**, its generation expression, or its GIN index.
- **`simple` configuration** as the Arabic strategy — measured to miss `مرور` → `المرور`.
- **`pg_trgm`** (installed, but a different matching and ranking model).
- **Application-level Arabic tokenization or normalization** — `arabic_stem` already performs hamza normalization and article stripping natively.
- **Category translation** (a separate candidate; category names remain untranslated).
- **Arabic search UI redesign** and any new search filters unrelated to locale.
- **Any unrelated Knowledge Base change** — no attachment, version-history, KB-category or authoring change.
- **Portal or web frontend changes** — both already send `search` and `locale`; no client change is expected.

---

## Open questions — resolve before implementation

### 1. Which locale values route to the Arabic path?

`KbLocale` is `EN | AR`. The intended routing is: `locale = AR` **and** a non-empty `search` → Arabic translation FTS; everything else (including `locale = EN` and no locale) → the existing English/base path, unchanged. Confirm that `locale = EN` must **not** search the translations table, per the "no English translation-table FTS" non-goal.

### 2. Should an Arabic search also match the base article?

Non-goal 8 says do not union. The consequence, which should be stated explicitly in the plan so it is a decision rather than a surprise: an article with English-only content is **unfindable** in an Arabic search, even if the reader would understand the English. Confirm that is intended.

### 3. Partial index versus full expression index

A partial index (`WHERE locale = 'AR'`) is smaller and matches the query, but only if the query's predicate is written so the planner can prove implication. A non-partial expression index over all rows is simpler to keep aligned. Decide and verify with `EXPLAIN`.

### 4. Does the Arabic path need all four filter permutations?

The English path has eight raw blocks because of `publishedOnly` × `hasCategory`. The Arabic path must honour both filters too. The plan should state whether it mirrors the same four-way branching or composes the predicate differently, without changing the English blocks.
