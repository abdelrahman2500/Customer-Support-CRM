# Story 116 — AI Services: Portal Chatbot conversation memory

## Goal

Make the portal AI chatbot's assistant replies actually aware of the
prior turns in the same session — closing the gap between
`docs/architecture/07-sla-automation-and-ai.md`'s stateful
`chat(session, message)` contract (and Story 80's own plan, which
explicitly calls `ChatMessage` "durable conversation history") and the
current implementation, where every turn is generated in complete
isolation from everything said before it in the same conversation.

## Non-goals

- No Knowledge-Base-grounded retrieval augmenting chat context — a
  known, explicitly-deferred item (Story 80's own plan; Story 51's
  plan) that would need a genuine external embeddings-provider decision
  (no vector column/provider exists anywhere despite `pgvector` being
  declared in `schema.prisma`), the same class of external-provider gap
  as email/SMS. Conversation memory is the correct, smaller,
  non-provider-blocked prerequisite to build first.
- No streaming replies — `AiProvider.chat()`'s contract (one call, one
  `AiCallResult`) is unchanged; only what's included in the prompt
  changes.
- No session-summarization/compaction — history is capped to the most
  recent 20 turns via a fixed constant, not summarized when it exceeds
  that.
- No new per-branch configuration (e.g. a tunable history-length
  `AiSettings` field) — no story has disclosed a need to tune this per
  branch.
- No `apps/web` (agent workspace) change — this only affects
  `apps/portal`'s existing chat widget's assistant replies, unchanged on
  the wire (same `ChatMessage`/`AiPromptLog` shapes, same polling
  endpoints).
- No `ChatSession`/`ChatMessage` schema change — history is read from
  the existing table, unchanged.

## Design

### `@crm/ai` package (`packages/ai/src`)

- `types.ts`: new `AiChatTurn { role: "user" | "assistant"; content:
  string }`. `AiChatMessageInput` gains a required `history:
  AiChatTurn[]` field (ordered oldest → newest, excluding the current
  `message`) — required, not optional: this is an internal package with
  exactly three call sites (`AnthropicAiProvider`, `NullAiProvider`,
  `AiProcessingProcessor`), all updated together in this one story, so
  there is no external consumer to stay backward compatible with by
  making it optional.
- `anthropic-ai-provider.ts`: `complete(prompt: string)` is generalized
  to `complete(messages: Anthropic.MessageParam[])` — `summarize`/
  `suggestReply`/`categorize` each wrap their existing single prompt
  string as `[{ role: "user", content: prompt }]` (identical resulting
  API call, just expressed as the general case). `chat()` builds
  `[...input.history.map((turn) => ({ role: turn.role, content:
  turn.content })), { role: "user", content: input.message }]` and
  passes that to `complete()`.
- `null-ai-provider.ts`: no code change — `chat()` already ignores its
  entire input (`_input: AiChatMessageInput`) and returns the fixed
  `DISABLED` result; the new field flows through the existing type
  unchanged.

### `apps/worker` (`src/queues/ai-processing.processor.ts`)

- `call()` becomes `async` (it already returns `Promise<AiCallResult>`,
  awaited by its one caller — no signature change from the caller's
  point of view). Its `CHAT` case first calls a new private
  `fetchChatHistory(sessionId)` helper, then passes the result as
  `history` alongside the existing `sessionId`/`message`.
- `fetchChatHistory(sessionId)`: `this.prisma.chatMessage.findMany({
  where: { sessionId }, orderBy: { createdAt: "desc" }, take:
  HISTORY_LIMIT + 1 })` — a bounded query (not "fetch the whole session
  then slice"). The first row (`createdAt` most recent) is always the
  current customer message `AiChatService.sendMessage` persisted
  immediately before enqueueing this very job (the assistant's reply,
  if any, is only ever created *after* this job completes — see that
  service's own code) — dropped. The remaining rows (oldest of the
  fetched batch is now first once reversed back to chronological order)
  are mapped `CUSTOMER → "user"` / `ASSISTANT → "assistant"`,
  `body → content`.
- `HISTORY_LIMIT = 20` — a plain module-level constant, capping
  token/cost growth per `docs/architecture/12-risks-tradeoffs-and-scope.md`'s
  disclosed AI-cost risk (no per-branch tuning — see Non-goals).
- No `AiProcessingJobPayload` change — history is fetched inside the
  worker, not sent through the BullMQ job payload from `apps/api`.

## Acceptance criteria

- [ ] `AiChatTurn`/`AiChatMessageInput.history` added to `@crm/ai`;
      `AnthropicAiProvider.chat()` includes prior turns (oldest-first)
      plus the current message in its Anthropic API call.
- [ ] `NullAiProvider.chat()` unaffected (still `DISABLED`, ignores
      input).
- [ ] `AiProcessingProcessor`'s `CHAT` case fetches up to the most
      recent 20 prior turns for the session, correctly excluding the
      current (just-persisted) customer message, correctly ordered
      oldest-first, correctly role-mapped.
- [ ] A session's first-ever message (no prior turns) passes an empty
      `history` array — no crash, no off-by-one.
- [ ] No `AiProcessingJobPayload`/wire-shape change; no schema change.
- [ ] Unit coverage: `AnthropicAiProvider.chat()`'s message-array
      construction (empty history, multi-turn history);
      `AiProcessingProcessor`'s history fetch/cap/exclude-current/role
      -mapping behavior.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures (CLAUDE.md §13).

## Verification plan

```
pnpm --filter @crm/ai exec vitest run src/anthropic-ai-provider.spec.ts src/null-ai-provider.spec.ts
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
