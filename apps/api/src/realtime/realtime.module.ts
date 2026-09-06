import { Module } from "@nestjs/common";
import { AuthModule } from "../common/auth/auth.module";
import { RealtimeGateway } from "./realtime.gateway";
import { TicketRealtimeListener } from "./ticket-realtime.listener";
import { ChatRealtimeListener } from "./chat-realtime.listener";
import { BranchNotificationRealtimeListener } from "./branch-notification-realtime.listener";
import { CustomerNotificationRealtimeListener } from "./customer-notification-realtime.listener";
import { TaskRealtimeListener } from "./task-realtime.listener";
import { PresenceService } from "./presence.service";

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
 *
 * Story 71 — `PresenceService` (its own direct `ioredis` client, mirroring
 * `RedisIoAdapter`'s construction) is a plain provider `RealtimeGateway`
 * injects; no new module import needed since it reads `REDIS_URL` from the
 * already-global `ConfigModule`.
 *
 * Story 80 — `ChatRealtimeListener` registered the same way, reacting to
 * `ai.chat_message_completed` and relaying into `chat-session:{id}`
 * (`RealtimeGateway.authorizeRoom`'s own new customer-only branch) —
 * fully independent of `TicketRealtimeListener`/`ticket:{id}`.
 *
 * Story 86 — `CustomerNotificationRealtimeListener` registered the same
 * way, reacting to `ticket.updated`/`channel.message.created` and
 * relaying into `customer:{customerId}:notifications`
 * (`RealtimeGateway.authorizeRoom`'s own new customer-only branch) — the
 * Customer Portal's own mirror of `BranchNotificationRealtimeListener`,
 * fully independent of it and of `TicketRealtimeListener`/`ticket:{id}`.
 *
 * RM-03 — `TaskRealtimeListener` registered the same way, reacting to
 * `task.reminder_due` and relaying into `agent:{ownerUserId}:tasks`
 * (`RealtimeGateway.authorizeRoom`'s own new `agent:(.+):tasks` branch) —
 * fully independent of every other listener here.
 */
@Module({
  imports: [AuthModule],
  providers: [
    RealtimeGateway,
    TicketRealtimeListener,
    ChatRealtimeListener,
    BranchNotificationRealtimeListener,
    CustomerNotificationRealtimeListener,
    TaskRealtimeListener,
    PresenceService,
  ],
})
export class RealtimeModule {}
