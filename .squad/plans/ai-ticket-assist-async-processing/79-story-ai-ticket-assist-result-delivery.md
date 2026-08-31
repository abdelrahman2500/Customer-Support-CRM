# Story 79 — AI Ticket-Assist Result Delivery

## Prerequisites

- Story 72 (`ai-services-foundation`) completed: `AiProvider` boundary,
  `AiGatewayService`, `AiPromptLog` (`apps/api/prisma/schema.prisma`
  lines 853–914).
- Stories 73–75 completed: ticket-scoped Summarize/Suggest Reply/Categorize
  submit endpoints (`apps/api/src/modules/tickets/ticket-ai.service.ts`).
- Story 76 (`ai-ticket-assist-async-processing`) completed: real async
  worker processing, `ai.prompt_completed` realtime hand-back. Its own
  plan explicitly deferred this story's exact scope — see
  [76-story-ai-ticket-assist-async-processing.md](./76-story-ai-ticket-assist-async-processing.md)
  line 25: *"No polling/read-by-id endpoint — no frontend consumer exists
  for any of Stories 73-75 today, and the realtime event already covers
  the live-UX case; the durable `AiPromptLog` row remains inspectable
  through existing patterns if ever needed."* This story fulfills that.
- Story 20 (`realtime-socketio-foundation`): `ticket:{id}` room,
  `RealtimeGateway`, `TicketRealtimeListener` — reused unchanged.
- Story 78 (`customer-portal-live-chat`, see
  [../customer-portal-live-chat/78-story-live-chat-ui.md](../customer-portal-live-chat/78-story-live-chat-ui.md)):
  direct structural precedent for this story's new frontend files —
  `apps/web/src/hooks/use-ticket-messages.ts`,
  `apps/web/src/lib/ticket-messages-api.ts`, and
  `apps/web/src/components/tickets/ticket-chat-card.tsx` are the exact
  shapes this story's own `use-ticket-ai.ts`/`ticket-ai-api.ts`/
  `ticket-ai-card.tsx` mirror.

All prerequisites are complete; no external decision is required (the AI
vendor was already decided — Anthropic Claude behind `AiProvider` — and
this story touches no provider-selection code).

---

## Story Goal

Stories 73–76 built a complete AI ticket-assist pipeline, but the
generated text is computed by `apps/worker` and then discarded — never
persisted, never retrievable, never shown anywhere. This story:

1. Persists the AI-generated output on `AiPromptLog`.
2. Exposes it through a new ticket-scoped, `ticket:read`-gated GET
   endpoint.
3. Adds an agent-facing AI card to the ticket detail page in `apps/web`
   with Summarize / Suggest Reply / Categorize actions.
4. Wires the existing `ai.prompt_completed` realtime event to refresh the
   authoritative result once it's ready.
5. Represents `PENDING`/`SUCCESS`/`ERROR`/`DISABLED` distinctly.
6. Lets an agent apply a suggested category through the **existing**
   `PATCH /tickets/:id` mutation — no new category-persistence mechanism.

**Not in scope:** chatbot (`AiFeature.CHAT`), Knowledge Base
embeddings/semantic retrieval, any Portal-side AI surface, auto-applying
a suggested reply or category, any change to `AnthropicAiProvider`/
`NullAiProvider`/`packages/ai` or how a provider is selected, an AI
history/activity-feed UI, and every other communication-channel/
Integrations item already blocked by the unresolved external-provider
decision (`CLAUDE.md` §2) — untouched by this story either way.

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — read lines 853–914 (`AiFeature`,
   `AiOutcome`, `AiPromptLog` — note `AiPromptLog` currently has no
   `ticketId` and no output-text field) and lines 389–420 (`model Ticket`,
   its existing `channelMessages ChannelMessage[]` back-relation at line
   412 — the new `AiPromptLog` back-relation goes next to it). Also read
   lines 962–979 (`model ChannelMessage`) as the exact precedent for a
   required `ticketId` + `@@index([ticketId])` shape on a ticket-scoped
   log-like model (this story's own `ticketId` must be **nullable**
   instead, since `AiPromptLog` already has rows from Stories 72–76 with
   no `ticketId` — see Migration section).
2. `apps/api/src/modules/ai/ai-gateway.service.ts` — read the whole file
   (58 lines). `createPendingLog` (lines 31–50) is the method gaining a
   new parameter; `promptRef` (lines 56–58) is unrelated and unchanged.
3. `apps/api/src/modules/tickets/ticket-ai.service.ts` — read the whole
   file (112 lines). `submit()` (lines 82–102) is where `createPendingLog`
   is called (line 86) and where the new `getAiResult` method is added;
   `AiJobSubmittedResponse` (lines 9–15) is the exact shape to mirror for
   a new `AiResultResponse` type; the constructor (lines 63–68) currently
   has no `PrismaService` — it must be injected.
4. `apps/api/src/modules/tickets/tickets.controller.ts` — read lines 1–31
   (imports/constructor — `RequirePermissions` import at line 4,
   `AiJobSubmittedResponse` type import at line 11) and lines 108–154
   (the three existing `POST :id/ai/*` routes and the Story 77
   `:id/messages` routes) — the new `GET :id/ai/:logId` route is inserted
   between `categorize` (ends line 130) and the Story 77 comment
   (line 132).
5. `apps/worker/src/queues/ai-processing.processor.ts` — read the whole
   file (117 lines). `process()` (lines 62–105) computes `result` (line
   69, includes `result.text`) then calls `this.prisma.aiPromptLog.update`
   (lines 86–96) **without** `result.text` — this is the exact gap; the
   job payload already carries `ticketId` (destructured at line 63,
   `AiProcessingJobPayload.ticketId` declared at line 20), so no new data
   needs to reach the worker.
6. `apps/api/src/modules/ai/ai.events.ts` — read the whole file (22
   lines). `AiPromptCompletedEvent` (lines 16–21) already carries
   `aiPromptLogId`, `ticketId`, `feature`, `outcome` — enough to build an
   exact frontend query-key invalidation without a new payload field.
7. `apps/api/src/modules/tickets/tickets.module.ts` — read the whole file
   (57 lines). Confirms `TicketAiService` is already provided (line 51)
   and `AiModule` already imported (line 43) — no module wiring changes
   are needed for this story.
8. `apps/api/src/modules/tickets/tickets.service.ts` — read lines
   465–490 (`findTicketInCustomerScope`, the documented "404 masks both
   'doesn't exist' and 'belongs to someone else'" convention this story's
   own cross-ticket check mirrors) and lines 492–512 (`findTicketInScope`,
   what `getTicket()` calls — the existing branch/department-visibility
   check this story's new endpoint reuses unchanged via `getTicket`).
9. `apps/web/src/hooks/use-ticket-realtime.ts` — read the whole file (85
   lines). This is the file to extend: constants at lines 11–14, the
   `channel.message.created` handler (lines 65–74, a cache-merge) is the
   wrong pattern to copy for this event — the original `handleUpdate`
   shape (lines 60–63, an exact-key invalidate) is the right one, since
   an AI result is a one-shot value, not a growing list. Cleanup is at
   lines 76–82; the effect's dependency array is at line 83.
10. `apps/web/src/hooks/use-ticket-messages.ts` — read the whole file (46
    lines) — direct structural precedent for the new `use-ticket-ai.ts`
    (query key function shape, `useQuery`/`useMutation` shape).
11. `apps/web/src/lib/ticket-messages-api.ts` — read the whole file (39
    lines) — direct precedent for the new `ticket-ai-api.ts`.
12. `apps/web/src/components/tickets/ticket-chat-card.tsx` — read the
    whole file — direct precedent for `ticket-ai-card.tsx`'s card shape
    (loading/error/empty states, `useParams`/`useTranslations` usage).
13. `apps/web/src/components/tickets/ticket-detail-view.tsx` — read lines
    1–37 (imports) and lines 100–121 (`useTicketRealtime` at line 107,
    `useUpdateTicketMutation` at line 118 — the mutation this story's
    "apply category" button reuses) and lines 283–287 (`<TicketChatCard
    ticketId={ticketId} />` at line 285 — the new `<TicketAiCard>` mounts
    immediately after it, line 286).
14. `apps/api/src/modules/ai/ai-gateway.service.spec.ts` — read the whole
    file (71 lines). The two `createPendingLog` assertions (lines 24–38,
    47–56) must be updated for the new parameter.
15. `apps/api/src/modules/tickets/ticket-ai.service.spec.ts` — read the
    whole file (144 lines). The three `createPendingLog` assertions
    (lines 76–80, 116–120, 132–136) must be updated; the mock-builder
    functions (lines 8–31) show the exact DI-mock pattern the new
    `getAiResult` tests must extend with a `PrismaService` mock.
16. `apps/worker/src/queues/ai-processing.processor.spec.ts` — read the
    whole file (181 lines). The SUCCESS assertion (lines 95–105) and the
    DISABLED assertion (lines 140–161) are the two to update for the new
    `outputText` field.
17. `apps/api/test/tickets.e2e-spec.ts` — read lines 725–1013. Lines
    725–730 document this suite's scope boundary: **`apps/worker` is
    never booted**, so a SUCCESS-outcome test must simulate completion by
    updating the `AiPromptLog` row directly via Prisma (the file already
    does this pattern at line 799,
    `prisma.aiPromptLog.findUnique(...)`). Lines 738–774 are the exact
    "Agent role lacking `ticket:read` → 403" pattern to mirror. The new
    `describe` block is inserted after line 1008 (end of the "ticket AI
    enqueues a real ai-processing job" block) and before line 1010 (the
    Story 77 comment).
18. Grep for `AI_PROMPT_COMPLETED_EVENT` in `apps/api/src/realtime/` to
    confirm `TicketRealtimeListener` already relays it via
    `relayToAgents` (agent-only routing, unchanged by this story).

---

## Product rules (from story)

- **Categorize is display-only.** `ticket-ai.service.ts`'s own doc
  comment (lines 46–48) already states: *"`categorizeTicket` only ever
  returns a suggested category — nothing here writes to
  `Ticket.category`; an agent applies it via the existing `PATCH
  /tickets/:id` exactly like any other manual edit."* This story's UI
  must follow that: a "use as category" action calls the **existing**
  `useUpdateTicketMutation` (`ticket-detail-view.tsx` line 118) — it does
  **not** introduce a new endpoint, DTO field, or Prisma column for this.
- **`DISABLED` is not an error.** `AiOutcome`'s own doc comment
  (`schema.prisma` lines 862–865) states `DISABLED` (no
  `ANTHROPIC_API_KEY` configured) must never be conflated with `ERROR` (a
  real provider failure) — *"a caller or operator reading this log must
  be able to tell 'AI is off' from 'AI is broken' at a glance."*
  `packages/ai/src/null-ai-provider.ts` (lines 4–11) confirms `DISABLED`
  is what every call actually returns in this environment today (`text:
  null` always) — so this is the outcome the UI will most often render
  in dev/CI, not an edge case to deprioritize.

---

## Backend Tasks

### 1 — Schema: persist output text and the ticket relationship

**File: `apps/api/prisma/schema.prisma`**

In `model AiPromptLog` (starts line 895), add two nullable fields and one
index:

```prisma
model AiPromptLog {
  id           String    @id @default(uuid())
  branchId     String    @map("branch_id")
  branch       Branch    @relation(fields: [branchId], references: [id])
  /// Story 79 — nullable: rows created by Stories 72-76 before this
  /// column existed have none. Every row created after this story ships
  /// always sets it (AiGatewayService.createPendingLog, Task 2).
  ticketId     String?   @map("ticket_id")
  ticket       Ticket?   @relation(fields: [ticketId], references: [id], onDelete: SetNull)
  feature      AiFeature
  model        String
  promptRef    String    @map("prompt_ref")
  inputTokens  Int?      @map("input_tokens")
  outputTokens Int?      @map("output_tokens")
  latencyMs    Int?      @map("latency_ms")
  outcome      AiOutcome
  /// Story 79 — the actual generated text (summary / suggested reply /
  /// suggested category). Null exactly when outcome is PENDING, ERROR,
  /// or DISABLED (see packages/ai's AiCallResult.text: string | null).
  /// Named outputText, not `output`, to stay unambiguous next to the
  /// existing outputTokens field.
  outputText   String?   @map("output_text")
  errorMessage String?   @map("error_message")
  createdAt    DateTime  @default(now()) @map("created_at")

  @@index([branchId])
  @@index([feature])
  @@index([ticketId])
  @@map("ai_prompt_logs")
  @@schema("ai")
}
```

In `model Ticket` (starts line 389), add the back-relation next to the
existing `channelMessages ChannelMessage[]` (line 412):

```prisma
  channelMessages  ChannelMessage[]
  aiPromptLogs     AiPromptLog[]
```

Generate the migration from `apps/api`:
`pnpm prisma migrate dev --name add_ai_prompt_log_output`.

### 2 — `AiGatewayService.createPendingLog` gains a `ticketId` parameter

**File: `apps/api/src/modules/ai/ai-gateway.service.ts`**

Change the method signature (line 31) from:

```ts
async createPendingLog(
  feature: AiFeature,
  branchId: string,
  promptRefValue: string,
): Promise<{ id: string }> {
```

to add `ticketId: string` as a new parameter (place it after `branchId`,
matching the order the caller already has the values in), and add
`ticketId` to the `data` object passed to `this.prisma.aiPromptLog.create`
(lines 37–47).

### 3 — `TicketAiService`: pass the ticket id through, add `getAiResult`

**File: `apps/api/src/modules/tickets/ticket-ai.service.ts`**

- Update the `createPendingLog` call inside `submit()` (line 86) to pass
  `id` (already the method's own parameter, line 82) as the new
  `ticketId` argument.
- Inject `PrismaService` into the constructor (currently lines 63–68 has
  no Prisma dependency) — mirrors `AiGatewayService`'s own constructor
  (`ai-gateway.service.ts` line 25).
- Add a new exported response type next to `AiJobSubmittedResponse`
  (lines 9–15):

```ts
export interface AiResultResponse {
  id: string;
  feature: AiFeature;
  outcome: AiOutcome;
  outputText: string | null;
  errorMessage: string | null;
  createdAt: Date;
}
```

- Add a new public method:

```ts
async getAiResult(ticketId: string, logId: string): Promise<AiResultResponse> {
  await this.ticketsService.getTicket(ticketId);
  const log = await this.prisma.aiPromptLog.findUnique({ where: { id: logId } });
  if (!log || log.ticketId !== ticketId) {
    throw new NotFoundException("AI result not found");
  }
  return {
    id: log.id,
    feature: log.feature,
    outcome: log.outcome,
    outputText: log.outputText,
    errorMessage: log.errorMessage,
    createdAt: log.createdAt,
  };
}
```

`this.ticketsService.getTicket(ticketId)` throws `NotFoundException`
first if the ticket is outside the caller's branch/department scope
(`tickets.service.ts` lines 492–512) — the AI-result lookup is never
reached in that case. `log.ticketId !== ticketId` (including the `null`
case for pre-migration rows) masks "belongs to another ticket" and
"row doesn't exist" identically, mirroring
`findTicketInCustomerScope`'s own documented convention
(`tickets.service.ts` lines 465–468).

Import `NotFoundException` from `@nestjs/common` and `PrismaService`
from `../../prisma/prisma.service` at the top of this file.

### 4 — New GET endpoint

**File: `apps/api/src/modules/tickets/tickets.controller.ts`**

Add, between the existing `categorize` route (ends line 130) and the
Story 77 comment (line 132):

```ts
/** Story 79 — retrieves the durable AiPromptLog row a prior
 * summarize/suggest-reply/categorize submission created, once
 * apps/worker has resolved it. ticket:read-gated, same as the three
 * submit routes above; masks cross-ticket access as 404 (see
 * TicketAiService.getAiResult's own doc comment). */
@Get(":id/ai/:logId")
@RequirePermissions("ticket:read")
getAiResult(
  @Param("id") id: string,
  @Param("logId") logId: string,
): Promise<AiResultResponse> {
  return this.ticketAiService.getAiResult(id, logId);
}
```

Add `AiResultResponse` to the existing type-only import at line 11
(`import type { AiJobSubmittedResponse } from "./ticket-ai.service";`).

### 5 — Worker persists the output text

**File: `apps/worker/src/queues/ai-processing.processor.ts`**

In `process()`'s `this.prisma.aiPromptLog.update` call (lines 86–96), add
`outputText: result.text` to the `data` object (alongside the existing
`model`/`inputTokens`/`outputTokens`/`latencyMs`/`outcome`/`errorMessage`
fields). No other change to this file — `ticketId` is not written here;
it was already set at creation time by Task 2/3.

---

## Frontend Tasks

**No `apps/portal` changes** — this is an agent-facing-only feature per
`docs/architecture/07-sla-automation-and-ai.md`'s "human review is the
default for agent-facing output" and this story's own Non-goals.

### 6 — API client

**Create file: `apps/web/src/lib/ticket-ai-api.ts`** (mirrors
`apps/web/src/lib/ticket-messages-api.ts`'s exact shape):

```ts
import { apiFetch } from "./api";

export type TicketAiFeature = "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE";

export interface AiResultSummary {
  id: string;
  feature: TicketAiFeature | "CHAT";
  outcome: "PENDING" | "SUCCESS" | "ERROR" | "DISABLED";
  outputText: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const FEATURE_PATH: Record<TicketAiFeature, string> = {
  SUMMARIZE: "summarize",
  SUGGEST_REPLY: "suggest-reply",
  CATEGORIZE: "categorize",
};

export function submitAiOperation(
  ticketId: string,
  feature: TicketAiFeature,
): Promise<{ id: string; outcome: "PENDING" }> {
  return apiFetch(`/tickets/${ticketId}/ai/${FEATURE_PATH[feature]}`, { method: "POST" });
}

export function getAiResult(ticketId: string, logId: string): Promise<AiResultSummary> {
  return apiFetch<AiResultSummary>(`/tickets/${ticketId}/ai/${logId}`);
}
```

### 7 — Hooks

**Create file: `apps/web/src/hooks/use-ticket-ai.ts`** (mirrors
`apps/web/src/hooks/use-ticket-messages.ts`'s shape):

```ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { getAiResult, submitAiOperation } from "@/lib/ticket-ai-api";
import type { TicketAiFeature } from "@/lib/ticket-ai-api";

export const ticketAiResultQueryKey = (ticketId: string, logId: string) =>
  ["ticket", ticketId, "ai", logId] as const;

export function useTicketAiResultQuery(ticketId: string, logId: string | null) {
  return useQuery({
    queryKey: ticketAiResultQueryKey(ticketId, logId ?? ""),
    queryFn: () => getAiResult(ticketId, logId as string),
    enabled: logId !== null,
  });
}

export function useSubmitAiOperationMutation(ticketId: string) {
  return useMutation({
    mutationFn: (feature: TicketAiFeature) => submitAiOperation(ticketId, feature),
  });
}
```

### 8 — Realtime

**File: `apps/web/src/hooks/use-ticket-realtime.ts`**

Add a new constant alongside lines 11–14:

```ts
const AI_PROMPT_COMPLETED_EVENT = "ai.prompt_completed";
```

Import `ticketAiResultQueryKey` from `./use-ticket-ai` (alongside the
existing `mergeChannelMessage, ticketMessagesQueryKey` import at line 8).

Add, alongside the `handleChannelMessage` registration (lines 65–74):

```ts
const handleAiPromptCompleted = (payload: {
  aiPromptLogId: string;
  ticketId: string;
  feature: string;
  outcome: string;
}) => {
  if (payload.ticketId !== ticketId) {
    return;
  }
  void queryClient.invalidateQueries({
    queryKey: ticketAiResultQueryKey(ticketId, payload.aiPromptLogId),
  });
};
socket.on(AI_PROMPT_COMPLETED_EVENT, handleAiPromptCompleted);
```

This is an exact-key **invalidate** (matching `handleUpdate`'s original
pattern at lines 60–63), not the `channel.message.created` handler's
cache-merge (lines 65–74) — a result is a single value fetched once by
its known `logId`, not a growing list, so invalidating and letting
`useTicketAiResultQuery` refetch is the correct, simpler, precedented
choice. The event's own `aiPromptLogId` field (already present,
`ai.events.ts` line 17) is what makes an exact-key invalidate possible
without any component-local state threading through this hook.

Add the matching cleanup in the `return () => {...}` block (alongside
line 80):
`socket.off(AI_PROMPT_COMPLETED_EVENT, handleAiPromptCompleted);`

### 9 — UI card

**Create file: `apps/web/src/components/tickets/ticket-ai-card.tsx`**
(mirrors `apps/web/src/components/tickets/ticket-chat-card.tsx`'s
loading/error/empty-state conventions and `@/components/ui`
`Alert`/`Button`/`Skeleton` usage):

- Local `useState<{ feature: TicketAiFeature; logId: string } | null>`
  tracking the most recently submitted operation (cleared/replaced when a
  different action is clicked — only one result is shown at a time,
  matching the intake's own scope: no history/activity-feed UI).
- Three buttons (Summarize / Suggest Reply / Categorize), each calling
  `useSubmitAiOperationMutation(ticketId).mutateAsync(feature)`, then
  storing `{ feature, logId: result.id }` in state.
- Once a result is tracked, `useTicketAiResultQuery(ticketId, logId)`
  renders:
  - `isLoading` → a `Skeleton` (mirrors `ticket-chat-card.tsx`'s own
    loading state).
  - `data.outcome === "PENDING"` → an in-progress indicator + label.
  - `data.outcome === "SUCCESS"` → `data.outputText` in a text block; if
    `data.feature === "CATEGORIZE"`, also a "use as category" `Button`.
  - `data.outcome === "ERROR"` → an `Alert variant="destructive"` with
    `data.errorMessage`.
  - `data.outcome === "DISABLED"` → a distinct, non-error state (e.g. a
    neutral `Alert`/message) — **not** the same rendering path as
    `ERROR` (Product rules above).
- Props: `{ ticketId: string; onApplyCategory: (category: string) => void }`
  — `onApplyCategory` is provided by `TicketDetailView` (Task 10) so this
  component never instantiates its own `useUpdateTicketMutation`.

### 10 — Mount + i18n

**File: `apps/web/src/components/tickets/ticket-detail-view.tsx`**

- Import `TicketAiCard` alongside the existing `TicketChatCard` import.
- Render `<TicketAiCard ticketId={ticketId} onApplyCategory={(category) => mutation.mutate({ category })} />`
  immediately after `<TicketChatCard ticketId={ticketId} />` (line 285) —
  reusing the `mutation` already instantiated at line 118
  (`useUpdateTicketMutation(ticketId)`), not a second instance.

**Files: `apps/web/messages/{en,ar}.json`** — add new
`tickets.detail.ai*` keys (heading, action labels, pending/error/disabled
labels, "use as category" label), inserted the same way Story 78 added
`chat*` keys: after the last `chat*` key, before `slaHeading`.

---

## Edge Cases & Failure Modes

- **Cross-ticket log id** (`GET /tickets/A/ai/:logId` where the log was
  created for ticket B): must 404, never 200 with the wrong ticket's
  data. Enforced by `TicketAiService.getAiResult`'s
  `log.ticketId !== ticketId` check (Task 3). Tested in
  `tickets.e2e-spec.ts` (Test Plan item 4).
- **Log id for a ticket outside the caller's branch/department:**
  `getTicket(ticketId)` throws 404 first, via the existing
  `findTicketInScope` (`tickets.service.ts` lines 492–512) — the AI
  lookup is never reached.
- **A `logId` that never existed:** `findUnique` returns `null` → 404,
  the same message as the cross-ticket case (deliberately
  indistinguishable, matching `findTicketInCustomerScope`'s own
  documented masking convention).
- **`outcome: DISABLED`** — the only outcome this environment actually
  produces (`NullAiProvider` always returns it, `text: null`) — must
  render as a distinct "AI is off" state, never the `ERROR` UI path.
- **`outcome: PENDING` never resolving** (e.g. `apps/worker` isn't
  running in this environment): no new polling/timeout is introduced —
  the card simply keeps showing PENDING until a real
  `ai.prompt_completed` event arrives or the agent otherwise triggers a
  refetch. Matches Story 76's own explicit reasoning for deferring a
  polling endpoint (`76-story-*.md` line 26: "the realtime event already
  covers the live-UX case").
- **Two operations submitted back-to-back for the same ticket** (e.g.
  Summarize then Categorize before the first resolves): each has its own
  `AiPromptLog.id` and query key (`["ticket", id, "ai", logId]`) — no
  collision. The UI (Task 9) only tracks the single most-recently-clicked
  operation's `logId`, so an earlier PENDING result is simply replaced in
  the card's view, not lost from the database.
- **Pre-migration `AiPromptLog` rows** (created by Stories 72–76 before
  this story's migration) have `ticketId: null` — `getAiResult` treats
  `null !== ticketId` as a mismatch, so those rows are simply unreachable
  through the new endpoint. No backfill is attempted; no error is thrown
  differently for this case (Migration section).
- **A realtime event for a ticket the agent isn't currently viewing**
  (e.g. a stale background tab): `useTicketRealtime`'s existing
  `ticketId`-dependent effect (line 45, dependency array line 83) tears
  down and rejoins the socket room whenever `ticketId` changes — each
  mounted `TicketDetailView` only ever listens to its own ticket's room,
  so no cross-tab/cross-ticket invalidation is possible.
- **`categorize` applied via `onApplyCategory` while the ticket's
  category has since changed elsewhere** (e.g. another agent edited it
  concurrently): the existing `useUpdateTicketMutation` (Task 10) is the
  same one every other field on this page already uses — no new race
  condition is introduced beyond what already exists for concurrent
  ticket edits today.

---

## Test Plan

1. **`apps/api/src/modules/ai/ai-gateway.service.spec.ts`** — update the
   two existing `createPendingLog` assertions (lines 24–38, 47–56) to
   pass and assert the new `ticketId` argument.
2. **`apps/api/src/modules/tickets/ticket-ai.service.spec.ts`** — update
   the three existing `createPendingLog` assertions (lines 76–80,
   116–120, 132–136) for the new argument. Add a new
   `describe("getAiResult", ...)` block:
   - returns the mapped result when the log exists and its `ticketId`
     matches.
   - throws (404-equivalent) when the log's `ticketId` doesn't match.
   - throws when no log with that id exists.
   - never queries `AiPromptLog` if `getTicket` itself rejects (mirrors
     the existing "never calls the AI producer if loading the ticket
     fails" test, lines 102–109).
3. **`apps/worker/src/queues/ai-processing.processor.spec.ts`** — update
   the SUCCESS assertion (lines 95–105) to include
   `outputText: "A summary."`; update the DISABLED assertion (lines
   140–161) to include `outputText: null`.
4. **`apps/api/test/tickets.e2e-spec.ts`** — new
   `describe("ticket AI result retrieval (Story 79)", ...)` inserted
   after line 1008:
   - rejects an unauthenticated request → 401.
   - rejects an Agent-role user lacking `ticket:read` → 403 (mirrors
     lines 738–774's exact user-provisioning pattern).
   - returns 404 for a ticket that doesn't exist.
   - returns 404 for a `logId` that doesn't exist.
   - returns 404 when the `logId` belongs to a different ticket (submit
     on ticket A; separately create/attribute a log to ticket B via
     Prisma; fetch it through ticket A's route).
   - returns 200 with `outcome: "PENDING"`, `outputText: null`
     immediately after submit (no worker involved).
   - returns 200 with the real output after directly
     `prisma.aiPromptLog.update`-ing the row a real submit call created
     (`outcome: "SUCCESS"`, `outputText: "..."`) — explicitly not
     booting `apps/worker`, matching this file's own documented scope
     boundary (lines 725–730).
5. **`apps/web/src/hooks/use-ticket-realtime.spec.ts`** — two new tests
   mirroring the existing `channel.message.created` pair added by
   Story 78: "invalidates the exact AI result query key when
   ai.prompt_completed is received" and "ignores an ai.prompt_completed
   event for a different ticket."
6. **`apps/web/src/components/tickets/ticket-ai-card.spec.tsx`** (new,
   mirrors `ticket-chat-card.spec.tsx`'s shape):
   - initial render with no operation submitted yet.
   - clicking Summarize/Suggest Reply/Categorize submits and shows
     PENDING.
   - `SUCCESS` renders `outputText`.
   - `ERROR` renders `errorMessage`.
   - `DISABLED` renders the distinct disabled state, not the error one.
   - "use as category" only appears for `CATEGORIZE` + `SUCCESS`, and
     calls the `onApplyCategory` prop with `outputText`.
7. **`apps/web/src/components/tickets/ticket-detail-view.spec.tsx`** —
   add mocks for the new `@/hooks/use-ticket-ai` exports (mirrors how
   Story 78 added `@/hooks/use-ticket-messages` mocks to this same file).

---

## Migration / Rollback

- The migration adds two nullable columns (`ticket_id`, `output_text`)
  and one index to `ai_prompt_logs`, plus the `Ticket` back-relation —
  purely additive. No existing column is altered or dropped, and both
  new columns are nullable, matching this schema's own precedent for
  extending `AiPromptLog` (Story 76 added the `PENDING` enum value and
  `latencyMs`'s nullability the same way — additive, not breaking).
- **Rollback:** drop the two new columns and the new index. Any
  `ticket_id`/`output_text` values written by rows created after this
  story ships would be lost — acceptable, since this data is advisory
  (an agent's convenience view of a result), never the ticket's source
  of truth (`Ticket.category` is still only ever written by the existing
  `PATCH /tickets/:id`, unchanged).
- **Half-applied state** (migration ran, code deploy lagging): safe —
  old code simply never reads/writes the two new nullable columns, the
  same as every prior additive migration to this table.

---

## Verification Steps

1. **Backend builds:** run in `apps/api`:
   `pnpm prisma generate && pnpm typecheck`.
2. **Backend unit tests:** from the repo root:
   `pnpm --filter @crm/api test`.
3. **Backend e2e:** from the repo root:
   `pnpm --filter @crm/api test:e2e`.
4. **Worker unit tests:** from the repo root:
   `pnpm --filter @crm/worker test`.
5. **Frontend runs:** from the repo root:
   `pnpm --filter @crm/web typecheck`, then
   `pnpm --filter @crm/web lint`, then `pnpm --filter @crm/web test`.
6. **Regression:** from the repo root:
   `pnpm typecheck && pnpm lint && pnpm build && pnpm test` — confirms
   `apps/portal` and every other untouched package remain unaffected.

---

## Done Criteria

- [ ] `AiPromptLog` has `ticketId`/`outputText` columns and the
      `Ticket.aiPromptLogs` back-relation, via a real Prisma migration.
- [ ] `AiProcessingProcessor` persists `result.text` into `outputText`
      on every completed job.
- [ ] `AiGatewayService.createPendingLog` and `TicketAiService.submit`
      set `ticketId` on every new row.
- [ ] `GET /tickets/:id/ai/:logId` exists, is `ticket:read`-gated, reuses
      `TicketsService.getTicket`'s branch/department-visibility check,
      and masks cross-ticket access as 404.
- [ ] The agent ticket detail page shows a working AI card: three
      actions, PENDING/SUCCESS/ERROR/DISABLED states rendered distinctly,
      realtime-triggered refetch via the exact-key `ai.prompt_completed`
      invalidation.
- [ ] "Use as category" reuses the existing `PATCH /tickets/:id`
      mutation — no new category-persistence mechanism exists anywhere.
- [ ] No `apps/portal` change; no change to `AnthropicAiProvider`/
      `NullAiProvider`/`packages/ai`/provider selection.
- [ ] Every item in `## Test Plan` is added/updated and passing.
- [ ] Every command in `## Verification Steps` passes.
- [ ] Every pre-existing test suite remains green, unweakened.
