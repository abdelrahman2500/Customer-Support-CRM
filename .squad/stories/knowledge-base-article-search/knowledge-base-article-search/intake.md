> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Knowledge Base — Article Search (Foundation)
- **Feature slug:** `knowledge-base-article-search`

## Description

```text
A fresh, explicitly-requested Recon after Story 63 re-examined every remaining domain. Knowledge
Base's own Story 51 doc comment discloses "No full-text/vector search consumption" as a known
gap. Selected over live branding CSS-variable consumption (larger than it first appears — no
portal-side branding endpoint exists yet, plus both apps' shared layouts) and a wider SLA
automation action set (still has a genuinely undecided reconciliation-design question). Uses a
plain contains/insensitive Prisma filter, not raw-SQL tsvector, mirroring Reporting's own
"direct queries before materialized views" precedent.
```

## Acceptance criteria

```text
- GET /knowledge-base/articles?search= and GET /portal/knowledge-base/articles?search= both
  filter by title/body, case-insensitive substring match.
- Omitted/empty search behaves identically to every existing caller today.
- Both frontends (agent + portal) show a working search input above the existing list.
- English and Arabic translations exist for every new string, both apps.
- Backend unit and e2e tests, and frontend component tests, cover the new surface.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `knowledge-base-foundation` Story 51, `customer-portal-knowledge-base-browsing` Story 54.

## Out of scope

- tsvector/GIN full-text search, pgvector semantic retrieval, pg_trgm fuzzy matching, searching
  category, result highlighting/snippets, debounced input.
- Any README change.
