# knowledge-base-translation-status — plan overview

Entry point for the **knowledge-base-translation-status** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 149 | [149-story-knowledge-base-translation-status.md](./149-story-knowledge-base-translation-status.md) | Knowledge Base translation status | — | 109 (translation model), 137 (Arabic authoring UI) |

## Dependency notes

This closes the loop opened by Stories 109 and 137.

- **Story 109** shipped `KnowledgeBaseArticleTranslation` (one row per
  `(articleId, locale)`), locale resolution with base-content fallback, and
  the `PUT`/`GET .../translations` endpoints.
- **Story 137** shipped the authoring UI — English/Arabic tabs on
  `ArticleDetailView`, where the **English tab edits the base article** and
  the **Arabic tab writes a `locale: AR` translation row**.

Together those make Arabic content authorable but leave it *invisible in
aggregate*: an agent cannot tell which of a branch's articles have been
translated without opening each one. This story surfaces that.

**Story 138** (Arabic full-text search) matters here only as a constraint:
it is why `listArticles`' search path is raw SQL, which in turn decides this
story's query shape (see the story plan's Design section).
