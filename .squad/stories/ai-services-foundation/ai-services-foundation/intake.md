> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.
>
> **Reconstructed** during the Stories-69+ planning reconciliation pass —
> `.squad/plans/ai-services-foundation/00-overview.md` and
> `72-story-ai-services-foundation.md` were written when Story 72 was
> implemented, but this matching intake file was not created at the time
> (every other formal-plan story in this repository has one). The content
> below is drawn directly from those two existing plan documents and the
> Story 72 commit (`fca81ef`) — it describes what was actually decided and
> implemented, not a newly-invented scope.

# Story intake

## Feature

- **Feature name (display):** AI Services Foundation
- **Feature slug:** `ai-services-foundation`

## Description

```text
docs/architecture/03-domain-boundaries.md names AI Services as its own domain/schema (`ai` -
"AI Gateway config, prompt/response logs, chatbot sessions... Provider-agnostic").
docs/architecture/07-sla-automation-and-ai.md is explicit about the intended shape: "AiModule
exposes an internal AiProvider interface with methods such as summarize(ticket),
suggestReply(ticket), categorize(ticket), and chat(session, message)... The initial
implementation calls Anthropic Claude. Provider swaps implement the interface without changing
call sites... Every call logs prompt reference, model, token usage, latency, and outcome."
None of this existed anywhere in the codebase before this story (no ai schema, no AiModule, no
Anthropic SDK dependency) - a real, fully-unimplemented, explicitly-documented v1 gap.

Communication/Channels (Web Forms, Live Chat - the only two channel types needing no external
vendor decision) were re-verified and found genuinely blocked by real product/design ambiguity
(customer-identity resolution for anonymous Web Forms submissions; widening the realtime
gateway's trust boundary to a customer audience for Live Chat), not a vendor decision - building
Channels' schema with no story safely ready to consume it would be inert scaffolding. Email/SMS/
ERP adapters are blocked on an unnamed vendor. AI Services, unlike Channels, is legitimately its
own real first consumer in the same sense PrismaService/S3StorageService are - a gateway service
fully exercised by its own unit tests, not inert schema - and its named vendor (Anthropic Claude)
is already decided by the architecture, so implementing the real adapter (not a placeholder) is
documented scope, not invention. Selected.
```

## Acceptance criteria

```text
- AiGatewayService.summarize/suggestReply/categorize/chat each: (a) call the active provider,
  (b) write exactly one AiPromptLog row per call with the correct feature/outcome, (c) never
  throw when the provider is disabled or errors - return a result shape whose caller can detect
  outcome !== "SUCCESS".
- With ANTHROPIC_API_KEY unset, every call logs DISABLED and makes no network request (verified
  via a spy on the Anthropic SDK client never being constructed/called).
- With ANTHROPIC_API_KEY set (mocked SDK in tests, mirroring S3StorageService's own AWS SDK
  mocking precedent), a successful call logs SUCCESS with real token/latency figures; a thrown
  SDK error logs ERROR with errorMessage set.
- pnpm typecheck, pnpm lint, pnpm build, and pnpm --filter @crm/api test all pass with the new
  module included.
- No existing test, route, or module behavior changes.
```

## Dependencies

- **Blocked by / related ids:** none — new schema, new module, no existing module depends on it
  yet (Stories 73-75 — Ticket AI Summarization/Suggested Reply/Categorization — were built on top
  of it afterward).

## Out of scope

- Any HTTP controller/endpoint (no frontend surface in this story — nothing calls
  `summarize`/`suggestReply`/`categorize`/`chat` for a real ticket yet).
- Ticket Summarization/Suggested Reply/Categorization/Chatbot Session features (each its own
  future story).
- Per-branch admin UI for enabling/disabling AI features (env-driven provider selection only, for
  this slice).
- A live call against a real Anthropic API — no credential exists in this environment
  (documented as an environmental blocker per `CLAUDE.md` §5, not a code defect).
- KB embeddings/`pgvector` retrieval.
