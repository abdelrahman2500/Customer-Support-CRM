# ai-feature-flags — plan overview

Entry point for the **ai-feature-flags** feature. Stories execute in order
by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 81 | [81-story-ai-feature-flags.md](./81-story-ai-feature-flags.md) | AI Feature Flags per Branch | — | `ai-services-foundation` Story 72 (`AiPromptLog`, `AiFeature`, `DISABLED` outcome semantics), `admin-branch-branding` Story 62 (the per-branch admin-config CRUD shape this mirrors), Stories 73–75/79/80 (the three AI call sites this gates) |

## Dependency notes

- Closes an explicitly-disclosed non-goal from Story 72's own plan
  ("No per-branch admin UI for enabling/disabling AI features
  (env-driven provider selection only, for this slice)") and fulfills
  `docs/architecture/07-sla-automation-and-ai.md`'s own unmet promise:
  *"Features are flaggable per branch."*
- Mirrors `BrandingConfig`/`BrandingService`/`BrandingController`'s
  exact one-row-per-branch, absence-means-default, upsert-on-PATCH shape
  (Story 62) — no new abstraction invented.
- Lives in the `ai` schema/domain, not `admin`:
  `docs/architecture/03-domain-boundaries.md`'s AI Services row names
  "AI Gateway config" as owned by the `ai` schema explicitly — unlike
  `BrandingConfig` (an `admin`-schema config for a presentation concern),
  this is AI Services' own config.
- Directly mitigates `docs/architecture/12-risks-tradeoffs-and-scope.md`
  risk #3 ("AI cost/latency: chatbot calls can affect API responsiveness
  and cost") by giving branch admins a real kill switch before any live
  Anthropic credential is ever added to this repository.
- Does not depend on the unresolved external-provider decision: the AI
  vendor is already decided (Anthropic behind `AiProvider`); this story
  adds only an internal, branch-scoped on/off check consulted before an
  AI job is enqueued — no provider-selection code is touched.
