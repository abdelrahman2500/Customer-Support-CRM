import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/node";

/**
 * Story 113 — reports every unhandled exception to Sentry (a no-op when
 * `SENTRY_DSN` is unset — see `../sentry.ts`), then delegates to
 * `BaseExceptionFilter`, NestJS's own default handler — the exact
 * behavior every response already had before this story, byte for byte.
 * This filter only ever *adds* a side effect; it never changes what a
 * caller receives.
 *
 * Skips `HttpException`s below `500`: a `404`/`403`/`409`/validation
 * `400` is expected, caller-facing behavior (see e.g.
 * `translateDuplicateBranchName`'s own `ConflictException`), not a
 * developer-facing error — reporting every one of those to Sentry would
 * bury the unexpected `500`s this exists to surface in noise. An
 * exception that isn't an `HttpException` at all (a genuine unhandled
 * bug) is always reported.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof HttpException) || exception.getStatus() >= 500) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}
