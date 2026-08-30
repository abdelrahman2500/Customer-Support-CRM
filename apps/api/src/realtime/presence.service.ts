import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";
import type { EnvConfig } from "../common/config/env.validation";

/**
 * Story 71 — Agent Presence. Tracks each agent's live socket connections
 * in Redis (a Set of socket ids per user — `SADD`/`SREM`/`SCARD`), not a
 * plain counter: multiple simultaneous connections (tabs/devices) must not
 * each independently flip presence, and a Set survives an out-of-order
 * disconnect/reconnect pair without ever going negative the way a naive
 * counter could. Only the *first* connection and the *last* disconnection
 * are real state transitions — `recordConnect`/`recordDisconnect` report
 * exactly that, nothing more.
 *
 * Reuses the same `REDIS_URL` every other Redis consumer in this codebase
 * already uses (`RedisIoAdapter`, BullMQ) — no new external dependency,
 * mirrors `RedisIoAdapter`'s own direct `ioredis` client construction
 * exactly.
 *
 * Known, disclosed limitation (not silently accepted): an ungracefully-
 * killed API process leaves its sockets' ids in Redis with no expiry,
 * which could show an agent as "online" after their process actually
 * died. A heartbeat/TTL reconciliation mechanism would fix this but is a
 * separate, larger mechanism this foundation slice does not build — the
 * same "foundation first, defer the harder infrastructure until measured
 * need" restraint this codebase already applies elsewhere (e.g.
 * Reporting's "direct queries before materialized views"). A *graceful*
 * shutdown (`app.close()`) is still handled correctly, see below.
 *
 * Quits Redis in `onApplicationShutdown`, not `onModuleDestroy` — Nest's
 * documented lifecycle runs every provider's `onModuleDestroy` to
 * completion before any provider's `onApplicationShutdown` starts, so
 * `RealtimeGateway`'s own `onModuleDestroy` (which explicitly records a
 * disconnect for every still-open socket before returning) is guaranteed
 * to finish writing to Redis before this closes the connection. Without
 * this ordering, a socket disconnecting during shutdown could race the
 * connection close and permanently leave a stale "online" entry behind —
 * caught during this Story's own e2e verification against real Redis.
 */
@Injectable()
export class PresenceService implements OnApplicationShutdown {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis: Redis;

  constructor(configService: ConfigService<EnvConfig, true>) {
    this.redis = new Redis(configService.get("REDIS_URL", { infer: true }));
    // A persistent listener is required — an ioredis client's unhandled
    // "error" event otherwise crashes the process (Node's special-cased
    // EventEmitter behavior), mirroring `RedisIoAdapter`'s own defensive
    // listener on its pub/sub clients.
    this.redis.on("error", (error) => this.logger.error("Redis connection error", error));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }

  private key(userId: string): string {
    return `presence:${userId}`;
  }

  /** Returns `true` only when this is the user's *first* live connection
   * (a real online transition, not just another tab/device). */
  async recordConnect(userId: string, socketId: string): Promise<boolean> {
    const before = await this.redis.scard(this.key(userId));
    await this.redis.sadd(this.key(userId), socketId);
    return before === 0;
  }

  /** Returns `true` only when this was the user's *last* live connection
   * (a real offline transition). */
  async recordDisconnect(userId: string, socketId: string): Promise<boolean> {
    await this.redis.srem(this.key(userId), socketId);
    const after = await this.redis.scard(this.key(userId));
    return after === 0;
  }

  async isOnline(userId: string): Promise<boolean> {
    return (await this.redis.scard(this.key(userId))) > 0;
  }
}
