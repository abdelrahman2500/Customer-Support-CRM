# Story 85 — AI Chat: Escalate to a Human Ticket

## Prerequisites

- `ai-portal-chatbot` Story 80 — `ChatSession`/`ChatMessage` models,
  `AiChatService` (`apps/api/src/modules/ai/ai-chat.service.ts`),
  `PortalChatController`, `apps/portal`'s `ChatWidget`.
- `customer-portal-ticket-submission-tracking` Story 53 —
  `TicketsService.createTicketForContact`, `PortalTicketsService`,
  `PortalTicketsController`.
- `customer-portal-live-chat` Story 77/78 — `ChannelMessage` model,
  `ChannelMessagesService`, `TicketChannelService`, and the agent-side
  `TicketChatCard` message-thread component this story's output will
  render inside without any further change to that component's data
  fetching.

All three are complete and already merged to `main`.

## Story Goal

A portal customer talking to the AI chatbot can escalate the conversation
into a real support ticket with one action. The resulting ticket:

- is a completely ordinary `Ticket` row — created via the exact same
  `TicketsService.createTicketForContact` path a manually-submitted
  portal ticket uses, so it participates in SLA targeting, the
  unassigned-tickets queue, department/branch scoping, and every other
  existing ticketing mechanism with no special-casing;
- carries the full pre-escalation conversation as ordinary
  `ChannelMessage` rows (a new `ChannelType.AI_CHAT`), so it renders
  immediately in the agent's existing ticket message thread
  (`TicketChatCard`) with no new agent-facing UI route or component;
- is linked back to its originating `ChatSession` via a new
  `ChatSession.escalatedTicketId` column, so re-escalating the same
  session is idempotent (returns the same ticket) rather than creating a
  duplicate.

The customer portal's `ChatWidget` gains an "Escalate to a human agent"
action that, on success, takes the customer straight to the new ticket's
detail page.

## Non-Goals

- No agent-initiated escalation, no agent-facing "chat sessions" list/
  dashboard, no change to `chat-session:{id}`'s realtime authorization
  (still customer-only, unchanged from Story 80).
- No live hand-off — the AI chatbot does not keep running after
  escalation, and no realtime "an agent has joined" signal is added. The
  customer continues the conversation on the new ticket using the
  already-existing ticket live-chat surface (Story 77/78's
  `sendMessage`/`TicketChatCard`), not the AI chat widget.
- No change to `AnthropicAiProvider`/`NullAiProvider`/`packages/ai`, the
  `ai-processing` queue, or any AI provider selection/feature-flag logic
  (Story 81's `AiFeature`/`isFeatureEnabled` are untouched).
- No transactional (`$transaction`) rewrite of the multi-step create-
  ticket-then-replay-transcript sequence — this codebase has no existing
  interactive-transaction precedent anywhere (confirmed by Recon), and
  introducing one here for a single new call site would be a bigger
  architectural "first" than this story's scope warrants. See "Edge
  Cases" for the accepted, narrow risk this leaves and why it mirrors
  existing non-transactional multi-step flows elsewhere in this codebase
  (e.g. ticket creation and its downstream listeners are not atomic
  either).
- No new `apps/worker` code — this entire feature is synchronous
  request/response (reading already-persisted `ChatMessage` rows,
  creating a `Ticket`, writing `ChannelMessage` rows) with no external/AI
  provider call of its own.

## Design decisions

1. **Where the pointer lives**: `ChatSession.escalatedTicketId String?
   @unique` in the `ai` schema, referencing `ticketing.tickets(id)` — not
   a column on `Ticket` pointing back at `ChatSession`. The `ai` schema
   already has this exact cross-schema-FK shape (`AiPromptLog.ticketId`,
   `ChatSession.branchId` → `identity.branches`, `ChatSession.contactId`
   → `customers.contacts`); a chat session is the thing that "resolves
   into" a ticket, not the other way around, so the FK direction mirrors
   `AiPromptLog`'s own precedent instead of inventing a new one. A bare
   `Ticket.chatSessionOrigin ChatSession?` back-relation field is added to
   satisfy Prisma's bidirectional-relation requirement — it carries no
   database column of its own (the FK/unique constraint lives entirely on
   `ChatSession`).

2. **A new `ChannelType.AI_CHAT` value**, not a reuse of `LIVE_CHAT`. The
   transcript being replayed onto the new ticket did not happen on that
   ticket's own live-chat channel (the ticket didn't exist yet); labeling
   it `LIVE_CHAT` would misrepresent real data. `apps/web`'s
   `ChannelMessageSummary.channelType` is already typed as a loose
   `string` (Story 78's own documented decision), so no frontend type
   change is needed to accept the new value — only a small labeling fix
   (Design decision 4).

3. **Orchestration lives in `PortalTicketsService`, not in
   `AiChatService`.** `TicketsModule` already imports `AiModule` (so
   `TicketAiService` can call `AiGatewayService`) — the reverse import
   (`AiModule` importing `TicketsModule`) would be circular. `AiChatService`
   therefore never learns about tickets at all; it gains two small,
   ai-schema-only methods (`getEscalationContext`, `recordEscalation`)
   that do nothing but read/write `ChatSession`/`ChatMessage`. The actual
   "create a ticket and replay the transcript onto it" orchestration is a
   new method on `PortalTicketsService`, which already injects both
   `TicketsService` and `TicketChannelService` for this exact kind of
   composition (Story 53/77 precedent) and now additionally injects the
   already-exported `AiChatService` (`PortalModule` already imports
   `AiModule` for `PortalChatController`, so this is a zero-new-import-edge
   change).

4. **Agent-side label fix, not a new component.** `TicketChatCard`
   currently labels any `OUTBOUND` message with no `senderUserId` as a
   generic `"Agent"` (`t("detail.chatAgentLabel")`) — accurate today
   because the only `OUTBOUND` producer is `createOutboundFromUser`,
   which always sets a real `senderUserId`. Once `AI_CHAT`-channel,
   system-authored `OUTBOUND` messages exist (no `senderUserId`,
   Design decision 5), that fallback would misleadingly read "Agent" for
   a message the AI actually wrote. `TicketChatCard` adds one more
   `senderLabel` branch: `channelType === "AI_CHAT" && !senderUserId` →
   a new `t("detail.chatAiLabel")` ("AI Assistant" / "المساعد الذكي").
   Every other branch (including `AI_CHAT`-channel `INBOUND` messages,
   which do carry a real `senderContactId` and already render as
   `"Customer"`) is unchanged.

5. **A new `ChannelMessagesService.createSystemMessage` method**, not a
   reuse of `createOutboundFromUser`/`createInboundFromContact`. Replaying
   a `ChatMessage(role: "CUSTOMER")` turn reuses the *existing*
   `createInboundFromContact(ticketId, "AI_CHAT", contactId, body)`
   verbatim (the customer really did say this, and we know their real
   `contactId`). Replaying a `ChatMessage(role: "ASSISTANT")` turn has no
   `User` or `Contact` author at all — a new, minimal method is added:
   `createSystemMessage(ticketId, channelType, direction, body)`, which
   creates a `ChannelMessage` with both `senderContactId`/`senderUserId`
   left `null`. This is the smallest change that keeps
   `ChannelMessagesService`'s existing two creators exactly as they are.

6. **Ticket subject is derived automatically, not asked of the
   customer.** The whole point of escalation is a one-action hand-off
   mid-conversation — stopping to ask for a subject would be friction the
   feature exists to remove. The subject is the session's first
   `CUSTOMER` message, truncated to 120 characters (mirrors
   `PortalCreateTicketDto.subject`'s `MinLength(1)` floor with no upper
   bound in the DTO itself, but a ticket list/detail view assumes a
   reasonably short subject — 120 chars matches no existing precedent
   exactly, so it is a new, explicit, documented choice, not a guess:
   long enough to be informative, short enough not to overflow existing
   `TicketSummary` list-row layouts). A session with zero `ChatMessage`
   rows cannot be escalated at all (Edge Cases).

7. **Escalating an already-escalated session is idempotent.** If
   `ChatSession.escalatedTicketId` is already set, the endpoint returns
   that same `{ ticketId }` again rather than erroring or creating a
   second ticket — mirrors this codebase's existing idempotent-retry
   convention (e.g. Story 79's "two operations back-to-back" handling,
   CSAT's one-time-submission masking).

## Context — Read These Files First

- `apps/api/prisma/schema.prisma` — `ChatSession`/`ChatMessage` (search
  `model ChatSession`), `ChannelMessage`/`ChannelType` (search `model
  ChannelMessage`), `Ticket` (search `model Ticket `).
- `apps/api/src/modules/ai/ai-chat.service.ts` — `getOwnedSession`'s
  existing 404-masking convention, reused verbatim by the two new
  methods.
- `apps/api/src/modules/portal/portal-tickets.service.ts` — existing
  composition pattern (`TicketsService` + `TicketChannelService`) the new
  `escalateChatSession` method extends.
- `apps/api/src/modules/portal/portal-chat.controller.ts` — existing
  route shapes/claims-extraction convention (`request.user as
  JwtAccessTokenClaims`, `claims.sub`) the new route mirrors.
- `apps/api/src/modules/tickets/ticket-channel.service.ts` — existing
  `createCustomerMessage`/`createAgentMessage` shape the new
  `recordAiChatTranscript` method sits beside.
- `apps/api/src/modules/channels/channel-messages.service.ts` — existing
  `createInboundFromContact`/`createOutboundFromUser`/`emitAndReturn`
  the new `createSystemMessage` method mirrors.
- `apps/web/src/components/tickets/ticket-chat-card.tsx` — the
  `senderLabel` branch this story extends by one case.
- `apps/portal/src/components/chat/chat-widget.tsx` and
  `apps/portal/src/hooks/use-chat.ts`/`apps/portal/src/lib/chat-api.ts` —
  the existing hook/API-client shape the new escalate action mirrors.

## Backend Tasks

1. **Prisma schema** (`apps/api/prisma/schema.prisma`):
   - Add `AI_CHAT` to the `ChannelType` enum (after `WEB_FORM`, keeping
     the existing five in their documented order and appending the new
     one — do not reorder).
   - On `ChatSession`, add:
     ```prisma
     escalatedTicketId String?  @unique @map("escalated_ticket_id")
     escalatedTicket   Ticket?  @relation(fields: [escalatedTicketId], references: [id])
     ```
   - On `Ticket`, add the required Prisma back-relation field:
     ```prisma
     chatSessionOrigin ChatSession?
     ```
   - Run `pnpm --filter @crm/api prisma:migrate` (from repo root) or
     `pnpm prisma:migrate` (from `apps/api`) to generate a real migration
     named e.g. `add_chat_session_escalation`; if the sandbox's
     Claude-Code-detection consent gate blocks the shadow-database step
     the same way it blocks `migrate reset --force` elsewhere, hand-author
     the migration SQL (mirror `20260831233736_add_chat_sessions/
     migration.sql`'s exact style: `ALTER TYPE ... ADD VALUE`,
     `ALTER TABLE ... ADD COLUMN`, `ADD CONSTRAINT ... UNIQUE`,
     `ADD CONSTRAINT ... FOREIGN KEY`) and apply it with
     `prisma migrate resolve --applied <name>` plus a direct `psql`/
     `prisma db execute`, or `prisma migrate deploy`, whichever the
     sandbox actually allows — document whichever path was used in the
     completion report.
   - `pnpm --filter @crm/api prisma:generate` to regenerate the client.

2. **`ChannelMessagesService`**
   (`apps/api/src/modules/channels/channel-messages.service.ts`): add
   ```ts
   async createSystemMessage(
     ticketId: string,
     channelType: ChannelType,
     direction: ChannelMessageDirection,
     body: string,
   ): Promise<ChannelMessageSummary> {
     const message = await this.prisma.channelMessage.create({
       data: { ticketId, channelType, direction, body },
     });
     return this.emitAndReturn(ticketId, message);
   }
   ```
   (both `senderContactId`/`senderUserId` implicitly `null`).

3. **`TicketChannelService`**
   (`apps/api/src/modules/tickets/ticket-channel.service.ts`): add
   ```ts
   /** Replays a just-escalated ChatSession's transcript onto a brand-new
    * ticket, in order. No authorization check of its own — the caller
    * (`PortalTicketsService.escalateChatSession`) just created `ticketId`
    * for this exact `contactId`, mirroring `AiGatewayService`'s own "no
    * ticket-authorization logic of its own" precedent. */
   async recordAiChatTranscript(
     ticketId: string,
     contactId: string,
     messages: { role: "CUSTOMER" | "ASSISTANT"; body: string }[],
   ): Promise<void> {
     for (const message of messages) {
       if (message.role === "CUSTOMER") {
         await this.channelMessagesService.createInboundFromContact(
           ticketId,
           "AI_CHAT",
           contactId,
           message.body,
         );
       } else {
         await this.channelMessagesService.createSystemMessage(
           ticketId,
           "AI_CHAT",
           "OUTBOUND",
           message.body,
         );
       }
     }
   }
   ```

4. **`AiChatService`** (`apps/api/src/modules/ai/ai-chat.service.ts`):
   - Widen `getOwnedSession`'s return type to include
     `escalatedTicketId: string | null` (already present on the row once
     the schema change lands; only the TS annotation needs updating).
   - Add:
     ```ts
     async getEscalationContext(
       contactId: string,
       sessionId: string,
     ): Promise<{
       id: string;
       branchId: string;
       escalatedTicketId: string | null;
       messages: ChatMessageSummary[];
     }> {
       const session = await this.getOwnedSession(contactId, sessionId);
       const messages = await this.prisma.chatMessage.findMany({
         where: { sessionId: session.id },
         orderBy: { createdAt: "asc" },
       });
       return {
         id: session.id,
         branchId: session.branchId,
         escalatedTicketId: session.escalatedTicketId,
         messages,
       };
     }

     async recordEscalation(
       contactId: string,
       sessionId: string,
       ticketId: string,
     ): Promise<void> {
       await this.getOwnedSession(contactId, sessionId);
       await this.prisma.chatSession.update({
         where: { id: sessionId },
         data: { escalatedTicketId: ticketId },
       });
     }
     ```

5. **`PortalTicketsService`**
   (`apps/api/src/modules/portal/portal-tickets.service.ts`): inject
   `AiChatService`; add
   ```ts
   async escalateChatSession(
     contactId: string,
     sessionId: string,
   ): Promise<{ ticketId: string }> {
     const context = await this.aiChatService.getEscalationContext(contactId, sessionId);
     if (context.escalatedTicketId) {
       return { ticketId: context.escalatedTicketId };
     }
     if (context.messages.length === 0) {
       throw new BadRequestException("Cannot escalate a chat session with no messages");
     }
     const firstCustomerMessage = context.messages.find((message) => message.role === "CUSTOMER");
     const subject = (firstCustomerMessage?.body ?? "AI chat escalation").slice(0, 120);

     const ticket = await this.ticketsService.createTicketForContact(contactId, { subject });
     await this.ticketChannelService.recordAiChatTranscript(ticket.id, contactId, context.messages);
     await this.aiChatService.recordEscalation(contactId, sessionId, ticket.id);
     return { ticketId: ticket.id };
   }
   ```

6. **`PortalModule`** (`apps/api/src/modules/portal/portal.module.ts`):
   no import changes needed — `TicketsModule` and `AiModule` are already
   imported; update the module's own doc comment to note Story 85's new
   `PortalTicketsService` dependency on `AiChatService`.

7. **`PortalChatController`**
   (`apps/api/src/modules/portal/portal-chat.controller.ts`): inject
   `PortalTicketsService`; add
   ```ts
   @PortalRoute()
   @Post("sessions/:id/escalate")
   escalate(@Req() request: Request, @Param("id") id: string): Promise<{ ticketId: string }> {
     const claims = request.user as JwtAccessTokenClaims;
     return this.portalTicketsService.escalateChatSession(claims.sub, id);
   }
   ```

## Frontend Tasks — `apps/portal`

1. **`apps/portal/src/lib/chat-api.ts`**: add
   ```ts
   export function escalateChatSession(sessionId: string): Promise<{ ticketId: string }> {
     return apiFetch(`/portal/chat/sessions/${sessionId}/escalate`, { method: "POST" });
   }
   ```

2. **`apps/portal/src/hooks/use-chat.ts`**: add
   ```ts
   export function useEscalateChatSessionMutation(sessionId: string) {
     return useMutation({ mutationFn: () => escalateChatSession(sessionId) });
   }
   ```

3. **`apps/portal/src/components/chat/chat-widget.tsx`**: add an
   "Escalate to a human agent" button, visible once
   `messagesQuery.data.length > 0` (mirrors the widget's own existing
   `.length > 0` gating pattern already used for the message list). On
   click, calls the new mutation; on success, `router.push(`/${locale}/
   tickets/${result.ticketId}`)` (exact pattern already used by
   `apps/portal/src/components/tickets/ticket-list-view.tsx`); on
   failure, an inline `Alert`-style error line mirroring the widget's
   existing `startFailed`/`loadError` error rendering.

4. **`apps/portal/messages/{en,ar}.json`** — new keys under `chat.*`:
   `escalate` ("Escalate to a human agent" / "التصعيد إلى وكيل بشري"),
   `escalating` ("Escalating…" / "جارٍ التصعيد..."), `escalateFailed`
   ("Couldn't escalate this conversation. Please try again." / "تعذّر
   تصعيد هذه المحادثة. حاول مرة أخرى.").

## Frontend Tasks — `apps/web`

1. **`apps/web/src/components/tickets/ticket-chat-card.tsx`**: add one
   `senderLabel` branch (Design decision 4) — a `channelType === "AI_CHAT"`
   `OUTBOUND` message with no `senderUserId` renders `t("detail.
   chatAiLabel")` instead of falling through to `chatAgentLabel`. This
   requires `ChannelMessageSummary.channelType` (already present on the
   type, currently unused by this component) to be read for the first
   time here.

2. **`apps/web/messages/{en,ar}.json`** — new key under `tickets.detail`:
   `chatAiLabel` ("AI Assistant" / "المساعد الذكي").

## Edge Cases & Failure Modes

- **Escalating a session with zero messages**: rejected with `400 Bad
  Request` before any `Ticket`/`ChannelMessage` row is created — the
  portal UI never offers the action before at least one message exists,
  but the endpoint itself enforces this independently (never trusts the
  client).
- **Escalating an already-escalated session (double-click, or the
  customer revisits an old session)**: idempotent — returns the existing
  `{ ticketId }`, creates nothing new.
- **A session belonging to a different Contact, or a nonexistent session
  id**: masked as 404 by `getEscalationContext` → `getOwnedSession`,
  identical to every other `AiChatService` method's existing convention.
- **A PENDING assistant turn in flight at the moment of escalation**:
  only already-persisted `ChatMessage` rows are replayed — the in-flight
  turn (not yet a `ChatMessage`, still just a `PENDING` `AiPromptLog`) is
  silently omitted, exactly like `ERROR`/`DISABLED` turns are already
  never persisted as `ChatMessage`s (Story 80's own documented rule).
  Nothing after escalation retroactively adds it.
- **Partial failure mid-transcript-replay (not wrapped in a DB
  transaction — see Non-Goals)**: if `createTicketForContact` succeeds
  but `recordAiChatTranscript`/`recordEscalation` fails partway (e.g. a
  transient DB error), the ticket exists with a partial or absent
  transcript and `ChatSession.escalatedTicketId` is still `null`. A retry
  from the customer creates a *second*, separate ticket rather than
  resuming the first — an accepted, narrow risk consistent with this
  codebase's existing non-transactional multi-step conventions elsewhere
  (e.g. ticket creation and its downstream automation/SLA listeners are
  not atomic either). Not remediated by this story.
- **A ticket subject longer than 120 characters in the source message**:
  silently truncated, never rejected — matches this codebase's general
  preference for graceful truncation over a hard validation error on
  system-derived (not user-typed) values.

## Test Plan

1. **`apps/api/src/modules/channels/channel-messages.service.spec.ts`** —
   new case: `createSystemMessage` creates a `ChannelMessage` with
   `senderContactId: null, senderUserId: null` and emits
   `CHANNEL_MESSAGE_CREATED_EVENT`, mirroring the existing two creators'
   own test shape.
2. **`apps/api/src/modules/tickets/ticket-channel.service.spec.ts`** —
   new `recordAiChatTranscript` cases: a `CUSTOMER` turn calls
   `createInboundFromContact` with `"AI_CHAT"`; an `ASSISTANT` turn calls
   `createSystemMessage` with `"AI_CHAT"`/`"OUTBOUND"`; message order is
   preserved; an empty array creates nothing.
3. **`apps/api/src/modules/ai/ai-chat.service.spec.ts`** — new
   `getEscalationContext`/`recordEscalation` cases mirroring
   `getAiResult`'s existing cross-contact/nonexistent-id 404 tests
   exactly; `getEscalationContext` returns `escalatedTicketId: null`
   before escalation and the real id after `recordEscalation`.
4. **`apps/api/src/modules/portal/portal-tickets.service.spec.ts`** —
   new `escalateChatSession` cases: creates a ticket via
   `createTicketForContact` with a subject derived from the first
   `CUSTOMER` message; calls `recordAiChatTranscript` and
   `recordEscalation`; a session with `escalatedTicketId` already set
   returns it unchanged without calling `createTicketForContact` again;
   an empty-message session throws `BadRequestException`.
5. **`apps/api/test/portal-chat.e2e-spec.ts`** — new cases: escalating a
   session with at least one message returns `{ ticketId }`, and
   `GET /tickets/:id/messages` (agent-authenticated) for that ticket
   returns the replayed transcript in order with the right
   `direction`/`senderContactId`/`senderUserId` shape; escalating twice
   returns the same `ticketId`; escalating a zero-message session returns
   400; escalating a different contact's session returns 404; an
   unauthenticated/agent-audience token on the new route returns 401
   (mirrors the suite's existing top-of-file cases).
6. **`apps/web/src/components/tickets/ticket-chat-card.spec.tsx`** — new
   case: an `AI_CHAT`-channel `OUTBOUND` message with no `senderUserId`
   renders the new AI label, not `"Agent"`; an `AI_CHAT`-channel
   `INBOUND` message still renders `"Customer"`, unchanged.
7. **`apps/portal/src/hooks/use-chat.spec.ts`** — new
   `useEscalateChatSessionMutation` case mirroring the existing send/start
   mutation test shape.
8. **`apps/portal/src/components/chat/chat-widget.spec.tsx`** — new
   cases: the escalate button is hidden with zero messages, visible with
   at least one; a successful escalation navigates to
   `/${locale}/tickets/${ticketId}`; a failed escalation renders the
   inline error message.

## Migration / Rollback

- Additive: one new enum value (`AI_CHAT`), one new nullable+unique
  column and FK on `ChatSession`, one new bare Prisma back-relation field
  on `Ticket` (no database column). No existing column altered or
  dropped.
- **Rollback**: drop the `escalated_ticket_id` column/constraint from
  `chat_sessions`. Postgres cannot remove a single enum value
  non-destructively — if a full rollback of the enum value is ever
  required, it requires recreating the `ChannelType` type (standard
  Postgres limitation, not specific to this story); until then, leaving
  the unused `AI_CHAT` value in place is harmless.
- **Half-applied state**: safe — old code never reads/writes
  `ChatSession.escalatedTicketId` or produces `ChannelType.AI_CHAT` rows.

## Verification Steps

1. `pnpm prisma generate && pnpm --filter @crm/api typecheck`
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or, if the sandbox's
   `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` gate blocks
   `test:e2e:prepare`'s `migrate reset --force` the same way it did for
   Stories 79/80, re-seed via `pnpm prisma:seed` and run the new/changed
   `portal-chat.e2e-spec.ts` file in isolation instead:
   `npx vitest run test/portal-chat.e2e-spec.ts --no-file-parallelism`
   from `apps/api` — see those stories' own completion reports for the
   precedent).
4. `pnpm --filter @crm/web typecheck && pnpm --filter @crm/web lint && pnpm --filter @crm/web test`
5. `pnpm --filter @crm/portal typecheck && pnpm --filter @crm/portal lint && pnpm --filter @crm/portal test`
6. `pnpm typecheck && pnpm lint && pnpm build` (confirms every other
   untouched package remains unaffected).
7. `git status --short`

## Done Criteria

- [ ] `ChannelType.AI_CHAT` and `ChatSession.escalatedTicketId` exist via
      a real Prisma migration.
- [ ] `POST /portal/chat/sessions/:id/escalate` exists, is
      `@PortalRoute()`-gated, masks cross-Contact/nonexistent sessions as
      404, rejects a zero-message session with 400, and is idempotent for
      an already-escalated session.
- [ ] The created ticket is indistinguishable from a normally-submitted
      portal ticket except for its origin transcript (SLA targeting,
      unassigned queue, branch/department scoping all apply unchanged).
- [ ] The pre-escalation transcript appears, in order, as `ChannelMessage`
      rows on the new ticket and renders correctly (with the right
      sender attribution) in `apps/web`'s existing `TicketChatCard`.
- [ ] `apps/portal`'s `ChatWidget` offers the escalate action once
      messages exist and navigates to the new ticket on success.
- [ ] No `$transaction` introduced; no change to
      `AnthropicAiProvider`/`NullAiProvider`/`packages/ai`/`ai-processing`/
      any AI feature-flag logic; no new NestJS module or cross-module
      import edge beyond the two new methods on already-injected services.
- [ ] Every item in `## Test Plan` is added and passing.
- [ ] Every command in `## Verification Steps` passes (or is substituted
      per its own documented e2e fallback).
- [ ] Every pre-existing test suite remains green, unweakened.
