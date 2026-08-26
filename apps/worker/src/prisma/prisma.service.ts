import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Thin wrapper around the generated Prisma client — the minimum needed for
 * `apps/worker` to query `SlaTicketTarget`/`Ticket`/`SlaPolicy`. Mirrors
 * `apps/api/src/prisma/prisma.service.ts` exactly; there is only one
 * Prisma schema in this repository (`apps/api/prisma/schema.prisma`), so
 * `apps/worker` shares the same generated client, not a second one.
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
