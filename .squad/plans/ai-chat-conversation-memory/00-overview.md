# ai-chat-conversation-memory — plan overview

Entry point for the **ai-chat-conversation-memory** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 116 | [116-story-ai-chat-conversation-memory.md](./116-story-ai-chat-conversation-memory.md) | AI Services — Portal Chatbot conversation memory | — | Story 80 (ai-portal-chatbot), 72 (AiProvider foundation), the shared-ai-provider-boundary refactor (`@crm/ai`) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 110, from a
  clean slate — every previously-identified backlog candidate from
  this session (105-115, plus 110) had shipped, so this Recon swept the
  full domain table per CLAUDE.md §8 rather than re-confirming a
  standing candidate.
- **The gap, confirmed directly**: `docs/architecture/07-sla-automation-and-ai.md`'s
  `chat(session, message)` contract and Story 80's own plan (item 1:
  "Add `ChatSession`/`ChatMessage` models (durable conversation
  history)") both frame the portal AI chatbot as stateful, but the
  actual implementation isn't:
  - `AiChatService.sendMessage` persists the customer's message, then
    enqueues only `{ body }` — no prior turns.
  - `AiProcessingProcessor`'s `CHAT` case calls
    `this.provider.chat({ sessionId, message: data.body })` —
    `sessionId` is accepted but never used to look anything up.
  - `AnthropicAiProvider.chat()` calls `this.complete(input.message)` —
    a single-message Anthropic request, ignoring `sessionId` entirely.

  Every assistant turn is generated with zero awareness of anything
  said earlier in the same session, even though the full transcript is
  sitting in `ChatMessage` and is rendered back to the customer in the
  portal widget today. This is a real defect in an already-shipped,
  documented feature, not a hypothetical.
- **Why not externally blocked**: purely internal — no external
  provider/credential decision needed. The closely-related
  "Knowledge-Base-grounded retrieval augmenting chat context" IS a
  known, explicitly-deferred item (Story 80's own plan, "Not in
  scope"; Story 51's plan: "No AI Services consumption... a separate,
  later, AI-driven capability") — real semantic retrieval would need an
  embeddings-provider decision (`pgvector` is declared in
  `schema.prisma` but no vector column/provider exists anywhere), a
  genuine external-provider gap of the same kind as email/SMS. This
  story deliberately does NOT attempt that — conversation memory is the
  correct, smaller, non-provider-blocked prerequisite (§2.1: don't build
  a dependent enhancement before the foundation it augments is
  correct).
- **Design decisions this story makes**:
  - `AiChatMessageInput` (the `@crm/ai` package's own provider-agnostic
    contract) gains a required `history: AiChatTurn[]` field — not
    optional. Every one of this interface's three call sites (the
    Anthropic provider, the null provider, and the worker's dispatch)
    is updated together in this one story; there is no external
    consumer of this internal package's types to stay backward
    compatible with.
  - History is fetched by `AiProcessingProcessor` (the worker), not by
    `AiChatService` (the API) at enqueue time — the worker already
    injects `PrismaService` and is the only place `AiProvider.chat()`
    is actually called, so this keeps the job payload unchanged and
    avoids sending a growing, unbounded history array through Redis on
    every turn.
  - Capped to the most recent 20 turns (`HISTORY_LIMIT`), fetched via
    `orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT + 1` (bounded
    query, not "fetch the whole session then slice") — bounds
    token/cost growth per `docs/architecture/12-risks-tradeoffs-and-scope.md`'s
    disclosed AI-cost risk, without inventing a new configuration knob
    no story has asked for.
  - The current customer turn (the row `AiChatService.sendMessage`
    persisted immediately before enqueueing this job) is excluded from
    "history" and passed separately as `message`, unchanged — `history`
    is purely additive context, not a replacement for that field.
- **Scope-narrowing decisions** (see the story doc's own Non-Goals for
  the full list): no KB-grounded retrieval, no streaming replies, no
  session-summarization/compaction beyond the fixed 20-turn cap, no
  `apps/web`/agent-facing change, no `ChatSession`/`ChatMessage` schema
  change, no new configuration surface (the cap is a code constant, not
  a per-branch `AiSettings` field — no story has disclosed a need to
  tune it per branch).
