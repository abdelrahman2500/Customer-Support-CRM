import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Thin wrapper around the generated Prisma client, managed by Nest's
 * lifecycle hooks so every module gets one shared connection pool.
 *
 * Per docs/architecture/02-system-architecture-overview.md, only `apps/api`
 * and `apps/worker` are allowed to depend on this — frontends never touch
 * Postgres directly.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to Postgres");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
