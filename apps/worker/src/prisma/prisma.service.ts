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
