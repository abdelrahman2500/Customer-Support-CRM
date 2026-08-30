import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { PresenceService } from "./presence.service";
import type { EnvConfig } from "../common/config/env.validation";

const redisInstances: Array<{
  scard: ReturnType<typeof vi.fn>;
  sadd: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(function RedisMock(this: Record<string, unknown>) {
    const instance = {
      scard: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
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
      redis.scard.mockResolvedValue(0);
      redis.sadd.mockResolvedValue(1);

      const result = await service.recordConnect("user-1", "socket-1");

      expect(redis.scard).toHaveBeenCalledWith("presence:user-1");
      expect(redis.sadd).toHaveBeenCalledWith("presence:user-1", "socket-1");
      expect(result).toBe(true);
    });

    it("returns false when the user already has another live connection (e.g. a second tab)", async () => {
      redis.scard.mockResolvedValue(1);
      redis.sadd.mockResolvedValue(1);

      const result = await service.recordConnect("user-1", "socket-2");

      expect(result).toBe(false);
    });
  });

  describe("recordDisconnect", () => {
    it("returns true (a real offline transition) when this was the user's last connection", async () => {
      redis.srem.mockResolvedValue(1);
      redis.scard.mockResolvedValue(0);

      const result = await service.recordDisconnect("user-1", "socket-1");

      expect(redis.srem).toHaveBeenCalledWith("presence:user-1", "socket-1");
      expect(result).toBe(true);
    });

    it("returns false when another connection (e.g. a second tab) is still live", async () => {
      redis.srem.mockResolvedValue(1);
      redis.scard.mockResolvedValue(1);

      const result = await service.recordDisconnect("user-1", "socket-1");

      expect(result).toBe(false);
    });
  });

  describe("isOnline", () => {
    it("returns true when at least one connection is live", async () => {
      redis.scard.mockResolvedValue(2);

      await expect(service.isOnline("user-1")).resolves.toBe(true);
    });

    it("returns false when no connection is live", async () => {
      redis.scard.mockResolvedValue(0);

      await expect(service.isOnline("user-1")).resolves.toBe(false);
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
