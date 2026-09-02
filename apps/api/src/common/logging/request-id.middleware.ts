import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { CorrelationIdStore } from "./correlation-id.store";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Story 111 — docs/architecture/11-quality-and-operations.md: "a
 * correlation/request ID propagates from API requests into worker jobs."
 * Honors a caller-supplied `x-request-id` (letting an upstream
 * gateway/client's own trace id flow through), or generates one when
 * absent, then:
 *
 * - echoes it back on the response header, so a caller that didn't send
 *   one can still correlate its own client-side logs with this request;
 * - wraps `next()` in `CorrelationIdStore.run(id, next)`, so every
 *   downstream middleware, guard, and route handler for the lifetime of
 *   this request/response cycle shares the same id — including a BullMQ
 *   producer's `enqueue()` call happening later in the same request
 *   (see `AiProcessingProducer`'s callers).
 *
 * Registered in `app.module.ts`'s `configure()` *before* `TenantMiddleware`,
 * mirroring that middleware's own shape/style, so this one's `AsyncLocalStorage`
 * context wraps everything downstream, `TenantMiddleware` included.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = this.resolveId(req);
    res.setHeader(REQUEST_ID_HEADER, id);
    CorrelationIdStore.run(id, next);
  }

  private resolveId(req: Request): string {
    const header = req.headers[REQUEST_ID_HEADER];
    const presented = Array.isArray(header) ? header[0] : header;
    return presented && presented.length > 0 ? presented : randomUUID();
  }
}
