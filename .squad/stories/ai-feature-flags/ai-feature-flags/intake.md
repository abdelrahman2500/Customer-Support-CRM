> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/ai-feature-flags/ai-feature-flags/intake.md`

---

## Feature

- **Feature name (display):** AI Services
- **Feature slug (folder under `plans/`):** `ai-feature-flags`

## Title

```text
Story 81 — AI Feature Flags per Branch
```

## Description

```text
Story 72 explicitly deferred a per-branch admin UI for enabling/disabling
AI features ("env-driven provider selection only, for this slice"), and
docs/architecture/07-sla-automation-and-ai.md states plainly that
"Features are flaggable per branch" — a promise still unmet after
Stories 73-75/79/80 built the actual AI features. This story closes that
gap: a per-branch AiSettings row (one boolean per feature), an admin
GET/PATCH endpoint mirroring Story 62's BrandingConfig shape, and a check
in TicketAiService/AiChatService that short-circuits to a synchronously
created DISABLED AiPromptLog row (reusing that outcome's existing
semantics) instead of enqueueing ai-processing when a feature is turned
off for a branch.
```

## Acceptance criteria

```text
- [ ] AiSettings exists via a real Prisma migration (one row per branch,
      one boolean per AI feature, defaulting to enabled).
- [ ] GET/PATCH /ai/settings exist, gated by new ai:read/ai:update
      permissions, mirror BrandingConfig's absence-means-default and
      upsert-on-PATCH conventions exactly.
- [ ] TicketAiService.submit and AiChatService.sendMessage both consult
      the flag for their own feature before creating a pending log or
      enqueueing ai-processing.
- [ ] When a feature is disabled, the AiPromptLog row is created already
      resolved to DISABLED, synchronously, with no ai-processing job
      ever enqueued.
- [ ] A disabled chat message still persists the customer's own message;
      a disabled categorize never mutates Ticket.category.
- [ ] An agent-facing admin settings page exists in apps/web to view and
      toggle the four flags.
- [ ] No apps/portal change; no change to AnthropicAiProvider/
      NullAiProvider/packages/ai or provider selection.
- [ ] Backend and frontend tests cover the new behavior; existing
      Story 73-75/79/80 tests remain green unmodified (the
      absence-of-a-row default preserves their exact prior behavior).
- [ ] Typecheck, lint, build, and the relevant test suites pass.
```

## Dependencies

- Story 72 — AI Services Foundation (`AiPromptLog`, `AiFeature`,
  `DISABLED` outcome semantics)
- Story 62 — Administration — Branch Branding (the config CRUD shape
  this mirrors)
- Stories 73-75, 80 — the AI call sites this story gates

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Any apps/portal UI to *set* the flags (the portal already correctly
  renders DISABLED via Story 80's own polling; only the admin UI to
  configure them is in scope).
- A new AiOutcome value — DISABLED is deliberately reused (see the
  story's own plan, "Design decision").
- Rate limiting / usage quotas (a numeric cap, not a boolean).
- Retroactively cancelling an already-enqueued PENDING operation.
- Any change to AnthropicAiProvider/NullAiProvider/packages/ai/provider
  selection.
