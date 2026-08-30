import { Module } from "@nestjs/common";
import { AuthModule } from "../common/auth/auth.module";
import { RealtimeGateway } from "./realtime.gateway";
import { TicketRealtimeListener } from "./ticket-realtime.listener";
import { BranchNotificationRealtimeListener } from "./branch-notification-realtime.listener";
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
 */
@Module({
  imports: [AuthModule],
  providers: [
    RealtimeGateway,
    TicketRealtimeListener,
    BranchNotificationRealtimeListener,
    PresenceService,
  ],
})
export class RealtimeModule {}
