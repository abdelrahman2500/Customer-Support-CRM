import "./tracing";
import "./sentry";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module";
import { PinoLoggerService } from "./common/logging/pino-logger.service";

/**
 * Standalone application context — no HTTP listener. `apps/worker` only
 * consumes BullMQ queues; see docs/architecture/02-system-architecture-overview.md
 * ("apps/worker (NestJS, no HTTP)").
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  // Story 111 — docs/architecture/11-quality-and-operations.md: "Structured
  // JSON logs use pino."
  app.useLogger(app.get(PinoLoggerService));
  new Logger("Bootstrap").log("apps/worker started, consuming BullMQ queues");
}

void bootstrap();
