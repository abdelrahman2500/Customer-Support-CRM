> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/ai-portal-chatbot/ai-portal-chatbot/intake.md`

---

## Feature

- **Feature name (display):** AI Services
- **Feature slug (folder under `plans/`):** `ai-portal-chatbot`

## Title

```text
Story 80 — AI Portal Chatbot (Foundation)
```

## Description

```text
AiProvider.chat() has existed and been unit-tested since Story 72 but has
zero call sites anywhere in the codebase. This story delivers the first
real chatbot surface: an authenticated Customer Portal Contact can start a
chat session and exchange turn-based messages with the AI, reusing the
existing ai-processing async queue and realtime hand-back pattern Stories
76/79 already established for ticket-scoped AI features, rather than
inventing a new dispatch mechanism.
```

## Acceptance criteria

```text
- [ ] ChatSession/ChatMessage models exist via a real Prisma migration,
      plus a nullable AiPromptLog.chatSessionId.
- [ ] The ai-processing queue/processor accepts a CHAT feature, calls
      AiProvider.chat, and persists the assistant's reply as a
      ChatMessage only on a SUCCESS outcome.
- [ ] The ai-processing-events hand-back bridge emits a new,
      chat-scoped realtime event without modifying the existing
      ticket-scoped ai.prompt_completed event/listener.
- [ ] A new chat-session:{id} realtime room exists, authorized only for
      the owning Contact (never an agent-audience socket).
- [ ] Portal-scoped REST endpoints exist to start a session, send a
      message, list a session's messages, and poll one operation's
      result by log id — all masking cross-Contact access as 404.
- [ ] A portal chat widget page exists, rendering
      PENDING/SUCCESS/ERROR/DISABLED distinctly, refreshed via the new
      realtime event.
- [ ] No apps/web (agent-facing) change of any kind.
- [ ] No change to AnthropicAiProvider/NullAiProvider/packages/ai or
      provider selection.
- [ ] Backend, worker, and portal unit tests cover the new behavior;
      a new e2e spec covers the portal-facing HTTP surface.
- [ ] Typecheck, lint, build, and the relevant test suites pass.
```

## Dependencies

- Story 72 — AI Services Foundation (`AiProvider.chat`, `AiGatewayService`)
- Stories 76/79 — the async worker + realtime hand-back + result-polling
  pattern this story extends to a second feature
- Story 52 — Customer Portal Authentication Foundation
- Stories 20/77 — realtime `audience: "customer"` room precedent

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Any agent-facing (`apps/web`) visibility into a chat session.
- Knowledge Base embeddings/semantic retrieval feeding chat context.
- Streaming/token-by-token replies.
- Multi-session history/management UI beyond one active session.
- Anonymous (unauthenticated) chat.
- Any change to `AnthropicAiProvider`/`NullAiProvider`/`packages/ai`/
  provider selection.
