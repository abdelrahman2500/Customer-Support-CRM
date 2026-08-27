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
