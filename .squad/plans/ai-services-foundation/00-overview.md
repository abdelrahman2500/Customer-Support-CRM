# Feature overview — AI Services Foundation

## Why this feature, why now

`docs/architecture/03-domain-boundaries.md` names AI Services as its own
domain/schema (`ai` — "AI Gateway config, prompt/response logs, chatbot
sessions... Provider-agnostic"). `docs/architecture/07-sla-automation-and-
ai.md` is explicit about the intended shape: *"`AiModule` exposes an
internal `AiProvider` interface with methods such as `summarize(ticket)`,
`suggestReply(ticket)`, `categorize(ticket)`, and `chat(session,
message)`... The initial implementation calls Anthropic Claude. Provider
swaps implement the interface without changing call sites... Every call
logs prompt reference, model, token usage, latency, and outcome."* None of
this exists anywhere in the codebase today (no `ai` schema, no `AiModule`,
no Anthropic SDK dependency) — a real, fully-unimplemented, explicitly-
documented v1 gap.

## Recon — why this and not something else

- **Communication/Channels** (Web Forms, Live Chat — the only two channel
  types that need no external vendor decision): re-verified this cycle and
  found genuinely blocked, not by a vendor decision but by real product/
  design ambiguity this plan will not resolve unilaterally — see "Batch
  Completion Report" for this cycle for the full reasoning. Building the
  `channels`/`integrations` schema now, with no channel story safely ready
  to consume it, would be exactly the "schema nothing uses yet" anti-
  pattern this codebase's own `ticket-attachments/00-overview.md` plan
  explicitly avoided ("give the domain a real first consumer rather than
  adding schema nothing uses yet"). Deferred.
- **Email/SMS/ERP adapters**: blocked on an unnamed vendor — out of scope
  by design (`CLAUDE.md` §2).
- **AI Services**: unlike Channels, this domain's foundation *is* its own
  real first consumer in the same sense `PrismaService`/`S3StorageService`/
  `RedisIoAdapter` are — a gateway/wrapper service fully exercised by unit
  tests that call its interface directly (`summarize`/`suggestReply`/
  `categorize`/`chat`), not inert schema. The named vendor (Anthropic
  Claude) is already decided by the architecture doc, so implementing the
  real adapter (not a placeholder) is documented scope, not invention.
  Selected.

## Scope

A **foundation** slice, mirroring Story 51/66's own restraint: a real,
fully-implemented `AiProvider` gateway and its logging schema, provider-
agnostic per the architecture's own explicit design goal — but with no
downstream feature (ticket summarization, suggested reply, categorization,
chatbot UI) wired to it yet. Those are each their own future story (the
architecture doc lists them as distinct capabilities, not one lump).

- New `ai` schema: `AiPromptLog` (feature, model, promptRef, token usage,
  latency, outcome, branch scope, timestamps).
- `AiProvider` TypeScript interface: `summarize`, `suggestReply`,
  `categorize`, `chat` — exact method names from the architecture doc.
- `AnthropicAiProvider implements AiProvider` — a real implementation using
  the official `@anthropic-ai/sdk`, reading `ANTHROPIC_API_KEY` from env
  (optional — mirrors `S3_*`'s own "scaffolded optional, made required only
  once a real consumer needs it" precedent, since nothing in this
  foundation slice forces a live call yet).
- `NullAiProvider implements AiProvider` — used automatically whenever
  `ANTHROPIC_API_KEY` is unset, so the module never silently pretends a
  real integration is configured; every method returns a clearly-marked
  `DISABLED` outcome, logged like any other call.
- `AiGatewayService` — the single injectable/exported entry point other
  modules will call in a future story; wraps whichever provider is active
  and unconditionally writes an `AiPromptLog` row per call (Design item
  below).
- `AiModule`, registered in `app.module.ts`, exporting `AiGatewayService`.

**Not in scope** (each is its own future, credential- or decision-gated
story): any controller/HTTP endpoint (no frontend surface yet — nothing
calls `summarize`/`suggestReply`/`categorize`/`chat` for a real ticket);
Ticket Summarization/Suggested Reply/Categorization/Chatbot Session
features; per-branch feature-flag administration UI (the architecture's
"flaggable per branch" is honored at the *mechanism* level only — the
provider selection itself is env-driven for this foundation slice, not a
`Branch`-scoped admin toggle, which is real product/UI surface this slice
does not invent); KB embeddings/`pgvector` retrieval (Story 84's own
scope); real end-to-end verification against a live Anthropic API (no
credential exists in this environment — documented as an environmental
blocker per `CLAUDE.md` §5, exactly like every other credential-gated
story).

## Dependencies

None — new schema, new module, no existing module depends on it yet
(future Stories 80-84 will depend on `AiGatewayService`).
