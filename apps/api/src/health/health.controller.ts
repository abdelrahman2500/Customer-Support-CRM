import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { Public } from "../common/auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../common/config/env.validation";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  /** Liveness — the process is up. Always 200 if this handler runs at all. */
  @Public()
  @Get()
  liveness(): { status: "ok" } {
    return { status: "ok" };
  }

  /** Readiness — dependencies (Postgres, Redis) are reachable. */
  @Public()
  @Get("ready")
  async readiness(): Promise<{ status: "ok"; checks: Record<string, "ok"> }> {
    const checks: Record<string, "ok"> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = "ok";
    } catch (error) {
      throw new ServiceUnavailableException({ status: "error", dependency: "postgres", error });
    }

    const redis = new Redis(this.configService.get("REDIS_URL", { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await redis.connect();
      await redis.ping();
      checks.redis = "ok";
    } catch (error) {
      throw new ServiceUnavailableException({ status: "error", dependency: "redis", error });
    } finally {
      redis.disconnect();
    }

    return { status: "ok", checks };
  }
}
