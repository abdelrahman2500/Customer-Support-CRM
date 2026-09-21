> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/knowledge-base-translation-status/knowledge-base-translation-status/intake.md`

---

## Feature

- **Feature name (display):** Knowledge Base translation status
- **Feature slug (folder under `plans/`):** `knowledge-base-translation-status`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `149`
- **Work item type:** `story`
- **Status:** planned
- **Labels:** knowledge-base, i18n, agent-workspace

---

## Title

```
Knowledge Base translation status
```

---

## Description

```
Story 109 shipped the KB translation model and endpoints; Story 137 shipped
the Arabic authoring UI (English tab edits the base article, Arabic tab
writes a locale:AR translation row). Arabic content is therefore authorable
today, but its coverage is invisible in aggregate: the article list shows
title, category and status, and nothing about whether an article has been
translated. An agent maintaining a branch's knowledge base has to open each
article in turn to find out which ones still need Arabic.

Surface an article's translation state on the agent-facing article list.

The meaning is already fixed by the existing model and must not be
reinvented: English is the base article and always present, so the only
question is whether a locale:AR KnowledgeBaseArticleTranslation row exists.
That is one boolean per article.

The hard constraint is query shape. The list is paginated and must not
issue one query per article. listArticles has two paths — a Prisma
paginate() path and a raw-SQL full-text path (Stories 102/138) — so a
Prisma relation include cannot serve both. The existing applyLocale helper
in the same service already solves exactly this, in one batched query; the
status lookup should mirror it.
```

---

## Acceptance criteria

```
- GET /knowledge-base/articles returns a translation-status flag per item.
- The flag is true exactly when an AR translation row exists for that article.
- Mixed states inside one page resolve per-article.
- Correct across pagination, and on the search path as well as the listing path.
- Exactly one additional DB query per page, independent of page size.
- No additional query at all for an empty page.
- Ordering, pagination semantics, the response envelope, branch scoping and
  permissions are unchanged.
- getArticle and every portal response are unchanged.
- The agent article list shows a per-row translated/untranslated indicator,
  in both English and Arabic, using existing shared primitives.
```

---

## Attachments

None.

---

## Dependencies

- **Blocked by / related ids:** 109 (translation model/endpoints), 137 (Arabic authoring UI)
- **Depends on code areas or other stories:**
  `apps/api/src/modules/knowledge-base/knowledge-base.service.ts`
  (`applyLocale`, `listArticles`, `searchArticles`, `searchArticlesInArabic`),
  `apps/web/src/components/knowledge-base/article-list-view.tsx`.

## Extra notes (optional)

- Story 138 is not modified; it is relevant only because it is why the
  search path is raw SQL.

## Technical hints (optional)

- Mirror `applyLocale`'s batched `findMany({ where: { articleId: { in: [...] } } })`
  shape. Select ids only — the list never needs translated title/body.
- Follow `TicketSummary`/`TicketListItem`'s existing precedent for a
  list-only extension of a shared summary type.

## Out of scope

- A "needs Arabic" filter — the raw-SQL search path already carries an
  8-literal template explosion and a third filter dimension would roughly
  double it, in two helpers. Deferred deliberately.
- Translation authoring (Story 137 owns it).
- Any portal-facing change — the portal falls back to English by design.
- Translation freshness / staleness; no product concept exists for it.
