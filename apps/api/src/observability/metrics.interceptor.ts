import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MetricsService } from "./metrics.service";

/**
 * Story 112 — feeds `MetricsService`'s `http_request_duration_seconds`
 * histogram. Registered globally (`APP_INTERCEPTOR`, see
 * `ObservabilityModule`) alongside the existing `AuditInterceptor` — a
 * different concern (metrics, not an audit trail), so a separate
 * interceptor rather than folding this into that one.
 *
 * Records on both the success and error path (`tap`'s two callbacks): a
 * slow or failing request is exactly the kind of data point this metric
 * exists to surface, not one to discard. Uses the matched route's own
 * path template (`request.route.path`, e.g. `/tickets/:id`) rather than
 * the raw URL, so `/tickets/<uuid-1>` and `/tickets/<uuid-2>` aggregate
 * into one Prometheus series instead of one per unique id — falls back to
 * the raw path only for a route Nest couldn't match (e.g. a 404).
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    const record = (): void => {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      const route = (request.route as { path?: string } | undefined)?.path ?? request.path;
      this.metrics.observeHttpRequest(request.method, route, response.statusCode, durationSeconds);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
