> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.
>
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ai-ticket-assist-async-processing/ai-ticket-assist-result-delivery/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** AI Services
- **Feature slug (folder under `plans/`):** `ai-ticket-assist-async-processing`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Story 79 — AI Ticket-Assist Result Delivery
```

---

## Description

```text
Complete the last-mile delivery of the existing AI ticket-assist pipeline.

Stories 72–76 already established the AiProvider boundary, AiPromptLog, the ticket AI submit endpoints, async worker processing, and the ai.prompt_completed realtime hand-back event. The worker currently computes the real AI result text but does not persist it, and there is no read-by-id endpoint or frontend consumer for the result.

The goal of this story is to make the existing AI ticket-assist features actually visible and usable by agents.

The implementation should:

1. Persist the generated AI output on AiPromptLog.
2. Provide a ticket-scoped GET endpoint allowing an authorized agent to retrieve an AI result by log id.
3. Add an agent-facing AI UI to the ticket detail page in apps/web.
4. Wire the existing ai.prompt_completed realtime event to refresh the authoritative AI result.
5. Correctly represent SUCCESS, ERROR, PENDING, and DISABLED outcomes.
6. Allow a categorized result to be applied through the existing PATCH /tickets/:id mutation, without introducing a new category persistence mechanism.

The existing AI provider, queue, realtime room, and authorization infrastructure should be reused rather than replaced.
```

---

## Acceptance criteria

```text
- [ ] AiPromptLog has a nullable text field for the generated AI output, with an appropriate Prisma migration.
- [ ] AiProcessingProcessor persists result.text into AiPromptLog when processing an AI request.
- [ ] The generated AI output is stored alongside the existing outcome, model, token, latency, and error information.
- [ ] A new ticket-scoped GET endpoint exists at:
      GET /tickets/:id/ai/:logId
      and returns the AI log's id, feature, outcome, output, errorMessage, and createdAt.
- [ ] The GET endpoint is protected by the existing ticket:read permission.
- [ ] The GET endpoint reuses the existing TicketsService.getTicket authorization/visibility behavior so department-scoped ticket access is preserved.
- [ ] A result belonging to another ticket cannot be retrieved through a different ticket id.
- [ ] Missing or unauthorized AI results are handled consistently with the repository's existing API conventions.
- [ ] The agent ticket detail page contains an AI ticket-assist card/section.
- [ ] The UI provides actions for:
      - Summarize
      - Suggest Reply
      - Categorize
- [ ] Each action submits through the existing POST /tickets/:id/ai/{feature} endpoint.
- [ ] After submission, the UI represents the operation as PENDING until the result becomes available.
- [ ] The existing ai.prompt_completed realtime event is consumed by apps/web.
- [ ] The realtime event causes the AI-result query to be invalidated/refetched using the established invalidate convention in useTicketRealtime.
- [ ] The final GET request retrieves the authoritative persisted result.
- [ ] SUCCESS results display the generated AI output.
- [ ] ERROR results display the error state/message appropriately.
- [ ] DISABLED results are represented as a disabled/unavailable state and are not incorrectly shown as an application error.
- [ ] PENDING results are represented as an in-progress state.
- [ ] Categorize results are display-only until the agent explicitly chooses to apply the suggested category.
- [ ] Applying a suggested category uses the existing PATCH /tickets/:id mutation already used by TicketDetailView.
- [ ] No new category persistence mechanism is introduced.
- [ ] No Portal-side AI UI is introduced.
- [ ] No changes are made to the AI provider selection/calling architecture.
- [ ] Backend unit tests cover persistence of output and AI result retrieval authorization/error cases.
- [ ] Backend e2e tests cover submit → processing → retrieve behavior for SUCCESS, ERROR, and DISABLED outcomes.
- [ ] Frontend tests cover loading, empty, pending, success, error, disabled, realtime-triggered refetch, and authorization/404 handling.
- [ ] Typecheck, lint, build, unit tests, and relevant e2e tests pass according to repository conventions.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| None                           |            |

---

## Dependencies

- **Blocked by / related ids:** None.
- **Depends on code areas or other stories:**

  - Story 72 — AI Services Foundation (`AiProvider`, `AiGatewayService`, `AiPromptLog`)
  - Stories 73–75 — Ticket AI Summarization, Suggested Reply, and Categorization
  - Story 76 — AI Ticket-Assist Async Processing
  - Story 20 — Realtime Socket.IO Foundation
  - Story 50 / 77 — existing agent ticket realtime routing precedent
  - Story 78 — Agent ticket detail UI/component patterns and frontend realtime conventions

All prerequisites are already complete; the story is fully unblocked.

## Extra notes (optional)

- Story 76 explicitly deferred a read-by-id/polling endpoint and left the durable `AiPromptLog` row as the future source of truth. This story fulfills that explicit deferral.
- The architecture states that human review is the default for agent-facing AI output, so the result must be presented to the agent rather than automatically applied.
- The existing `ai.prompt_completed` event already reaches agents through `ticket:{id}`; the missing piece is the frontend consumer and persisted output retrieval.
- The repository already has direct implementation precedents for the proposed UI, realtime, and worker test patterns.

## Technical hints (optional)

- APIs already exist:

  - `POST /tickets/:id/ai/summarize`
  - `POST /tickets/:id/ai/suggest-reply`
  - `POST /tickets/:id/ai/categorize`

- Existing realtime event:

  - `ai.prompt_completed`

- Existing realtime routing:

  - `ticket:{id}`
  - agent-only routing through `TicketRealtimeListener.relayToAgents`

- Existing backend worker:

  - `apps/worker/src/queues/ai-processing.processor.ts`

- Existing AI service:

  - `apps/api/src/modules/tickets/ticket-ai.service.ts`

- Existing ticket controller:

  - `apps/api/src/modules/tickets/tickets.controller.ts`

- Existing Prisma model:

  - `apps/api/prisma/schema.prisma` → `AiPromptLog`

- Existing frontend realtime hook:

  - `apps/web/src/hooks/use-ticket-realtime.ts`

- Existing frontend ticket detail:

  - `apps/web/src/components/tickets/ticket-detail-view.tsx`

- Existing frontend patterns:

  - `ticket-chat-card.tsx`
  - `attachments-card.tsx`
  - `use-ticket-messages.ts`

- Existing worker tests:

  - `ai-processing.processor.spec.ts`

**Important design point for planning:** `AiPromptLog` currently does not store `ticketId`. The new read-by-id endpoint must have a safe ticket-to-log relationship/verification strategy. The planner must resolve this explicitly rather than assuming the relationship exists.

Repos/roots: `.`
Primary language: `typescript`.

## Out of scope

- Chatbot / `AiFeature.CHAT`.
- Knowledge Base embeddings or semantic retrieval.
- Any Portal-side AI surface.
- Automatically applying suggested replies.
- Automatically applying categories.
- Any new category persistence mechanism.
- Changes to `AnthropicAiProvider`, `NullAiProvider`, or `packages/ai`.
- Changes to AI provider selection/calling behavior.
- AI history/activity-feed UI for past results.
- Other communication channel types such as email, SMS, WhatsApp, or web-form.
- Integrations Hub.
- Unrelated reporting, administration, or knowledge-base enhancements.
