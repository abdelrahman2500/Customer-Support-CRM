# RM-00 — AI Suggested Solutions

**Priority:** P0 · **Complexity:** Medium · **Blocked:** No (see `02-product-decisions.md` Decision Record 5) · **Phase:** Immediate (before Phase 1)

## Goal

Given an open ticket, have the existing AI pipeline suggest relevant
published Knowledge Base articles — the one AI capability named in Core 7
("Suggested solutions") that has never been built, unlike its four siblings
(summaries, suggested replies, categorization, chatbot), which are fully
implemented and merely operationally `DISABLED` pending a credential.

## Why it exists

`docs/architecture/07-sla-automation-and-ai.md` and this product's own
12-Core definition both name "Suggested solutions" as a distinct AI
capability. It has no `AiFeature` enum value, no route, no model, no UI at
any layer — confirmed by the Core Features Recon and re-confirmed against
current HEAD. The only KB+AI pairing that exists today is the portal
chatbot's own internal grounding step, which is a different feature (it
answers a customer's chat message; it does not suggest articles for an
agent working a ticket).

## Dependencies

None new. Reuses, verbatim:
- `packages/ai/src/ai-provider.interface.ts` (`AiProvider`) and its
  Anthropic/`NullAiProvider` implementations.
- `AiPromptLog` model + `AiSettings` per-branch feature flags.
- The `ai-processing` BullMQ queue + `AiProcessingProcessor` in `apps/worker`.
- `TicketRealtimeListener`'s existing `ai.prompt_completed` relay.
- `KnowledgeBaseService`'s existing full-text search (`searchArticles`).
- Pairs naturally with `RM-05` (Ticket ↔ KB Linkage) for a "reference this on
  the ticket" action, but does not require `RM-05` to ship independently.

## Backend work

- Add `SUGGEST_SOLUTIONS` to the `AiFeature` enum (`schema.prisma`).
- Add `suggestSolutions(ticket, kbContext)` to the `AiProvider` interface and
  both implementations (Anthropic: a new prompt method mirroring
  `summarize`/`suggestReply`; Null: returns `DISABLED` synchronously).
- Extend `TicketAiService` with a `suggestSolutions(ticketId)` method
  mirroring `summarizeTicket`'s exact shape — loads ticket input, calls
  `AiSettingsService.isFeatureEnabled`, creates a `PENDING` `AiPromptLog` row,
  enqueues to `ai-processing`.
- New endpoint `POST /tickets/:id/ai/suggest-solutions`, gated by
  `ticket:read` (matching the other three ticket-scoped AI routes' own
  documented rationale — not `ai:read`).
- Extend `AiProcessingProcessor.processJob` to handle the new feature: fetch
  the same KB-context retrieval already built for the chatbot
  (`fetchKnowledgeBaseContext`), call the new provider method, persist
  results (article ids + relevance snippet) into the existing `AiPromptLog`
  result payload.

## Frontend work

- New `TicketSuggestedSolutionsCard` (or an added tab on the existing
  `TicketAiCard`), mounted in `TicketDetailView` alongside the other AI
  cards, listing suggested articles with a link to each and (once `RM-05`
  ships) a "reference on ticket" button.
- Loading/disabled/error states mirror `TicketAiCard`'s existing pattern
  exactly.

## Worker/realtime work

- `AiProcessingProcessor` handles the new feature branch (see Backend work).
- No new realtime event — reuses `ai.prompt_completed`.

## Schema/migration work

- One new `AiFeature` enum value (`SUGGEST_SOLUTIONS`). No new tables.

## Tests

- `packages/ai` — `anthropic-ai-provider.spec.ts` / `null-ai-provider.spec.ts`
  extended for the new method.
- `apps/api` — `ticket-ai.service.spec.ts` extended; new e2e coverage in the
  existing AI e2e spec file for the new endpoint, including the `DISABLED`
  path with no `ANTHROPIC_API_KEY` configured.
- `apps/worker` — `ai-processing.processor.spec.ts` extended for the new
  feature branch, including the KB-context-empty case.
- `apps/web` — new/extended component spec for the suggested-solutions card.

## Acceptance criteria

- `POST /tickets/:id/ai/suggest-solutions` returns an `AiPromptLog`-backed
  result through the existing realtime hand-back path.
- With no `ANTHROPIC_API_KEY` configured, the endpoint returns a `DISABLED`
  outcome exactly like the other four AI features — never an error, never a
  crash.
- The suggested-solutions UI card renders loading/disabled/populated/empty
  states consistently with the existing `TicketAiCard`.

## Definition of Done

- All acceptance criteria pass locally without a configured Anthropic key
  (verifies the `DISABLED` path) and, if a key is available in the
  environment, with one configured (verifies the real path).
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/web test`,
  `pnpm --filter @crm/ai test` (or wherever `packages/ai`'s tests live),
  `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.
- One dedicated commit, pushed, per `CLAUDE.md` §6.
