> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/ai-chat-kb-grounding/ai-chat-kb-grounding/intake.md`

---

## Feature

- **Feature name (display):** AI Services — Portal Chatbot Knowledge Base grounding
- **Feature slug (folder under `plans/`):** `ai-chat-kb-grounding`

## Title

```text
Story 117 — AI Services: Portal Chatbot Knowledge Base grounding
```

## Description

```text
Three architecture docs (07-sla-automation-and-ai.md,
08-supporting-domains.md, 04-data-and-multitenancy.md) name
Knowledge-Base-grounded AI retrieval, but AiChatService/
AnthropicAiProvider.chat() have zero connection to the Knowledge Base
anywhere -- the portal chatbot answers real, unreviewed customers with
no grounding in the company's actual KB content. True pgvector/
embeddings-based retrieval needs an undecided external embeddings
provider (blocked, same class of gap as email/SMS), but
KnowledgeBaseArticle already has a working tsvector full-text search
(Story 102) -- the documented "initial search" step before pgvector.
This story grounds the chatbot in that: the worker fetches up to 3
published, branch-scoped KB articles matching the customer's current
message and passes them to the model as grounding context.
```

## Acceptance criteria

```text
- [ ] AiChatMessageInput.context: string[] added to @crm/ai (required);
      AnthropicAiProvider.chat() sends a grounding system prompt when
      context is non-empty, none when empty (byte-identical to today).
- [ ] AiProcessingProcessor's CHAT case fetches up to 3 published,
      branch-scoped KB articles matching the customer's message via the
      existing tsvector search, truncated to 500 chars each.
- [ ] A KB search error fails open (empty context) -- chat still
      completes normally.
- [ ] No job-payload/wire-shape change; no schema change.
- [ ] Unit coverage for the system-prompt construction and the
      KB-context fetch (match/no-match/failure, branch+published
      scoping).
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures.
```

## Dependencies

- Story 80 — AI Portal Chatbot (`AiChatService`, the CHAT feature).
- Story 116 — conversation memory (`AiChatMessageInput.history`, the
  same "required field, three call sites" precedent this story mirrors
  for `context`).
- Story 102 — KB full-text search (`search_vector`, `websearch_to_tsquery`,
  `KnowledgeBaseService.searchArticles`'s exact query shape this story's
  worker-local copy mirrors).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- pgvector/embeddings-based semantic retrieval (undecided provider —
  deliberately deferred, same class of gap as email/SMS).
- A "Sources" citation UI in the portal chat transcript.
- Locale-aware retrieval.
- Grounding for the ticket-side AI features (summarize/suggestReply/
  categorize).
- Any AiProcessingJobPayload change.
- Per-branch tuning of article count / excerpt length.
