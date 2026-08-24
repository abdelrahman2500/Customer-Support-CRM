import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Global so every domain module can inject `PrismaService` without each one
 * re-importing this module — see docs/architecture/02-system-architecture-overview.md
 * ("Cross-cutting concerns as global providers").
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
