# knowledge-base-article-search — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 64  | [64-story-knowledge-base-article-search.md](./64-story-knowledge-base-article-search.md) | Knowledge Base — Article Search (Foundation) | — | `knowledge-base-foundation` Story 51, `customer-portal-knowledge-base-browsing` Story 54 |

## Dependency notes

- Selected via a fresh, explicitly-requested Recon after Story 63 (`CLAUDE.md` §2/§8). `KnowledgeBaseArticle`'s own Story 51 doc comment discloses "No full-text/vector search consumption" as a known, deliberate gap — this story closes it with the smallest safe mechanism.
- Preferred over the other two candidates re-examined this cycle: live branding CSS-variable/logo consumption (Story 62's own deferred follow-up) is larger than it first appears — `apps/portal` has no branding read surface at all today, so it would need a *new* portal endpoint plus changes to both apps' shared root layouts, the exact kind of cross-cutting change `docs/architecture/12-risks-tradeoffs-and-scope.md` flags as an RTL-regression hazard. A wider `AutomationRule` action set was re-examined and found to still carry a real, undecided reconciliation design question (not a rubber-stamp extension), so it was not selected either — inventing that decision mid-implementation would have been exactly the kind of precondition-bypass this Recon was explicitly asked to avoid.
- **Deliberately uses a plain `contains`/`mode: "insensitive"` Prisma filter, not Postgres `tsvector`/GIN full-text search** — mirrors `reporting-analytics-foundation`'s own "direct queries before materialized views" precedent: `$queryRaw` is used exactly once anywhere in this codebase (a trivial healthcheck), so a real parameterized raw-SQL tsvector query would be a bigger architectural "first" than a foundation slice warrants. True full-text search (ranking, stemming, `pg_trgm` fuzzy matching) is deferred until this simpler mechanism's relevance/performance is a *measured* problem, not a guessed one.
- No new schema/migration — a pure query-shape extension over the already-existing `KnowledgeBaseArticle` columns.
- Communication/Channels, AI Services, and Integrations remain blocked on an unresolved external provider/credential (unchanged). `pgvector` semantic/embedding-based retrieval is blocked transitively on AI Services (generating an embedding requires a real model call).
