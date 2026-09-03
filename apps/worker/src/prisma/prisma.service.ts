import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import type { EnvConfig } from "../env.validation";

/**
 * Thin wrapper around the generated Prisma client — the minimum needed for
 * `apps/worker` to query `SlaTicketTarget`/`Ticket`/`SlaPolicy`. Mirrors
 * `apps/api/src/prisma/prisma.service.ts` exactly; there is only one
 * Prisma schema in this repository (`apps/api/prisma/schema.prisma`), so
 * `apps/worker` shares the same generated client, not a second one.
 *
 * Story 115 — connects using `APP_DATABASE_URL` (the restricted `crm_app`
 * runtime role) when set, falling back to `DATABASE_URL` otherwise — see
 * `env.validation.ts`'s own doc comment and
 * `apps/api/src/prisma/prisma.service.ts`'s identical pattern.
 */
/**
 * Deployment-configuration hardening — mirrors
 * `apps/api/src/common/config/database-url.ts`'s own
 * `resolveRuntimeDatabaseUrl` exactly (duplicated rather than imported for
 * the same reason `env.validation.ts` is: `apps/worker` must not depend on
 * `apps/api`, and there is only one other consumer).
 *
 * A **blank** `APP_DATABASE_URL` counts as absent. `env.validation.ts`
 * already normalizes `""` to `undefined`, but `@nestjs/config`'s
 * `ConfigService.get()` falls through to raw `process.env` when the
 * validated value is `undefined` — so a platform that materializes the
 * variable as the empty string still hands `""` back, and `??` does not
 * replace it. Prisma then fails with "Error validating datasource `db`: You
 * must provide a nonempty URL" and the container crash-loops.
 */
function resolveRuntimeDatabaseUrl(
  databaseUrl: string,
  appDatabaseUrl: string | undefined,
): string {
  return appDatabaseUrl?.trim() || databaseUrl;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService<EnvConfig, true>) {
    super({
      datasources: {
        db: {
          url: resolveRuntimeDatabaseUrl(
            configService.get("DATABASE_URL", { infer: true }),
            configService.get("APP_DATABASE_URL", { infer: true }),
          ),
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
