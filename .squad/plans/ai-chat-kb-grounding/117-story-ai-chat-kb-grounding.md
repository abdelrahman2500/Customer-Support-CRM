# Story 117 — AI Services: Portal Chatbot Knowledge Base grounding

## Goal

Ground the portal AI chatbot's replies in the caller's branch's actual,
published Knowledge Base content — closing the gap between three
architecture docs (`07-sla-automation-and-ai.md`, `08-supporting-
domains.md`, `04-data-and-multitenancy.md`) naming KB-grounded AI
retrieval and the current implementation, which has zero connection to
the Knowledge Base anywhere. This is the one AI surface
(`07-sla-automation-and-ai.md`: "Autonomous responses are limited to
portal self-service in this foundation phase") that already answers real
customers with no human review in the loop.

## Non-goals

- No `pgvector`/embeddings-based semantic retrieval — needs a genuine,
  still-undecided external embeddings-provider choice (Anthropic has no
  embeddings endpoint), the same kind of external-provider gate
  CLAUDE.md §2/§9.B already excludes from selection. This story grounds
  the chatbot in the existing, working `tsvector` full-text search
  instead (Story 102) — the documented "initial search" step before
  pgvector, not a replacement for it. A later story can add
  embeddings-based retrieval once a provider is chosen, without this
  story's design blocking that.
- No "Sources" citation list rendered in the portal chat transcript —
  purely a backend prompt-grounding change; `apps/portal`'s existing
  chat widget is unmodified.
- No locale-aware retrieval — matches Story 102's own stated non-goal
  ("full-text search stays English-only").
- No grounding for the ticket-side AI features (`summarize`/
  `suggestReply`/`categorize`) — those operate on the ticket's own
  subject/body text, not a KB-retrieval use case per the architecture
  docs' own framing (KB grounding is named specifically for chat/
  "retrieval").
- No `AiProcessingJobPayload` change — `branchId` and `body` (the
  customer's current message, used as the search query) are already
  present on every `CHAT` job.
- No per-branch tuning of the article count or excerpt length — plain
  code constants, mirroring `CHAT_HISTORY_LIMIT`'s own Story 116
  precedent.

## Design

### `apps/worker` (`src/queues/ai-processing.processor.ts`)

- New constants beside `CHAT_HISTORY_LIMIT`: `KB_CONTEXT_MAX_ARTICLES =
  3`, `KB_CONTEXT_SNIPPET_MAX_CHARS = 500`.
- New private `fetchKnowledgeBaseContext(branchId, query)`: a worker
  -local `$queryRaw`, mirroring `KnowledgeBaseService.searchArticles`'s
  exact shape (`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`)
  — `branch_id` scoped, `status = 'PUBLISHED'` only, `search_vector @@
  websearch_to_tsquery('english', ${query})`, ordered by `ts_rank(...)
  DESC`, `LIMIT KB_CONTEXT_MAX_ARTICLES`. Selects `title, body`. Maps
  each row to a single string `` `${title}: ${body.slice(0,
  KB_CONTEXT_SNIPPET_MAX_CHARS)}` ``. Wrapped in try/catch — **fails
  open** (returns `[]`) on any query error, logged via the existing
  `Logger`, never breaking the chat turn. Not exported/reused elsewhere
  — this mirrors `SlaTimerProcessor`'s own established convention of
  the worker holding its own narrow, direct-Prisma copy of a query
  rather than calling back into `apps/api`'s NestJS modules (the worker
  has no HTTP client to `apps/api`, by design — see
  `docs/architecture/02-system-architecture-overview.md`).
- `call()`'s `CHAT` case: after fetching `history` (Story 116), also
  calls `fetchKnowledgeBaseContext(data.branchId, data.body)` and passes
  the result as `context` alongside `sessionId`/`message`/`history`.
  The search query is simply the customer's own current message — no
  new field needed.

### `@crm/ai` package (`packages/ai/src`)

- `types.ts`: `AiChatMessageInput` gains a required `context: string[]`
  field (KB excerpt strings, already truncated by the caller) — mirrors
  `history`'s own Story 116 "required, three call sites, all updated
  together" precedent exactly.
- `anthropic-ai-provider.ts`: `complete()` gains an optional second
  parameter, `system?: string`, passed through to the Anthropic API
  call's own `system` field only when present — `summarize`/
  `suggestReply`/`categorize` are unaffected (no `system` prompt, same
  as today). `chat()` builds a system prompt via a small
  `buildChatSystemPrompt(context)` helper: `undefined` when `context`
  is empty (today's exact, ungrounded behavior, byte-for-byte
  unchanged — no `system` param sent at all), otherwise a short
  instruction telling the model to answer primarily from the given
  excerpts and to say it doesn't know (suggesting the customer ask a
  human agent) when they don't cover the question.
- `null-ai-provider.ts`: no code change — `chat()` already ignores its
  entire input.

## Acceptance criteria

- [ ] `AiChatMessageInput.context: string[]` added to `@crm/ai`
      (required); `AnthropicAiProvider.chat()` sends a grounding
      `system` prompt when `context` is non-empty, and sends none
      (byte-identical to pre-Story-117 calls) when empty.
- [ ] `AiProcessingProcessor`'s `CHAT` case fetches up to 3 published,
      branch-scoped KB articles matching the customer's current message
      via the existing `tsvector` full-text search, truncated to 500
      chars each.
- [ ] A KB search error fails open (empty `context`) — the chat turn
      still completes normally.
- [ ] No `AiProcessingJobPayload`/wire-shape change; no schema change.
- [ ] Unit coverage: `AnthropicAiProvider.chat()`'s system-prompt
      construction (empty vs. non-empty context); `AiProcessingProcessor`'s
      KB-context fetch (match found, no match, query failure → fails
      open), scoped correctly by branch and published status.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures (CLAUDE.md §13).

## Verification plan

```
pnpm --filter @crm/ai exec vitest run src/anthropic-ai-provider.spec.ts
pnpm --filter @crm/worker exec vitest run src/queues/ai-processing.processor.spec.ts
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full sweep, .env sourced, run directly
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
