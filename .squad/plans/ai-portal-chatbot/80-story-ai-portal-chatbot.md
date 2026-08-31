# Story 80 — AI Portal Chatbot (Foundation)

## Prerequisites

- Story 72 (`ai-services-foundation`): `AiProvider` boundary (incl.
  `chat(input: AiChatMessageInput): Promise<AiCallResult>`,
  `packages/ai/src/ai-provider.interface.ts`), `AiGatewayService`,
  `AiPromptLog`.
- Story 76 (`ai-ticket-assist-async-processing`): the `ai-processing`
  queue (`apps/api/src/queues/ai-processing.producer.ts` /
  `apps/worker/src/queues/ai-processing.processor.ts`) and the
  `ai-processing-events` hand-back bridge
  (`apps/api/src/queues/ai-processing-events-bridge.processor.ts`) this
  story extends to a second feature (`CHAT`) rather than replacing.
- Story 79 (`ai-ticket-assist-result-delivery`): the "durable log row +
  read-by-id endpoint + realtime-triggered refetch" pattern this story
  reuses for chat (`ticket-ai.service.ts`'s `getAiResult`,
  `ticket-ai-card.tsx`'s PENDING/SUCCESS/ERROR/DISABLED rendering,
  `use-ticket-ai.ts`'s query-key shape).
- Story 52 (`customer-portal-authentication-foundation`): `PortalService`,
  `@PortalRoute()`/`AudienceGuard`, `JwtAccessTokenClaims` (`sub`,
  `audience`, `branchId`).
- Story 20 (`realtime-socketio-foundation`) + Story 77
  (`customer-portal-live-chat`): `RealtimeGateway`'s `audience: "customer"`
  socket support and its `authorizeRoom` per-room DB-backed authorization
  pattern, reused for a new `chat-session:{id}` room.

All prerequisites are complete. The AI vendor is already decided
(Anthropic Claude behind `AiProvider`) — this story touches no
provider-selection code, only a second call site of the already-tested
`chat()` method.

---

## Story Goal

`AiProvider.chat()` has existed, and been unit-tested in both
`AnthropicAiProvider` and `NullAiProvider`, since Story 72 — but has zero
call sites anywhere in `apps/api`/`apps/worker`/`apps/portal`. This story
delivers the first real chatbot surface: an authenticated Customer Portal
Contact can start a chat session and exchange turn-based messages with the
AI, per `docs/architecture/07-sla-automation-and-ai.md`'s explicit framing
("Autonomous responses are limited to portal self-service in this
foundation phase").

1. Add `ChatSession`/`ChatMessage` models (durable conversation history).
2. Extend the existing `ai-processing` worker queue to accept a `CHAT`
   job, calling `AiProvider.chat()` and persisting the assistant's reply
   as a `ChatMessage` on success.
3. Extend the existing `ai-processing-events` hand-back bridge with a
   parallel, chat-scoped realtime event and room (`chat-session:{id}`),
   mirroring — not modifying — the ticket-scoped `ai.prompt_completed` /
   `ticket:{id}` path.
4. Add portal-scoped REST endpoints: start a session, send a message,
   list a session's messages, and poll one operation's result (mirrors
   Story 79's `GET /tickets/:id/ai/:logId` exactly, chat-session-scoped).
5. Add a portal-side chat widget (new page + hook + API client),
   mirroring `TicketAiCard`'s PENDING/SUCCESS/ERROR/DISABLED rendering.

**Not in scope:** any agent-facing visibility into a chat session (no
`apps/web` change at all), Knowledge Base–grounded retrieval augmenting
chat context, streaming/token-by-token replies, session listing/history
UI beyond the single active session a widget page manages, multi-session
management, anonymous (unauthenticated) chat, and any change to
`AnthropicAiProvider`/`NullAiProvider`/`packages/ai`/provider selection.

---

## Design decision — CHAT goes through `ai-processing`, not a new direct-call path

Three architecture documents mention chatbot latency/dispatch, and they
are not perfectly consistent on the surface:

- `docs/architecture/02-system-architecture-overview.md` Boundary rule 2:
  *"`apps/api` never blocks a request on slow external work (sending an
  email/WhatsApp message, calling the AI provider, syncing to the
  ERP)... always enqueued to BullMQ and performed by `apps/worker`."*
  Unqualified — no chat exception stated.
- `docs/architecture/07-sla-automation-and-ai.md`: *"Non-interactive AI
  work uses `ai-processing`; interactive chatbot turns use the
  asynchronous provider client through the API."* Read literally, this
  could mean `apps/api` calls the provider directly, in-request.
- `docs/architecture/06-communication-and-realtime.md`: *"`ai-processing`
  for summaries, categorization, suggested replies, **and chatbot work**
  that need not block requests."* Unambiguous: chatbot work is explicitly
  named as one of `ai-processing`'s own listed jobs.

Doc 06 is the most specific and most recently load-bearing of the three
(it is the same document whose queue list Story 76's own plan already
cited verbatim to justify `ai-processing`'s existence for ticket AI), and
it directly names chatbot work as belonging to that queue — resolving the
apparent tension in doc 07 in `ai-processing`'s favor. This reading is
reinforced by `apps/api/src/modules/ai/ai.module.ts`'s own Story 76 doc
comment, which deliberately removed `AI_PROVIDER` construction from
`apps/api` *"even unused... the structural guarantee, not just avoiding
invoking it in this one case."* Reintroducing direct provider
construction into `apps/api` for chat would reverse that deliberate,
already-shipped hardening for a doc-07 phrase that is better read as "the
provider's own client SDK is Promise-based" than as a literal
architectural carve-out — especially since doc 07's own header states it
is "foundation-level... concrete rule sets and UX belong to future
stories," i.e. subject to exactly this kind of later refinement.

**Consequence:** `CHAT` becomes a fourth `feature` value on the existing
`ai-processing` job/processor and the existing `ai-processing-events`
hand-back bridge — additive changes to already-generic types, not a new
mechanism. The customer-facing UX cost is that a chat turn arrives via a
realtime event (or a page reload) a moment after the request returns
`{ id, outcome: "PENDING" }`, rather than in the same HTTP response — an
explicit, acceptable trade-off for "foundation phase" self-service,
exactly like every ticket-scoped AI feature already behaves.

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `AiPromptLog` (nullable `ticketId`,
   `outputText` from Story 79), `AiFeature`/`AiOutcome` enums, `Branch`,
   `Contact`.
2. `packages/ai/src/types.ts` (`AiChatMessageInput { sessionId, message }`,
   `AiCallResult`), `packages/ai/src/ai-provider.interface.ts` (`chat`).
3. `apps/worker/src/queues/ai-processing.processor.ts` (whole file) — the
   `AiProcessingJobPayload` type, `process()`, and the `call()` switch are
   all being extended, not replaced.
4. `apps/api/src/queues/ai-processing.producer.ts` and
   `apps/worker/src/queues/ai-processing-events.types.ts` /
   `apps/api/src/queues/ai-processing-events-bridge.processor.ts` — the
   deliberately-duplicated-literal cross-app type pairs that must stay in
   sync (Story 14's own established convention, cited in each file's own
   doc comment).
5. `apps/api/src/modules/ai/ai-gateway.service.ts`,
   `apps/api/src/modules/ai/ai.module.ts`, `apps/api/src/modules/ai/ai.events.ts`.
6. `apps/api/src/modules/tickets/ticket-ai.service.ts` (Story 79's
   `getAiResult` — the exact cross-resource-masking convention this
   story's `getOwnedSession`/`getAiResult` mirror) and
   `apps/api/src/modules/tickets/tickets.controller.ts`'s `GET
   :id/ai/:logId` route.
7. `apps/api/src/modules/portal/portal.module.ts`,
   `portal-tickets.controller.ts`, `portal-tickets.service.ts`,
   `portal.service.ts` (`getAuthenticatedContact`, `AuthenticatedContact`
   shape — no `branchId`; that comes from `request.user.branchId`, the
   JWT claim set at login), `dto/create-channel-message.dto.ts` (reused
   verbatim for the chat-message body DTO — identical `{ body: string }`
   shape).
8. `apps/api/src/realtime/realtime.gateway.ts` (whole file) —
   `authorizeRoom`'s `ticket:(.+)$` customer-audience branch is the exact
   precedent for this story's new `chat-session:(.+)$` branch;
   `RealtimeSocketData`/`RealtimeClaims` unchanged.
9. `apps/api/src/realtime/ticket-realtime.listener.ts` and
   `realtime.module.ts` — `TicketRealtimeListener`'s `relay()` pattern is
   mirrored by this story's new `ChatRealtimeListener`, registered the
   same way in `RealtimeModule`'s `providers`.
10. `apps/api/src/queues/queues.module.ts` — confirms `AiProcessingProducer`
    is already exported; `AiModule` needs to import `QueuesModule` (no
    circular dependency: `QueuesModule` imports nothing from `AiModule`).
11. `apps/web/src/hooks/use-ticket-ai.ts`,
    `apps/web/src/lib/ticket-ai-api.ts`,
    `apps/web/src/components/tickets/ticket-ai-card.tsx` — the direct,
    already-proven structural precedent for this story's portal-side
    `use-chat.ts`/`chat-api.ts`/`chat-widget.tsx`.
12. `apps/portal/src/components/tickets/ticket-chat-card.tsx` — precedent
    for a message-list-plus-composer UI in `apps/portal` specifically
    (styling/i18n conventions, `useParams`/`useTranslations` usage).

---

## Backend Tasks

### 1 — Schema: `ChatSession` / `ChatMessage`, and a nullable `chatSessionId` on `AiPromptLog`

**File: `apps/api/prisma/schema.prisma`**

New models, in the `ai` schema alongside `AiPromptLog`:

```prisma
enum ChatMessageRole {
  CUSTOMER
  ASSISTANT

  @@schema("ai")
}

/// Story 80 — one portal self-service chat conversation. No
/// `TicketVisibilityScope`/department scoping: a chat session belongs to
/// exactly one Contact, checked directly (mirrors `ContactRefreshToken`'s
/// own contact-scoping, not `Ticket`'s department-visibility mechanism).
model ChatSession {
  id           String        @id @default(uuid())
  branchId     String        @map("branch_id")
  branch       Branch        @relation(fields: [branchId], references: [id])
  contactId    String        @map("contact_id")
  contact      Contact       @relation(fields: [contactId], references: [id], onDelete: Cascade)
  messages     ChatMessage[]
  aiPromptLogs AiPromptLog[]
  createdAt    DateTime      @default(now()) @map("created_at")

  @@index([branchId])
  @@index([contactId])
  @@map("chat_sessions")
  @@schema("ai")
}

/// Story 80 — one turn in a `ChatSession`. Only `ASSISTANT` messages with
/// a real reply are ever inserted here (a failed/disabled turn is never
/// persisted as a message — see `AiProcessingProcessor`'s own comment);
/// `outcome`/`errorMessage` for that turn live on the `AiPromptLog` row
/// instead, retrieved via `GET .../ai/:logId` exactly like ticket AI.
model ChatMessage {
  id        String          @id @default(uuid())
  sessionId String          @map("session_id")
  session   ChatSession     @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      ChatMessageRole
  body      String
  createdAt DateTime        @default(now()) @map("created_at")

  @@index([sessionId])
  @@map("chat_messages")
  @@schema("ai")
}
```

In `model AiPromptLog`, add a second nullable FK next to `ticketId`
(mutually exclusive by `feature`, mirroring the existing `ticketId`
nullability rationale):

```prisma
  chatSessionId String?      @map("chat_session_id")
  chatSession   ChatSession? @relation(fields: [chatSessionId], references: [id], onDelete: SetNull)
  ...
  @@index([chatSessionId])
```

Add back-relations: `Branch.chatSessions ChatSession[]` (next to
`aiPromptLogs`), `Contact.chatSessions ChatSession[]` (next to
`channelMessages`).

Generate the migration from `apps/api`:
`pnpm prisma migrate dev --name add_chat_sessions`.

### 2 — `AiGatewayService.createPendingLog`: `ticketId` becomes nullable, chat passes `null`

**File: `apps/api/src/modules/ai/ai-gateway.service.ts`**

Change the `ticketId: string` parameter (Story 79) to `ticketId: string |
null`, and add a `chatSessionId: string | null` parameter (after
`ticketId`), both written straight into `data`. Every existing call site
(`TicketAiService.submit`) passes its real `ticketId` and `null` for
`chatSessionId`; this story's new `AiChatService.sendMessage` passes
`null` for `ticketId` and the real `chatSessionId`.

### 3 — Extend the `ai-processing` job/processor with `CHAT`

**Files:** `apps/api/src/queues/ai-processing.producer.ts` (type only) and
`apps/worker/src/queues/ai-processing.processor.ts` — keep the two
`AiProcessingJobPayload` declarations identical, per their own existing
"must stay identical" doc comments.

```ts
export interface AiProcessingJobPayload {
  aiPromptLogId: string;
  branchId: string;
  feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE" | "CHAT";
  /** Ticket-scoped features only. */
  ticketId?: string;
  subject?: string;
  /** Ticket-scoped features: the joined note text. CHAT: the customer's
   * raw message text. Always present. */
  body: string;
  /** CHAT only. */
  chatSessionId?: string;
}
```

In `AiProcessingProcessor`:

- Replace the `call(feature, input)` helper with one that takes the whole
  job payload and switches on `feature`, adding a `CHAT` case that calls
  `this.provider.chat({ sessionId: data.chatSessionId!, message: data.body })`
  (ticket cases keep calling `summarize`/`suggestReply`/`categorize` with
  `{ subject: data.subject ?? "", body: data.body }`, unchanged
  behavior).
- After the existing `aiPromptLog.update` (unchanged — `outputText:
  result.text` already covers chat), add: when `feature === "CHAT"` and
  `result.outcome === "SUCCESS"`, `this.prisma.chatMessage.create({
  data: { sessionId: chatSessionId!, role: "ASSISTANT", body: result.text
  ?? "" } })`. On `ERROR`/`DISABLED`, no `ChatMessage` row is created —
  the frontend distinguishes this via the same `GET .../ai/:logId`
  polling Story 79 established, never by a placeholder message in the
  conversation.
- The `handbackQueue.add(...)` call becomes feature-conditional:
  `{ aiPromptLogId, feature, outcome: result.outcome, ...(feature ===
  "CHAT" ? { chatSessionId } : { ticketId }) }`.
- The final `logger.log` line uses `ticketId ?? chatSessionId` as the
  logged identifier.

### 4 — Extend the `ai-processing-events` hand-back bridge with a chat-scoped event

**Files:** `apps/worker/src/queues/ai-processing-events.types.ts` and
`apps/api/src/queues/ai-processing-events-bridge.processor.ts` — widen
`AiCompletionJobPayload`:

```ts
export interface AiCompletionJobPayload {
  aiPromptLogId: string;
  feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE" | "CHAT";
  outcome: "SUCCESS" | "ERROR" | "DISABLED";
  ticketId?: string;
  chatSessionId?: string;
}
```

In `AiProcessingEventsBridgeProcessor.process`, branch on
`job.data.feature === "CHAT"`: emit a **new** event,
`AI_CHAT_MESSAGE_COMPLETED_EVENT` (`"ai.chat_message_completed"`), payload
`{ aiPromptLogId, chatSessionId, outcome }` — defined in a new
`apps/api/src/modules/ai/ai-chat.events.ts` (mirrors `ai.events.ts`'s
exact shape/placement). For the three ticket features, emit
`AI_PROMPT_COMPLETED_EVENT` exactly as today — `ai.events.ts` and
`TicketRealtimeListener` are **unchanged**.

### 5 — `ChatRealtimeListener` + `chat-session:{id}` room

**New file: `apps/api/src/realtime/chat-realtime.listener.ts`** —
mirrors `TicketRealtimeListener`'s `relay()` exactly (`@Injectable()`,
one `@OnEvent` handler, try/catch, `Logger.error`, never rethrows), but
relays into `chat-session:{id}` via a plain `gateway.server.to(...)`
broadcast (not `emitToAgentsInRoom` — this room is customer-only by
construction, see Task 6). Register in `RealtimeModule`'s `providers`.

**File: `apps/api/src/realtime/realtime.gateway.ts`** — in
`authorizeRoom`, add a new branch immediately after the existing
`ticketMatch` block and before the `if (claims.audience !== "agent")
{ return false; }` agent-only gate (this room is the inverse: **customer**
audience only):

```ts
const chatSessionMatch = /^chat-session:(.+)$/.exec(room);
if (chatSessionMatch) {
  if (claims.audience !== "customer") {
    return false;
  }
  const session = await this.prisma.chatSession.findUnique({
    where: { id: chatSessionMatch[1] },
    select: { contactId: true },
  });
  return session !== null && session.contactId === claims.userId;
}
```

### 6 — `AiChatService`

**New file: `apps/api/src/modules/ai/ai-chat.service.ts`** — owns the
`ai` schema's chat surface, mirrors `TicketAiService`'s shape:

```ts
export interface ChatMessageSummary {
  id: string;
  role: "CUSTOMER" | "ASSISTANT";
  body: string;
  createdAt: Date;
}

export interface AiChatResultResponse {
  id: string;
  outcome: "PENDING" | "SUCCESS" | "ERROR" | "DISABLED";
  outputText: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

@Injectable()
export class AiChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly aiProcessingProducer: AiProcessingProducer,
  ) {}

  async startSession(contactId: string, branchId: string): Promise<{ id: string }> {
    const session = await this.prisma.chatSession.create({ data: { contactId, branchId } });
    return { id: session.id };
  }

  async sendMessage(
    contactId: string,
    sessionId: string,
    body: string,
  ): Promise<{ id: string; outcome: "PENDING" }> {
    const session = await this.getOwnedSession(contactId, sessionId);
    await this.prisma.chatMessage.create({
      data: { sessionId: session.id, role: "CUSTOMER", body },
    });
    const log = await this.aiGatewayService.createPendingLog(
      "CHAT",
      session.branchId,
      null,
      session.id,
      promptRef(session.id, body),
    );
    await this.aiProcessingProducer.enqueue({
      aiPromptLogId: log.id,
      branchId: session.branchId,
      feature: "CHAT",
      body,
      chatSessionId: session.id,
    });
    return { id: log.id, outcome: "PENDING" };
  }

  async getMessages(contactId: string, sessionId: string): Promise<ChatMessageSummary[]> {
    const session = await this.getOwnedSession(contactId, sessionId);
    return this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
  }

  async getAiResult(
    contactId: string,
    sessionId: string,
    logId: string,
  ): Promise<AiChatResultResponse> {
    await this.getOwnedSession(contactId, sessionId);
    const log = await this.prisma.aiPromptLog.findUnique({ where: { id: logId } });
    if (!log || log.chatSessionId !== sessionId) {
      throw new NotFoundException("AI result not found");
    }
    return {
      id: log.id,
      outcome: log.outcome,
      outputText: log.outputText,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt,
    };
  }

  /** Masks "session doesn't exist" and "belongs to another Contact"
   * identically as 404 — mirrors `TicketAiService.getAiResult`'s own
   * documented convention. */
  private async getOwnedSession(contactId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session || session.contactId !== contactId) {
      throw new NotFoundException("Chat session not found");
    }
    return session;
  }
}
```

(`promptRef` imported from `./ai-gateway.service`, matching
`TicketAiService`'s own import.)

**File: `apps/api/src/modules/ai/ai.module.ts`** — import `QueuesModule`
(for `AiProcessingProducer`), add `AiChatService` to `providers`/`exports`.

### 7 — Portal controller

**New file: `apps/api/src/modules/portal/portal-chat.controller.ts`**,
registered in `PortalModule` (which must import `AiModule` — mirrors its
existing `TicketsModule`/`KnowledgeBaseModule` imports):

```ts
@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal/chat")
export class PortalChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @PortalRoute()
  @Post("sessions")
  start(@Req() request: Request): Promise<{ id: string }> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.aiChatService.startSession(contact.sub, contact.branchId);
  }

  @PortalRoute()
  @Post("sessions/:id/messages")
  sendMessage(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() dto: CreateChannelMessageDto,
  ): Promise<{ id: string; outcome: "PENDING" }> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.aiChatService.sendMessage(contact.sub, id, dto.body);
  }

  @PortalRoute()
  @Get("sessions/:id/messages")
  getMessages(@Req() request: Request, @Param("id") id: string): Promise<ChatMessageSummary[]> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.aiChatService.getMessages(contact.sub, id);
  }

  @PortalRoute()
  @Get("sessions/:id/ai/:logId")
  getAiResult(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("logId") logId: string,
  ): Promise<AiChatResultResponse> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.aiChatService.getAiResult(contact.sub, id, logId);
  }
}
```

`CreateChannelMessageDto` (`../tickets/dto/create-channel-message.dto.ts`)
is reused verbatim for the message body — identical `{ body: string }`
shape and validation, exactly like `PortalTicketsController.sendMessage`
already reuses it.

---

## Frontend Tasks (`apps/portal` only — no `apps/web` change)

### 8 — API client

**New file: `apps/portal/src/lib/chat-api.ts`** — mirrors
`apps/web/src/lib/ticket-ai-api.ts`'s shape: `startChatSession`,
`sendChatMessage`, `getChatMessages`, `getChatAiResult`.

### 9 — Hooks

**New file: `apps/portal/src/hooks/use-chat.ts`** — mirrors
`apps/web/src/hooks/use-ticket-ai.ts`: `chatMessagesQueryKey(sessionId)`,
`chatAiResultQueryKey(sessionId, logId)`, `useChatMessagesQuery`,
`useChatAiResultQuery`, `useStartChatSessionMutation`,
`useSendChatMessageMutation`.

**New file: `apps/portal/src/hooks/use-chat-realtime.ts`** — mirrors
`apps/web/src/hooks/use-ticket-realtime.ts`'s minimal shape: joins
`chat-session:{id}`, listens for `ai.chat_message_completed`, and on a
matching `chatSessionId` invalidates **both**
`chatMessagesQueryKey(sessionId)` (a successful turn adds a row) and
`chatAiResultQueryKey(sessionId, aiPromptLogId)` (the exact-key result
poll, covering ERROR/DISABLED too).

### 10 — Chat widget page

**New file: `apps/portal/src/components/chat/chat-widget.tsx`** — mirrors
`apps/web/src/components/tickets/ticket-ai-card.tsx`'s
loading/PENDING/SUCCESS/ERROR/DISABLED conventions crossed with
`apps/portal/src/components/tickets/ticket-chat-card.tsx`'s message-list-
plus-composer layout:

- On mount, if no session id is stored yet (component-local state, no
  persistence beyond the mounted page — starting a fresh session per
  visit is an explicit, acceptable Foundation-phase simplification), call
  `useStartChatSessionMutation` once.
- Render `useChatMessagesQuery(sessionId)`'s list (customer messages
  right-aligned, assistant left-aligned — mirrors `TicketChatCard`'s
  `isMine` styling, simplified to a fixed two-party layout).
- Composer submits via `useSendChatMessageMutation`, tracks the returned
  `{ id, outcome: PENDING }`, and shows a "typing…" indicator while
  `useChatAiResultQuery(sessionId, logId)` is `PENDING`; on `SUCCESS` the
  reply appears via the now-refetched message list (not by rendering
  `outputText` directly, unlike `TicketAiCard` — the message list is the
  single source of truth for chat history); on `ERROR` renders an inline
  `Alert variant="destructive"`; on `DISABLED` renders a distinct, neutral
  "AI chat isn't available right now" state.

**New route: `apps/portal/src/app/[locale]/chat/page.tsx`** (mirrors the
existing `[locale]/knowledge-base/page.tsx` shape) rendering
`<ChatWidget />`, plus a nav-link entry alongside the existing
`knowledge-base`/`tickets` links in the portal's shared nav component and
new `en`/`ar` i18n keys under a new `chat.*` namespace in
`apps/portal/messages/{en,ar}.json`.

---

## Edge Cases & Failure Modes

- **A second message sent while the first is still PENDING:** each has
  its own `AiPromptLog.id`/query key — no collision, mirrors Story 79's
  own "two operations back-to-back" case. The widget only tracks the
  single most-recently-sent message's `logId` for the typing indicator;
  an earlier PENDING result is simply superseded in the UI, not lost.
- **`chatSessionId` for a session belonging to a different Contact:**
  masked as 404 by `getOwnedSession`, identical to Story 79's
  cross-ticket masking.
- **`outcome: DISABLED`** (the only outcome `NullAiProvider` actually
  produces in this environment) renders a distinct, non-error state —
  same product rule as Story 79.
- **`ERROR`/`DISABLED` turns are never added to `ChatMessage`:** the
  conversation history stays exactly the turns that actually succeeded;
  a failed turn's customer message is still visible (it was persisted
  before enqueueing), but no empty/placeholder assistant reply appears
  in the list — the failure surfaces only via the inline result-polling
  state.
- **A realtime event for a session the widget isn't currently
  mounted/joined for:** `useChatRealtime`'s `sessionId`-dependent effect
  tears down and rejoins on `sessionId` change, mirrors
  `useTicketRealtime` exactly — no cross-session leakage.
- **Agent visibility:** explicitly none. `chat-session:{id}` rejects
  `audience: "agent"` sockets outright; no `apps/web` route or component
  is touched by this story.

---

## Test Plan

1. **`apps/api/src/modules/ai/ai-gateway.service.spec.ts`** — update
   `createPendingLog` assertions for the new `chatSessionId` parameter;
   add a case asserting `ticketId: null, chatSessionId: "..."` is written
   correctly for a chat-shaped call.
2. **`apps/api/src/modules/ai/ai-chat.service.spec.ts`** (new) —
   `startSession` creates a row; `sendMessage` persists the customer
   `ChatMessage`, creates a pending log with `chatSessionId` set, and
   enqueues the job; `getMessages`/`getAiResult` cross-Contact and
   nonexistent-id 404 cases, mirroring `ticket-ai.service.spec.ts`'s
   `getAiResult` suite exactly.
3. **`apps/api/src/queues/ai-processing-events-bridge.processor.spec.ts`**
   — new case: a `CHAT`-feature job emits `ai.chat_message_completed`
   with `chatSessionId`, never `ai.prompt_completed`.
4. **`apps/worker/src/queues/ai-processing.processor.spec.ts`** — new
   `CHAT` cases: calls `provider.chat` with `{ sessionId, message }`;
   on `SUCCESS` creates a `ChatMessage(ASSISTANT)` row; on
   `ERROR`/`DISABLED` does **not** create one; hand-back payload carries
   `chatSessionId`, not `ticketId`.
5. **`apps/api/src/realtime/realtime.gateway.spec.ts`** — new
   `chat-session:{id}` authorization cases: the owning Contact succeeds;
   a different Contact is rejected; an agent-audience socket is rejected
   outright.
6. **`apps/api/src/realtime/chat-realtime.listener.spec.ts`** (new) —
   mirrors `ticket-realtime.listener.spec.ts`'s shape for one event/room.
7. **`apps/api/test/portal-chat.e2e-spec.ts`** (new) — unauthenticated
   401; an agent-audience token 401 (via `@PortalRoute()`'s existing
   `AudienceGuard`); start session → send message → PENDING; a
   SUCCESS-outcome case via direct Prisma update of the `AiPromptLog` row
   (this suite never boots `apps/worker`, mirrors `tickets.e2e-spec.ts`'s
   own documented scope boundary) confirming the `ChatMessage` list and
   `getAiResult` both reflect it; cross-Contact 404 on `getMessages`/
   `getAiResult`.
8. **`apps/portal/src/hooks/use-chat.spec.ts`**,
   **`use-chat-realtime.spec.ts`**,
   **`apps/portal/src/components/chat/chat-widget.spec.tsx`** — mirror
   the exact shapes of `apps/web`'s `use-ticket-ai.ts`/
   `use-ticket-realtime.spec.ts`/`ticket-ai-card.spec.tsx` tests.

---

## Migration / Rollback

- Purely additive: two new tables, one new nullable FK + index on
  `AiPromptLog`. No existing column altered or dropped.
- **Rollback:** drop `chat_messages`, `chat_sessions`, and
  `AiPromptLog.chat_session_id`/its index. Any chat history in-flight at
  rollback time is lost — acceptable, this is a new, standalone
  self-service feature with no other domain depending on it.
- **Half-applied state:** safe — old code never reads/writes the new
  tables/column.

---

## Verification Steps

1. `pnpm prisma generate && pnpm --filter @crm/api typecheck` (from repo
   root or `apps/api`, matching Story 79's own step).
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or, if the sandbox's
   `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` gate blocks
   `test:e2e:prepare`'s `migrate reset --force` the same way it did for
   Story 79, re-seed via `pnpm prisma:seed` and run the new
   `portal-chat.e2e-spec.ts` file in isolation instead — see Story 79's
   own completion report for the precedent and why that is a valid
   substitute here).
4. `pnpm --filter @crm/worker test`
5. `pnpm --filter @crm/portal typecheck && pnpm --filter @crm/portal lint && pnpm --filter @crm/portal test`
6. `pnpm typecheck && pnpm lint && pnpm build && pnpm test` (confirms
   `apps/web` and every other untouched package remain unaffected).

---

## Done Criteria

- [ ] `ChatSession`/`ChatMessage` models exist, plus a nullable
      `AiPromptLog.chatSessionId`, via a real Prisma migration.
- [ ] `ai-processing`'s job/processor accepts `feature: "CHAT"`, calls
      `AiProvider.chat`, and persists a `ChatMessage(ASSISTANT)` row only
      on `SUCCESS`.
- [ ] The `ai-processing-events` bridge emits a new
      `ai.chat_message_completed` event for `CHAT` jobs, leaving
      `ai.prompt_completed`/`TicketRealtimeListener` untouched.
- [ ] `chat-session:{id}` is a real, authorized realtime room
      (owning-Contact-only, agent-audience rejected).
- [ ] `POST /portal/chat/sessions`, `POST .../messages`,
      `GET .../messages`, `GET .../ai/:logId` all exist, are
      `@PortalRoute()`-gated, and mask cross-Contact access as 404.
- [ ] The portal chat widget starts a session, sends messages, and
      renders PENDING/SUCCESS/ERROR/DISABLED distinctly via realtime
      refetch.
- [ ] No `apps/web` change; no change to
      `AnthropicAiProvider`/`NullAiProvider`/`packages/ai`/provider
      selection.
- [ ] Every item in `## Test Plan` is added and passing.
- [ ] Every command in `## Verification Steps` passes (or is
      substituted per its own documented e2e fallback).
- [ ] Every pre-existing test suite remains green, unweakened.
