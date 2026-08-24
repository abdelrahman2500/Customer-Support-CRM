import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module";

/**
 * Standalone application context — no HTTP listener. `apps/worker` only
 * consumes BullMQ queues; see docs/architecture/02-system-architecture-overview.md
 * ("apps/worker (NestJS, no HTTP)").
 */
async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(WorkerModule);
  new Logger("Bootstrap").log("apps/worker started, consuming BullMQ queues");
}

void bootstrap();
