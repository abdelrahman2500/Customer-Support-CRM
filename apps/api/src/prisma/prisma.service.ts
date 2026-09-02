import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import type { EnvConfig } from "../common/config/env.validation";

/**
 * Thin wrapper around the generated Prisma client, managed by Nest's
 * lifecycle hooks so every module gets one shared connection pool.
 *
 * Per docs/architecture/02-system-architecture-overview.md, only `apps/api`
 * and `apps/worker` are allowed to depend on this — frontends never touch
 * Postgres directly.
 *
 * Story 115 — connects using `APP_DATABASE_URL` (the restricted `crm_app`
 * runtime role) when set, falling back to `DATABASE_URL` (the owner role)
 * otherwise — see `env.validation.ts`'s own doc comment. This is the one
 * place either app's actual runtime Postgres connection is established;
 * `prisma migrate deploy`/`prisma db seed`/`prisma generate` are
 * unaffected — they read `schema.prisma`'s own `env("DATABASE_URL")`
 * datasource declaration directly, never through this service.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService<EnvConfig, true>) {
    super({
      datasources: {
        db: {
          url:
            configService.get("APP_DATABASE_URL", { infer: true }) ??
            configService.get("DATABASE_URL", { infer: true }),
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to Postgres");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
