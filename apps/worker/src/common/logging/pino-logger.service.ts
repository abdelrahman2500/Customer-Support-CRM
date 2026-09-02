import { Injectable, LoggerService } from "@nestjs/common";
import pino from "pino";
import { CorrelationIdStore } from "./correlation-id.store";

/**
 * Story 111 — docs/architecture/11-quality-and-operations.md: "Structured
 * JSON logs use `pino`." Implements Nest's `LoggerService` interface so
 * `app.useLogger(...)` (see `main.ts`) swaps this in for the framework's
 * default console logger everywhere — every existing `new Logger(X.name)`
 * / injected `Logger` call site across this app is unchanged and
 * automatically routes through this.
 *
 * Must stay behaviorally identical to
 * `apps/api/src/common/logging/pino-logger.service.ts` (deliberately
 * duplicated — see `correlation-id.store.ts`'s own doc comment in this
 * same folder). Every emitted line merges in the current job's
 * correlation id (via `CorrelationIdStore`, set for the job's lifetime by
 * `AiProcessingProcessor.process()`) when one is active, and the Nest
 * `context` argument (e.g. a class name) as a bound `context` field.
 */
@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger = pino();

  log(message: unknown, context?: string): void {
    this.logger.info(this.bindings(context), this.stringify(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ ...this.bindings(context), trace }, this.stringify(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(this.bindings(context), this.stringify(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(this.bindings(context), this.stringify(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace(this.bindings(context), this.stringify(message));
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal(this.bindings(context), this.stringify(message));
  }

  private bindings(context?: string): Record<string, unknown> {
    const correlationId = CorrelationIdStore.get();
    return {
      ...(context !== undefined ? { context } : {}),
      ...(correlationId !== undefined ? { correlationId } : {}),
    };
  }

  private stringify(message: unknown): string {
    return typeof message === "string" ? message : JSON.stringify(message);
  }
}
