import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import type { EnvConfig } from "../common/config/env.validation";
import { resolveRuntimeDatabaseUrl } from "../common/config/database-url";

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
          // `resolveRuntimeDatabaseUrl`, not `??` — a blank APP_DATABASE_URL
          // has to fall back too. `ConfigService.get()` falls through to raw
          // `process.env` when the validated value is `undefined`, so a
          // deployment platform that materializes the variable as the empty
          // string handed `""` straight through `??` into Prisma and
          // crash-looped the container. See that helper's own doc comment.
          url: resolveRuntimeDatabaseUrl(
            configService.get("DATABASE_URL", { infer: true }),
            configService.get("APP_DATABASE_URL", { infer: true }),
          ).url,
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
