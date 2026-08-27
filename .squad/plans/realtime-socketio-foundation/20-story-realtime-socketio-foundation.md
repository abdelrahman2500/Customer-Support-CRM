# Story 20 — Realtime / Socket.IO Foundation

## Prerequisites

- `ticket-recategorization-sla-target-recomputation` Story 16 and `sla-breach-escalation` Story 17 completed: `TICKET_UPDATED_EVENT`/`TicketUpdatedEvent` and `TICKET_ESCALATED_EVENT`/`TicketEscalatedEvent` (both `apps/api/src/modules/tickets/tickets.events.ts`) are the two existing domain events this story relays — neither event, nor either's emitter (`TicketsService.updateTicket`; `TicketEscalationListener.onSlaEscalated`), is modified.
- `ticket-escalation-notification-reaction` Story 19 completed and committed (`36d12c4`) — confirmed via this session's own prior recon that the domain-event graph currently has no dead-end event; this story's justification is therefore the documented real-time architecture itself (docs/architecture/06-communication-and-realtime.md, "Real-time communication"), not an unconsumed event.
- The intake this plan was generated from (`.squad/stories/realtime-socketio-foundation/realtime-socketio-foundation/intake.md`) explicitly delegates to this planning pass the decision of whether this foundation is boundable without a blocking product decision. That determination and its reasoning are recorded in **Design**, items 7 and 8, below — verified against the real codebase, not assumed.

---

## Story Goal

Stand up the first Socket.IO transport in `apps/api`: a dedicated gateway that (1) rejects any connection that does not carry a valid, `agent`-audience JWT access token, (2) establishes a per-socket tenant context (`userId`/`branchId`/`departmentId`/`roles`) from that token without bypassing tenant isolation, (3) implements the architecture's exact three-room subscription model (`ticket:{id}`, `branch:{id}:notifications`, `agent:{id}:presence`) with authorization-aware room joins that deny cross-tenant/branch access and any unrecognized room shape by default, and (4) relays exactly two already-existing domain events — `ticket.updated` and `ticket.escalated` — into the `ticket:{id}` room via the existing `EventEmitter2` bus, proving the transport works end-to-end without inventing new domain events or touching existing emitters.

**Not in scope** (per the intake's explicit "Out of scope" list, reaffirmed here after discovery): notification recipient/preference/template/delivery/provider logic; live chat; the `channels`/`integration-sync`/`ai-processing`/`reports-refresh` queues; any Customer Portal or Agent Workspace UI; any new BullMQ queue or `apps/worker` change; any new domain event; any `AutomationRule`/workflow-engine behavior; any change to Stories 16–19's own code or behavior; any DB migration (no persistent realtime state is needed — room membership is transient, in-memory/Redis-adapter-managed Socket.IO state, not application data).

---

## Context — Read These Files First

1. `docs/architecture/06-communication-and-realtime.md` lines 13–18 ("Real-time communication") — the four sentences this entire story implements: "NestJS exposes a Socket.IO gateway with the Redis adapter for horizontal scaling"; "The socket handshake carries the REST JWT and unauthenticated sockets are rejected"; "Rooms include `ticket:{id}`, `branch:{id}:notifications`, and `agent:{id}:presence`"; "Real-time supports live chat, ticket timeline updates, in-app notifications, and agent presence" — this story implements the transport only; live chat/notifications/presence *content* are explicitly future stories' work (Design item 4).
2. `apps/api/src/common/tenant/tenant.middleware.ts` (58 lines, read in full) — the exact reuse precedent: `this.jwtService.verify<JwtAccessTokenClaims>(token, { secret: this.configService.get("JWT_ACCESS_SECRET", { infer: true }) })` (lines 34–36), called manually, outside the Guard/Passport pipeline, because Express middleware/a non-HTTP-Guard context needs the claims before any Guard runs. This story's gateway calls the identical `JwtService.verify()` shape from inside `handleConnection`, the direct Socket.IO analogue of "before any Guard runs" (Design item 1).
3. `apps/api/src/common/auth/jwt.strategy.ts` (31 lines, read in full) — `validate()` (lines 24–27) rejects any token whose `audience !== "agent"`. This story's gateway applies the identical audience check for the identical reason: only `agent`-issued tokens exist today (`packages/shared/src/jwt.ts` lines 8–19, `JwtAccessTokenClaims`); customer-portal auth is a future story.
4. `apps/api/src/common/tenant/tenant-context.ts` (65 lines, read in full) — `TenantClaims` (lines 13–18: `userId`, `branchId`, `departmentId`, `roles`). This story's per-socket claims object reuses this exact shape (Design item 2) rather than inventing a parallel one — but is **not** `TenantContext` itself, since `TenantContext` is `@Injectable({ scope: Scope.REQUEST })` (line 27) bound to Express's per-HTTP-request `REQUEST` token, which does not exist for a long-lived Socket.IO connection (Design item 2).
5. `apps/api/src/common/auth/auth.module.ts` (30 lines, read in full) — exports `JwtModule`/`PassportModule` (line 28) but is **not** `@Global()`; a module other than `AppModule` must `imports: [AuthModule]` itself to inject `JwtService`. This story's new `RealtimeModule` does so (Task 2).
6. `apps/api/src/prisma/prisma.module.ts` (14 lines, read in full) — `@Global()` (line 9): `PrismaService` needs no explicit import in `RealtimeModule`.
7. `apps/api/src/modules/tickets/tickets.events.ts` (46 lines, read in full) — `TICKET_UPDATED_EVENT` (line 4)/`TicketUpdatedEvent` (lines 13–16) and `TICKET_ESCALATED_EVENT` (line 33)/`TicketEscalatedEvent` (lines 43–46). Both share the identical payload shape `{ ticket: TicketSummary; actorUserId: string | null }`. `TicketSummary` (`tickets.service.ts` lines 11–21) has no `branchId` field — this story's relay listener broadcasts the event payload verbatim (no new DTO), and separately re-derives the ticket's `branchId` only where authorization needs it (Task 4, room-join check), never for the broadcast payload itself.
8. `apps/api/src/modules/tickets/ticket-escalation.listener.ts` (57 lines, read in full) — the precedent this story's own relay listener structurally mirrors: `@Injectable()`, constructor-injects what it needs, one `@OnEvent(...)` handler per subscribed event, try/catch with `Logger.error` on failure, never rethrows. Not modified by this story.
9. `apps/api/src/app.module.ts` (54 lines, read in full) — current `imports` array ends with `NotificationsModule` (line 21); this story appends `RealtimeModule` (Task 2). `EventEmitterModule.forRoot()` (line 24) is already global — this story's new listener needs no further wiring for `@OnEvent` to work.
10. `apps/api/src/main.ts` (42 lines, read in full) — plain `NestFactory.create(AppModule)` (line 11), no CORS configuration anywhere in the file or in `apps/api/src/common/config/env.validation.ts` (40 lines, read in full — confirmed no CORS/origin env var exists at all). This story does not introduce one (Design item 6).
11. `apps/api/package.json` (read in full) — confirms **no** Socket.IO/WebSocket package is installed today; confirms current compatible NestJS-family versions (`@nestjs/common`/`@nestjs/core` `^11.2.1`, `@nestjs/config` `^4.0.4`, `@nestjs/event-emitter` `^3.1.0`, `@nestjs/jwt` `^11.0.2`); confirms `ioredis` `^6.0.0` is already a dependency (this story's Redis adapter reuses it — Design item 5 — rather than adding a second Redis client library).
12. `apps/api/test/sla-timers-producer.e2e-spec.ts` (58 lines, read in full) — the established "no-HTTP e2e" pattern (resolve providers from a compiled `TestingModule`) **and**, more specifically, its two-real-`TestingModule`-instances-against-one-real-Redis structure (lines 44–57): the closest existing precedent in this codebase for proving Redis-mediated behavior across more than one process/instance. This story's Redis-adapter e2e scenario (Test Plan item 3) follows that same two-instance-against-real-Redis shape.
13. `apps/api/test/ticket-escalation-notification.e2e-spec.ts` (139 lines, read in full) — the pattern for authenticating via the real `/api/v1/auth/login` HTTP endpoint inside an e2e suite (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) and creating a real ticket via the real HTTP API before exercising the behavior under test. This story's e2e suite reuses this login-and-create-ticket setup, but (unlike every prior e2e suite in this codebase) must additionally call `app.listen(0)` for a real bound port, since `socket.io-client` needs a live TCP connection — no prior e2e suite in this codebase has needed this (Design item 3).

---

## Design (resolved during this planning pass, per the intake's explicit delegation)

1. **Auth reuse mechanism: manual `JwtService.verify()` inside `handleConnection`, not `AuthGuard`.** `AuthGuard` (`apps/api/src/common/auth/auth.guard.ts`) extends `PassportAuthGuard("jwt")`, whose underlying `JwtStrategy` is wired for an HTTP `ExecutionContext` (`ExtractJwt.fromAuthHeaderAsBearerToken()` reads an HTTP request's `Authorization` header). Retrofitting it for a Socket.IO handshake would mean either inventing a second Passport strategy or hand-rolling a WS-shaped `ExecutionContext` — both heavier than necessary. `TenantMiddleware`'s manual-`JwtService.verify()` pattern (Context item 2) is the already-established "verify a token outside the Guard pipeline" precedent this codebase uses for exactly this kind of non-HTTP-Guard situation, so this story reuses it verbatim rather than inventing a third auth mechanism.
2. **No new request-scoped context service.** `TenantContext` is bound to Express's per-HTTP-request `REQUEST` token (Context item 4) and does not exist for a Socket.IO connection, which is neither a single HTTP request nor short-lived. This story stores the verified claims directly on `client.data.claims` (Socket.IO's own standard per-connection data bag, typed via a local `RealtimeSocketData` interface with a `claims: TenantClaims` field, reusing `TenantContext`'s exact `TenantClaims` shape) rather than inventing a parallel `RealtimeContext` provider — every claim access this story needs is scoped to the single already-connected `Socket`, and DI request-scoping solves a different problem (per-HTTP-request instantiation) than this story has.
3. **e2e harness: `app.listen(0)`, then a real `socket.io-client`.** No `moduleRef.get(Provider)`-only e2e pattern can prove a Socket.IO connection actually authenticates/authorizes/receives an event — that requires a live TCP socket. `app.listen(0)` (ephemeral port) plus `app.getHttpServer().address().port` gives a real, isolated port per test run, avoiding a hardcoded port collision.
4. **Scope boundary: transport only, not live chat/notification/presence content.** The architecture paragraph (Context item 1) names four capabilities the rooms will eventually "support"; this story's Done Criteria is that the rooms exist, are authorization-correct, and carry two already-real events end-to-end — proving the pipe works. Building the live-chat message flow, the in-app notification delivery UI, or a presence-tracking feature is explicitly future-story work per the intake's own "Out of scope" list.
5. **Redis adapter: `@socket.io/redis-adapter` over two new dedicated `ioredis` connections, both built from the already-configured `REDIS_URL`.** The architecture sentence "NestJS exposes a Socket.IO gateway with the Redis adapter for horizontal scaling" (Context item 1) makes this a proven requirement, not an invented one. `ioredis` is already a dependency (Context item 11) — this story creates two new `Redis` client instances (a pub client and, per `@socket.io/redis-adapter`'s own documented requirement, a duplicated sub client) off the same `REDIS_URL` env var every other Redis consumer in this codebase already uses (`apps/worker`'s BullMQ connection, `apps/api/src/queues/*`) — no second Redis instance, URL, or config surface is introduced.
6. **No CORS configuration.** No CORS/origin env var or `main.ts` CORS setup exists anywhere in this codebase today (Context item 10) — the REST API has apparently not needed one. This story's own e2e client is a Node-based `socket.io-client` (Design item 3), which is not subject to browser CORS at all, so omitting CORS configuration does not block this story's own verification. Configuring CORS would require inventing an allowed-origins policy (which domains? which env var name? environment-specific values?) that nothing in the architecture docs, existing env schema, or this intake specifies — exactly the kind of invented product decision the intake instructs this plan not to make. This is recorded as a deliberate, explicit boundary (also listed under Edge Cases): a real browser-based client (Customer Portal, Agent Workspace) connecting to this gateway cross-origin is a future story's concern, to be resolved when that client's actual origin(s) are known.
7. **Room shape: exact regex match against the architecture's three named patterns, deny-by-default otherwise.** `ticket:{id}` → the ticket's real `branchId` (looked up via `prisma.ticket.findUnique({ where: { id }, select: { branchId: true } })`, mirroring the minimal-`select` convention `TicketEscalationListener` already uses) must equal the caller's own `branchId` claim; a nonexistent ticket or branch mismatch is denied identically (no distinguishing error detail leaked — Design item 9). `branch:{id}:notifications` → the id must equal the caller's own `branchId` claim (pure claims comparison, no Prisma read needed). `agent:{id}:presence` → the id must equal the caller's own `userId` claim (an agent may only subscribe to their own presence room; there is no cross-agent presence-room use case in the architecture text to justify anything broader). Any room string not matching one of these three shapes is denied — this is the "no product decision needed" case: the architecture enumerates exactly these three rooms, so there is nothing to invent.
8. **This foundation IS boundable without a blocking product decision.** Every acceptance criterion in the intake maps onto architecture text that already exists and is unambiguous (Context item 1) or onto an already-established codebase precedent (Design items 1–2, 5). The one genuinely underspecified area — cross-origin browser access — is resolved by explicitly declining to build it now (Design item 6) rather than by inventing a policy, and is called out as a boundary rather than silently omitted. No other ambiguity was found that requires stopping this plan short.
9. **No leaked details on rejection.** An unauthenticated/invalid-token connection is closed via `client.disconnect(true)` with no custom payload describing why (expired vs. malformed vs. wrong-audience are all indistinguishable to the client). A denied room join acks `{ ok: false }` with no `reason` field (nonexistent ticket vs. wrong branch vs. unrecognized room shape are all indistinguishable to the client) — mirroring this codebase's existing convention of never surfacing internal/tenant details in a client-facing response (e.g., `TicketsService`'s existing not-found-vs-wrong-branch responses already collapse to the same generic outcome).
10. **Relay exactly `ticket.updated` and `ticket.escalated`, not `ticket.created` or `ticket.recategorized`.** `ticket.created` is unreachable for this room model — no client can have already joined `ticket:{id}` before that ticket exists. `ticket.recategorized` is always emitted alongside `ticket.updated` in the same `TicketsService.updateTicket` call (Story 16) with an identical payload shape, so relaying `ticket.updated` already delivers the post-recategorization ticket state; relaying both would be a redundant duplicate message for every recategorization. Both broadcast under a Socket.IO event name identical to the domain event's own constant value (`"ticket.updated"`/`"ticket.escalated"`) — no new naming invented — with the domain event's own payload relayed verbatim, no new DTO.

---

## Implementation Tasks

### 1 — Install dependencies

```bash
pnpm --filter @crm/api add @nestjs/websockets @nestjs/platform-socket.io socket.io @socket.io/redis-adapter
pnpm --filter @crm/api add -D socket.io-client
```

`@nestjs/websockets`/`@nestjs/platform-socket.io` must resolve within the `11.x` line already used by every other `@nestjs/*` package in `apps/api/package.json` (Context item 11) — record the actually-resolved versions in the Verification Steps checklist; do not hand-edit `package.json` version ranges.

### 2 — `RealtimeModule`

Create file: `apps/api/src/realtime/realtime.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { AuthModule } from "../common/auth/auth.module";
import { RealtimeGateway } from "./realtime.gateway";
import { TicketRealtimeListener } from "./ticket-realtime.listener";

/**
 * Cross-cutting real-time transport infrastructure — see
 * docs/architecture/06-communication-and-realtime.md ("Real-time
 * communication"). Sits alongside `QueuesModule` at `apps/api/src/realtime/`
 * rather than under `modules/`: this is transport plumbing, not an owned
 * Postgres schema/bounded context. Imports `AuthModule` explicitly (it is
 * not `@Global()`) to inject `JwtService` for handshake verification;
 * `PrismaService` needs no import (`PrismaModule` is `@Global()`).
 * `TicketRealtimeListener`'s `@OnEvent` handlers are discovered
 * automatically once instantiated as a provider here, the same convention
 * every other domain-event listener in this codebase already relies on.
 */
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, TicketRealtimeListener],
})
export class RealtimeModule {}
```

Register in `apps/api/src/app.module.ts`: add `import { RealtimeModule } from "./realtime/realtime.module";` alongside the other feature-module imports, and append `RealtimeModule` to the `imports` array (after `NotificationsModule`, current line 21).

### 3 — `RedisIoAdapter`

Create file: `apps/api/src/realtime/redis-io.adapter.ts`

```typescript
import { INestApplicationContext, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import type { ServerOptions } from "socket.io";
import type { EnvConfig } from "../common/config/env.validation";

/**
 * Wires the Socket.IO Redis adapter for horizontal scaling, per
 * docs/architecture/06-communication-and-realtime.md line 15. Reuses the
 * same `REDIS_URL` every other Redis consumer in this codebase already uses
 * (`apps/worker`'s BullMQ connection, `apps/api/src/queues/*`) — no second
 * Redis instance or config surface. `@socket.io/redis-adapter` requires two
 * distinct connections (a pub client and a duplicated sub client), per its
 * own documented contract.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const config = this.app.get(ConfigService<EnvConfig, true>);
    const redisUrl = config.get("REDIS_URL", { infer: true });

    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        pubClient.once("ready", resolve);
        pubClient.once("error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        subClient.once("ready", resolve);
        subClient.once("error", reject);
      }),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log("Socket.IO Redis adapter connected");
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
```

### 4 — `RealtimeGateway`

Create file: `apps/api/src/realtime/realtime.gateway.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { TenantClaims } from "../common/tenant/tenant-context";
import type { EnvConfig } from "../common/config/env.validation";

/** Per-socket data bag — the Socket.IO analogue of `TenantContext`'s claims. */
export interface RealtimeSocketData {
  claims: TenantClaims;
}

/**
 * Reuses `JwtService.verify()` exactly like `TenantMiddleware`
 * (see docs comment there) — Design item 1. No CORS is configured — Design
 * item 6. Default namespace (`/`); no architecture text specifies a
 * dedicated one.
 */
@Injectable()
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }

    let claims: JwtAccessTokenClaims;
    try {
      claims = this.jwtService.verify<JwtAccessTokenClaims>(token, {
        secret: this.configService.get("JWT_ACCESS_SECRET", { infer: true }),
      });
    } catch {
      client.disconnect(true);
      return;
    }

    if (claims.audience !== "agent") {
      client.disconnect(true);
      return;
    }

    (client.data as RealtimeSocketData).claims = {
      userId: claims.sub,
      branchId: claims.branchId,
      departmentId: claims.departmentId,
      roles: claims.roles,
    };
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage("join")
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room?: unknown },
  ): Promise<{ ok: boolean }> {
    const claims = (client.data as Partial<RealtimeSocketData>).claims;
    const room = typeof body?.room === "string" ? body.room : undefined;
    if (!claims || !room || !(await this.authorizeRoom(claims, room))) {
      return { ok: false };
    }
    await client.join(room);
    return { ok: true };
  }

  private async authorizeRoom(claims: TenantClaims, room: string): Promise<boolean> {
    const ticketMatch = /^ticket:(.+)$/.exec(room);
    if (ticketMatch) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketMatch[1] },
        select: { branchId: true },
      });
      return ticket !== null && ticket.branchId === claims.branchId;
    }

    const branchMatch = /^branch:(.+):notifications$/.exec(room);
    if (branchMatch) {
      return claims.branchId !== null && branchMatch[1] === claims.branchId;
    }

    const presenceMatch = /^agent:(.+):presence$/.exec(room);
    if (presenceMatch) {
      return presenceMatch[1] === claims.userId;
    }

    return false;
  }
}
```

### 5 — `TicketRealtimeListener`

Create file: `apps/api/src/realtime/ticket-realtime.listener.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RealtimeGateway } from "./realtime.gateway";
import { TICKET_UPDATED_EVENT, TICKET_ESCALATED_EVENT } from "../modules/tickets/tickets.events";
import type { TicketUpdatedEvent, TicketEscalatedEvent } from "../modules/tickets/tickets.events";

/**
 * Relays exactly two already-existing domain events into the `ticket:{id}`
 * room — Design item 10. Broadcasts the domain event's own payload
 * verbatim, no new DTO. Neither `TicketsService` nor
 * `TicketEscalationListener` is modified — this listener only subscribes.
 * Structurally mirrors `TicketEscalationListener` (Context item 8):
 * `@Injectable()`, one `@OnEvent` handler per event, try/catch,
 * `Logger.error` on failure, never rethrows.
 */
@Injectable()
export class TicketRealtimeListener {
  private readonly logger = new Logger(TicketRealtimeListener.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(TICKET_UPDATED_EVENT)
  onTicketUpdated(event: TicketUpdatedEvent): void {
    this.relay(TICKET_UPDATED_EVENT, event.ticket.id, event);
  }

  @OnEvent(TICKET_ESCALATED_EVENT)
  onTicketEscalated(event: TicketEscalatedEvent): void {
    this.relay(TICKET_ESCALATED_EVENT, event.ticket.id, event);
  }

  private relay(eventName: string, ticketId: string, payload: unknown): void {
    try {
      this.gateway.server.to(`ticket:${ticketId}`).emit(eventName, payload);
    } catch (error) {
      this.logger.error(`Failed to relay ${eventName} for ticket ${ticketId}`, error as Error);
    }
  }
}
```

### 6 — Wire the Redis adapter into bootstrap

File: `apps/api/src/main.ts`

Add, after `const app = await NestFactory.create(AppModule);` (current line 11) and before `app.listen(port)` (current line 38):

```typescript
import { RedisIoAdapter } from "./realtime/redis-io.adapter";
// ...
const redisIoAdapter = new RedisIoAdapter(app);
await redisIoAdapter.connectToRedis();
app.useWebSocketAdapter(redisIoAdapter);
```

### 7 — Unit specs

Create `apps/api/src/realtime/realtime.gateway.spec.ts` and `apps/api/src/realtime/ticket-realtime.listener.spec.ts`, hand-built mocks in this codebase's own established style (e.g. `sla-at-risk-notification.listener.spec.ts`, `ticket-escalation.listener.spec.ts`). Cover: valid/expired/malformed/wrong-audience token handling in `handleConnection`; each of the three room-authorization branches (allow/deny) plus the deny-by-default unknown-room-shape case; the relay listener calling `server.to(room).emit(...)` with the exact room name and unmodified payload for both events; the relay listener catching (not rethrowing) an error from `server.to(...).emit(...)`.

### 8 — Integration/e2e specs

Create `apps/api/test/realtime-socketio-foundation.e2e-spec.ts` per Test Plan below.

---

## Edge Cases & Failure Modes

- **Connection with no token, an expired token, a malformed token, or a `customer`-audience token:** `handleConnection` disconnects the socket (`client.disconnect(true)`) with no distinguishing error payload — the client cannot tell which of these four occurred (Design item 9). Note the socket object briefly exists before being torn down (Design item 1's own documented nuance) — no room is ever joined and no data is ever emitted to or accepted from it in that window, so this is behaviorally equivalent to rejection for every acceptance criterion this story is scored against.
- **A `join` request for a room the caller is not authorized for** (wrong branch, nonexistent ticket, another agent's presence room, or an unrecognized room-string shape): acked `{ ok: false }`, no distinguishing reason (Design item 9), socket stays connected (a client may legitimately retry a different room), no disconnect.
- **A `join` request before `handleConnection` has set `client.data.claims`** (should not be reachable in practice — Socket.IO delivers `connection` before any client-sent message — but defended against anyway, matching this codebase's own "never rely solely on an upstream guarantee" convention, e.g. `TicketEscalatedNotificationListener`'s P2002 defense): denied, same as any other unauthorized join.
- **`ticket.updated`/`ticket.escalated` fires with no socket currently joined to that `ticket:{id}` room:** `server.to(room).emit(...)` on an empty room is a documented Socket.IO no-op — no error, no queued delivery, no listener-side change needed.
- **Redis becomes unavailable after boot:** `@socket.io/redis-adapter`'s own reconnection behavior applies (unchanged, standard library behavior); this story does not add custom reconnection/circuit-breaking logic beyond what the adapter already provides, matching Story 14/15's own precedent of trusting BullMQ's/ioredis's built-in reconnection rather than hand-rolling one.
- **Cross-origin browser clients:** explicitly not supported by this story (Design item 6) — no CORS is configured. A future story integrating a real browser client (Customer Portal, Agent Workspace) must resolve an allowed-origins policy first; this is called out here as a known, deliberate boundary, not a defect.
- **`ticket.recategorized`/`ticket.created`:** deliberately not relayed (Design item 10) — not a gap, a considered exclusion.

---

## Test Plan

1. **Unit — `apps/api/src/realtime/realtime.gateway.spec.ts` (new):** hand-built `JwtService`/`ConfigService`/`PrismaService` mocks. Cover `handleConnection`'s four rejection paths (missing/invalid/expired/wrong-audience token) each disconnecting the socket; a valid `agent`-audience token populating `client.data.claims` with the correct shape; each `authorizeRoom` branch (ticket room allowed when branch matches, denied when it doesn't or the ticket doesn't exist; branch-notifications room allowed only for the caller's own branch; presence room allowed only for the caller's own id; an unrecognized room string denied).
2. **Unit — `apps/api/src/realtime/ticket-realtime.listener.spec.ts` (new):** hand-built `RealtimeGateway`/`Server` mock. Cover `ticket.updated` and `ticket.escalated` each calling `server.to("ticket:<id>").emit(<eventName>, <payload>)` with the exact unmodified event payload; a thrown error from `emit` caught and logged, never rethrown.
3. **Integration — `apps/api/test/realtime-socketio-foundation.e2e-spec.ts` (new):** real `AppModule`, real Postgres/Redis, `app.listen(0)` for a live port (Design item 3), a real `socket.io-client` connecting with `auth: { token }`. Scenarios: (a) a connection with no token is disconnected before any `join` ack is possible; (b) a connection with a valid admin token, joining `ticket:{id}` for a ticket in the caller's own branch, is acked `{ ok: true }`, and receiving a real `ticket.updated` emitted via `moduleRef.get(EventEmitter2).emit(TICKET_UPDATED_EVENT, ...)` for that same ticket id; (c) joining a room for a ticket that does not exist is acked `{ ok: false }`; (d) — the Redis-adapter cross-instance proof, following `sla-timers-producer.e2e-spec.ts`'s own two-real-instance-against-real-Redis shape (Context item 12) — boot two separate `AppModule` instances, each with `RedisIoAdapter` wired to the same real Redis, connect a `socket.io-client` to instance A and join `ticket:{id}`, emit `TICKET_ESCALATED_EVENT` on instance B's `EventEmitter2`, and assert the client connected to instance A receives it — proving the adapter actually fans events out across instances, not just within one process's in-memory rooms.
4. **Regression — no changes, re-run only:** the full existing `apps/api` unit + e2e suite, in particular `sla-breach-escalation.e2e-spec.ts`, `sla-at-risk-notification.e2e-spec.ts`, and `ticket-escalation-notification.e2e-spec.ts` (Stories 17–19 must remain byte-for-byte unaffected), and `apps/worker`'s own suites (untouched by this story).

---

## Migration / Rollback

None. No Prisma schema change, no new table, no new column. Room membership and per-socket claims are transient, in-process/Redis-adapter-managed Socket.IO state — nothing persisted to Postgres. Rollback is: revert the code changes (`git revert`/`git checkout`), remove the four new npm dependencies, no data cleanup of any kind is needed.

---

## Verification Steps

1. **Backend builds:** `pnpm --filter @crm/api typecheck`, `lint`, `build`.
2. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` at the repository root.
3. **Unit tests:** `pnpm --filter @crm/api test`.
4. **Live infra:** `docker compose up -d postgres redis` (temporary `5433` fallback if the native PostgreSQL service is again occupying `5432` — revert immediately after, exactly as prior stories did).
5. **Integration tests:** `pnpm --filter @crm/api test:e2e`. Run at least twice to confirm no flakiness from the socket-connection/event-relay timing.
6. **Regression:** confirm the full existing `apps/api` unit + e2e suite is otherwise unaffected, in particular every Story 16–19 suite, and that `apps/worker`'s own unit/e2e suites (untouched by this story) still pass.
7. **Hygiene:** `git status`; confirm `.squad/config.yaml` has an empty diff; confirm `apps/worker/**`, `apps/api/src/queues/**`, `apps/api/src/modules/tickets/tickets.service.ts`, `apps/api/src/modules/tickets/tickets.events.ts`, `apps/api/src/modules/tickets/ticket-escalation.listener.ts`, and every Notifications-domain listener all have empty diffs; record the actually-installed versions of `@nestjs/websockets`/`@nestjs/platform-socket.io`/`socket.io`/`@socket.io/redis-adapter`/`socket.io-client` from the updated `package.json`/lockfile.
8. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] A dedicated `RealtimeModule`/`RealtimeGateway` exists at `apps/api/src/realtime/`, registered in `AppModule`.
- [ ] A connection with no token, an invalid/expired token, or a non-`agent`-audience token is disconnected before any room join or event delivery is possible.
- [ ] A connection with a valid `agent`-audience token establishes per-socket `userId`/`branchId`/`departmentId`/`roles` context via the existing `JwtService`/`JwtAccessTokenClaims` primitives — no parallel JWT implementation.
- [ ] Exactly the three architecture-defined room shapes (`ticket:{id}`, `branch:{id}:notifications`, `agent:{id}:presence`) are supported; every other room string is denied by default.
- [ ] Room joins are authorization-aware: a caller cannot join a `ticket:{id}` room for a ticket outside their own branch, a `branch:{id}:notifications` room for another branch, or an `agent:{id}:presence` room for another agent.
- [ ] `ticket.updated` and `ticket.escalated` (both pre-existing, unmodified) are relayed into `ticket:{id}` via the existing `EventEmitter2` bus, with no new domain event introduced and no existing emitter modified.
- [ ] The Redis adapter (`@socket.io/redis-adapter`) is wired using the existing `REDIS_URL` and existing `ioredis` dependency — no second Redis instance or config surface — and is proven, via a real two-instance e2e scenario, to fan events out across instances.
- [ ] No disconnect or room-join-denial response leaks auth/tenant/internal details.
- [ ] No new HTTP endpoint, no new BullMQ queue, no `apps/worker` change, no DB migration, no Notifications-domain change, no Customer Portal/Agent Workspace UI change.
- [ ] Stories 16–19's own emitters, listeners, and behavior are byte-for-byte unchanged.
- [ ] Unit and integration/e2e tests exist and pass per the Test Plan above.
- [ ] `.squad/config.yaml` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (every prior story through Story 19) still passes with no regressions.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
