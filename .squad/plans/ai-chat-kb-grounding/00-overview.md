# ai-chat-kb-grounding — plan overview

Entry point for the **ai-chat-kb-grounding** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 117 | [117-story-ai-chat-kb-grounding.md](./117-story-ai-chat-kb-grounding.md) | AI Services — Portal Chatbot Knowledge Base grounding | — | Story 80/116 (AI Portal Chatbot + conversation memory), Story 102 (KB full-text search) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 116, from a
  clean slate — every previously-identified backlog candidate had
  shipped, so this Recon swept the full domain table per CLAUDE.md §8.
- **The gap, confirmed directly across three architecture docs**:
  `docs/architecture/07-sla-automation-and-ai.md` ("AI retrieval uses
  Knowledge Base embeddings stored with `pgvector`"),
  `08-supporting-domains.md`, and `04-data-and-multitenancy.md` all name
  Knowledge-Base-grounded AI retrieval. `AiChatService`/
  `AnthropicAiProvider.chat()` have zero reference to the Knowledge Base
  anywhere — the portal chatbot answers real, unreviewed customers
  (`07-sla-automation-and-ai.md`: "Autonomous responses are limited to
  portal self-service in this foundation phase") with no connection to
  the company's actual KB content. Two prior stories' own doc comments
  explicitly flagged this as deliberately deferred, not forgotten:
  Story 51's ("No AI Services consumption... see the plan's Design
  items 3, 7") and Story 102's ("no vector/semantic search — a
  separate, later, AI-driven capability").
- **Why buildable now, without waiting on the blocked embeddings
  decision**: true `pgvector`-based semantic retrieval needs a chosen
  embeddings provider (Anthropic has no embeddings endpoint — would
  need Voyage AI/OpenAI/Cohere/etc.), the same kind of undecided
  external-provider gate CLAUDE.md §2/§9.B already excludes from
  selection (re-confirmed this session: no such decision exists
  anywhere in `docs/architecture/**`/`.env.example`/`.squad/plans/**`).
  `KnowledgeBaseArticle` already has a generated `search_vector`
  `tsvector` column with a GIN index and a working, branch-scoped,
  published-only full-text search implementation
  (`KnowledgeBaseService.searchArticles`, Story 102) — the literal
  "initial search" step the architecture docs describe *before*
  pgvector. This story grounds the chatbot in that, leaving the
  pgvector/embeddings upgrade path open for a later story once a
  provider is chosen.
- **Design decisions this story makes**:
  - Retrieval happens in `apps/worker` (`AiProcessingProcessor`), not
    `apps/api`'s `AiChatService` — mirrors `SlaTimerProcessor`'s own
    established convention of the worker holding its own narrow,
    direct-Prisma copy of a query rather than calling back into
    `apps/api`'s NestJS modules (which the worker cannot depend on;
    it has no HTTP client to `apps/api`, by design — see
    `docs/architecture/02-system-architecture-overview.md`).
  - The worker's own raw `$queryRaw` mirrors
    `KnowledgeBaseService.searchArticles`'s exact shape
    (`search_vector @@ websearch_to_tsquery('english', ...)`, `ts_rank`
    ordering, `status = 'PUBLISHED'`, `branch_id` scoped) — the
    customer's own current message is the search query. English-only,
    matching Story 102's own stated non-goal for locale-aware search.
  - `AiChatMessageInput` (the `@crm/ai` package's provider-agnostic
    contract) gains a required `context: string[]` field, mirroring
    Story 116's own `history` precedent exactly (required, not
    optional: three call sites, all updated together, no external
    consumer). Empty array reproduces today's exact, ungrounded
    behavior byte-for-byte (no `system` prompt sent at all).
  - Capped to the top 3 matching articles (`KB_CONTEXT_MAX_ARTICLES`),
    each excerpt truncated to 500 characters
    (`KB_CONTEXT_SNIPPET_MAX_CHARS`) — plain constants, not new
    per-branch configuration, mirroring `CHAT_HISTORY_LIMIT`'s own
    Story 116 precedent (bounds prompt/token growth; no story has
    disclosed a need to tune either per branch).
  - Retrieval failures fail open (empty context, chat proceeds
    ungrounded exactly like today) — a KB search hiccup must never break
    the customer's ability to chat at all.
- **Scope-narrowing decisions** (see the story doc's own Non-Goals for
  the full list): no pgvector/embeddings retrieval (still blocked on an
  undecided provider); no "Sources" citation UI in the portal transcript;
  no locale-aware retrieval; no grounding for the ticket-side AI
  features (summarize/suggestReply/categorize operate on the ticket's
  own text, not a KB-retrieval use case per the docs); no
  `AiProcessingJobPayload` change (`branchId`/`body` already present —
  the search query is simply the customer's own current message).
