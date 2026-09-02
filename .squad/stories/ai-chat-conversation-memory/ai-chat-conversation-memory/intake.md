> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/ai-chat-conversation-memory/ai-chat-conversation-memory/intake.md`

---

## Feature

- **Feature name (display):** AI Services — Portal Chatbot conversation memory
- **Feature slug (folder under `plans/`):** `ai-chat-conversation-memory`

## Title

```text
Story 116 — AI Services: Portal Chatbot conversation memory
```

## Description

```text
docs/architecture/07-sla-automation-and-ai.md's chat(session, message)
contract and Story 80's own plan both frame the portal AI chatbot as
stateful ("durable conversation history"), but the actual
implementation isn't: AiChatService.sendMessage enqueues only the
current message body; AiProcessingProcessor's CHAT case accepts
sessionId but never uses it to look anything up;
AnthropicAiProvider.chat() sends a single-message request, ignoring
session context entirely. Every assistant turn is generated with zero
awareness of anything said earlier in the same session, even though the
full transcript already sits in ChatMessage and is rendered back to the
customer. This story adds a required history field to the @crm/ai
package's AiChatMessageInput contract, fetches the session's most
recent 20 prior turns in the worker (bounded query, current message
excluded), and includes them in the Anthropic API call.
```

## Acceptance criteria

```text
- [ ] AiChatTurn/AiChatMessageInput.history added to @crm/ai;
      AnthropicAiProvider.chat() includes prior turns plus the current
      message.
- [ ] NullAiProvider.chat() unaffected.
- [ ] AiProcessingProcessor's CHAT case fetches up to the most recent
      20 prior turns, excluding the current message, oldest-first,
      correctly role-mapped.
- [ ] A session's first message passes an empty history array, no crash.
- [ ] No job-payload/wire-shape change; no schema change.
- [ ] Unit coverage for the message-array construction and the
      history-fetch/cap/exclude/role-mapping behavior.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures.
```

## Dependencies

- Story 72 — AiProvider foundation (`AiProvider`/`AiCallResult`
  contract).
- Story 80 — AI Portal Chatbot (`ChatSession`/`ChatMessage`, the
  CHAT feature in `ai-processing`, `AiChatService`).
- The shared-ai-provider-boundary refactor — `@crm/ai` (`packages/ai`),
  the package this story's changes land in.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Knowledge-Base-grounded retrieval (needs an external embeddings-
  provider decision — deliberately deferred, same class of gap as
  email/SMS providers).
- Streaming replies.
- Session-summarization/compaction beyond the fixed 20-turn cap.
- Per-branch configuration of the history length.
- Any apps/web (agent workspace) change.
- Any ChatSession/ChatMessage schema change.
