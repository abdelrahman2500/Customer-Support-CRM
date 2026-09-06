import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { PresenceService } from "./presence.service";
import type { EnvConfig } from "../common/config/env.validation";

const redisInstances: Array<{
  scard: ReturnType<typeof vi.fn>;
  sadd: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
  sismember: ReturnType<typeof vi.fn>;
  smembers: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(function RedisMock(this: Record<string, unknown>) {
    const instance = {
      scard: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
      sismember: vi.fn(),
      smembers: vi.fn(),
      exists: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      expire: vi.fn(),
      quit: vi.fn(),
      on: vi.fn(),
    };
    Object.assign(this, instance);
    redisInstances.push(instance);
  }),
}));

function buildConfigServiceMock() {
  return { get: vi.fn().mockReturnValue("redis://localhost:6379") };
}

describe("PresenceService construction", () => {
  it("registers a persistent error listener (an unhandled ioredis 'error' event otherwise crashes the process)", () => {
    const config = buildConfigServiceMock();
    new PresenceService(config as unknown as ConfigService<EnvConfig, true>);

    expect(redisInstances[redisInstances.length - 1]?.on).toHaveBeenCalledWith(
      "error",
      expect.any(Function),
    );
  });
});

describe("PresenceService", () => {
  let config: ReturnType<typeof buildConfigServiceMock>;
  let service: PresenceService;
  let redis: (typeof redisInstances)[number];

  beforeEach(() => {
    vi.clearAllMocks();
    redisInstances.length = 0;
    config = buildConfigServiceMock();
    service = new PresenceService(config as unknown as ConfigService<EnvConfig, true>);
    redis = redisInstances[0] as (typeof redisInstances)[number];
  });

  describe("recordConnect", () => {
    it("returns true (a real online transition) when this is the user's first connection", async () => {
      redis.sismember.mockResolvedValue(0);
      redis.sadd.mockResolvedValue(1);
      redis.set.mockResolvedValue("OK");
      redis.expire.mockResolvedValue(1);

      const result = await service.recordConnect("user-1", "socket-1");

      expect(redis.sismember).toHaveBeenCalledWith("presence:user-1", "socket-1");
      expect(redis.sadd).toHaveBeenCalledWith("presence:user-1", "socket-1");
      expect(redis.set).toHaveBeenCalledWith("presence:user-1:socket:socket-1", "1", "EX", 30, "NX");
      expect(result).toBe(true);
    });

    it("returns false when the user already has another live connection (e.g. a second tab)", async () => {
      redis.sismember.mockResolvedValue(1);
      redis.sadd.mockResolvedValue(1);
      redis.set.mockResolvedValue("OK");

      const result = await service.recordConnect("user-1", "socket-2");

      expect(result).toBe(false);
    });
  });

  describe("recordDisconnect", () => {
    it("returns true (a real offline transition) when this was the user's last connection", async () => {
      redis.srem.mockResolvedValue(1);
      redis.scard.mockResolvedValue(0);
      redis.del.mockResolvedValue(1);

      const result = await service.recordDisconnect("user-1", "socket-1");

      expect(redis.srem).toHaveBeenCalledWith("presence:user-1", "socket-1");
      expect(redis.del).toHaveBeenCalledWith("presence:user-1:socket:socket-1");
      expect(result).toBe(true);
    });

    it("returns false when another connection (e.g. a second tab) is still live", async () => {
      redis.srem.mockResolvedValue(1);
      redis.scard.mockResolvedValue(1);
      redis.del.mockResolvedValue(1);

      const result = await service.recordDisconnect("user-1", "socket-1");

      expect(result).toBe(false);
    });
  });

  describe("isOnline", () => {
    it("returns true when at least one non-stale connection is live", async () => {
      redis.smembers.mockResolvedValue(["socket-1", "socket-2"]);
      redis.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      redis.scard.mockResolvedValue(1);

      await expect(service.isOnline("user-1")).resolves.toBe(true);
      expect(redis.srem).toHaveBeenCalledWith("presence:user-1", "socket-2");
    });

    it("returns false when no connection is live", async () => {
      redis.smembers.mockResolvedValue([]);

      await expect(service.isOnline("user-1")).resolves.toBe(false);
    });
  });

  describe("refreshPresence", () => {
    it("refreshes the socket lease without marking the user offline while the connection remains active", async () => {
      redis.exists.mockResolvedValue(1);
      redis.set.mockResolvedValue("OK");

      await expect(service.refreshPresence("user-1", "socket-1")).resolves.toBe(true);
      expect(redis.set).toHaveBeenCalledWith("presence:user-1:socket:socket-1", "1", "EX", 30, "XX");
    });
  });

  describe("onApplicationShutdown", () => {
    it("quits the Redis connection", async () => {
      redis.quit.mockResolvedValue("OK");

      await service.onApplicationShutdown();

      expect(redis.quit).toHaveBeenCalledOnce();
    });
  });
});
