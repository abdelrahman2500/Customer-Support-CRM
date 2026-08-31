# Story 72 — AI Services Foundation

> Numbering note: the prior analysis-only "Final V1 Completion Plan" used
> illustrative numbers 72-84 assuming Channels Foundation would execute
> first (72) and AI Foundation fifth (79). Actual execution order deviated
> (Channels/Live Chat/Web Forms deferred this cycle — see the Batch
> Completion Report for why) so this story claims the actual next number in
> the continuous global sequence, `CLAUDE.md` §6.

## Goal

Give AI Services a real, provider-agnostic foundation: an `AiProvider`
interface with a genuine Anthropic-backed implementation, a safe no-op
fallback when uncredentialed, and a logging schema — so that Stories 80-84
(Summarization, Suggested Reply, Categorization, Chatbot, KB Semantic
Search) each become a small, focused addition rather than a foundation-
plus-feature combination.

## Non-goals

- No HTTP controller/endpoint — nothing outside this module calls
  `AiGatewayService` yet.
- No ticket summarization/suggested-reply/categorization/chatbot feature.
- No per-branch admin UI for enabling/disabling AI features (env-driven
  provider selection only, for this slice).
- No live call against a real Anthropic API — no credential exists in this
  environment (see Verification plan).
- No KB embeddings/`pgvector` retrieval.

## Design decisions

1. **Schema**: new `ai` Postgres schema, declared in `schema.prisma`'s
   `schemas` array alongside the existing seven.
2. **`AiPromptLog` model** (mirrors `NotificationLog`'s own flat,
   append-only, branch-scoped shape): `id`, `branchId` (FK — "flaggable
   per branch" per the architecture doc, so every call is attributable to
   a branch even in this foundation slice), `feature` (enum:
   `SUMMARIZE`/`SUGGEST_REPLY`/`CATEGORIZE`/`CHAT`), `model` (the
   underlying model name string, e.g. `claude-sonnet-4-5` or `disabled`),
   `promptRef` (a short opaque reference/hash, never the raw prompt body —
   avoids storing arbitrary customer/ticket content in a log table with a
   different retention story than Ticketing's own data), `inputTokens`/
   `outputTokens` (`Int?`, null when the call never reached the provider),
   `latencyMs` (`Int`), `outcome` (enum: `SUCCESS`/`ERROR`/`DISABLED`),
   `errorMessage` (`String?`), `createdAt`.
3. **`AiProvider` interface** — exact method names from
   `docs/architecture/07-sla-automation-and-ai.md`:
   `summarize(ticket)`, `suggestReply(ticket)`, `categorize(ticket)`,
   `chat(session, message)`. Each returns a small provider-agnostic result
   shape (`{ text, model, inputTokens, outputTokens }` for the first
   three; the same shape for `chat`, keyed by session id) — deliberately
   generic since no downstream caller exists yet to demand a richer shape.
4. **`AnthropicAiProvider`** — real `@anthropic-ai/sdk` usage (the actual
   Messages API), constructed only when `ANTHROPIC_API_KEY` is present.
   **`NullAiProvider`** — returns a `DISABLED` outcome synchronously, no
   network call, used whenever the key is absent. `AiModule` selects
   between them via a factory provider reading `ConfigService` once at
   module init — mirrors `PresenceService`/`S3StorageService`'s own
   constructor-time client construction, and mirrors `RealtimeGateway`'s
   own JWT-secret-from-config pattern for reading required config safely.
5. **`AiGatewayService`** — the only exported provider. Implements
   `AiProvider` itself (delegation + logging wrapper), so a future caller
   never touches `AnthropicAiProvider`/`NullAiProvider` directly — exactly
   the indirection `docs/architecture/07-sla-automation-and-ai.md` asks
   for ("Provider swaps implement the interface without changing call
   sites"). Every method call is wrapped in a `try/catch` that always
   writes exactly one `AiPromptLog` row (`SUCCESS`/`ERROR`/`DISABLED`),
   never throws past the log write for a `DISABLED`/`ERROR` outcome to a
   caller expecting best-effort AI assistance — mirrors this codebase's
   own "log outcomes for retry and inspection" convention already stated
   for Notifications.
6. **Branch scope**: `AiGatewayService` takes `branchId` as an explicit
   parameter on every call (not `TenantContext`) — the future callers
   (Tickets/KB modules calling into AI) already have their own resolved
   branch context and would otherwise force `AiModule` into assuming a
   request-scoped `TenantContext` it doesn't otherwise need, mirroring how
   `NotificationService` already takes branch/recipient info as explicit
   arguments rather than resolving it itself.

## Files expected to change

- `apps/api/prisma/schema.prisma` — add `ai` schema, `AiPromptLog` model,
  `AiFeature`/`AiOutcome` enums.
- `apps/api/prisma/migrations/<ts>_add_ai_prompt_logs/` — generated
  migration.
- `apps/api/src/common/config/env.validation.ts` — add optional
  `ANTHROPIC_API_KEY`.
- `apps/api/src/modules/ai/` (new): `ai-provider.interface.ts`,
  `anthropic-ai-provider.ts` (+ `.spec.ts`), `null-ai-provider.ts` (+
  `.spec.ts`), `ai-gateway.service.ts` (+ `.spec.ts`), `ai.module.ts`.
- `apps/api/src/app.module.ts` — register `AiModule`.
- `apps/api/package.json` — add `@anthropic-ai/sdk`.
- `docs/architecture/03-domain-boundaries.md` — no table-shape change (the
  `ai` row already exists), but confirm it still matches.

## Acceptance criteria

- `AiGatewayService.summarize/suggestReply/categorize/chat` each: (a) call
  the active provider, (b) write exactly one `AiPromptLog` row per call
  with the correct `feature`/`outcome`, (c) never throw when the provider
  is disabled or errors — return a result shape whose caller can detect
  `outcome !== "SUCCESS"`.
- With `ANTHROPIC_API_KEY` unset, every call logs `DISABLED` and makes no
  network request (verified via a spy on the Anthropic SDK client never
  being constructed/called).
- With `ANTHROPIC_API_KEY` set (mocked SDK in tests, exactly like
  `S3StorageService`'s own AWS SDK mocking precedent), a successful call
  logs `SUCCESS` with real token/latency figures; a thrown SDK error logs
  `ERROR` with `errorMessage` set.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm --filter @crm/api
  test` all pass with the new module included.
- No existing test, route, or module behavior changes.

## Verification plan

- Unit tests for `AnthropicAiProvider` (mocked `@anthropic-ai/sdk`
  client), `NullAiProvider`, and `AiGatewayService` (mocked `AiProvider` +
  mocked `PrismaService`).
- No e2e spec — there is no HTTP surface in this story to exercise end to
  end (consistent with the Non-goals above).
- A live call against the real Anthropic API cannot be verified in this
  environment — no `ANTHROPIC_API_KEY` exists here. This is an
  environmental blocker, documented per `CLAUDE.md` §5, not a code defect;
  the `NullAiProvider` path is what actually runs whenever this module is
  loaded in this repository's own dev/CI environment today.
