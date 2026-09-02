import { describe, expect, it, vi } from "vitest";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { Observable } from "rxjs";
import { of, throwError } from "rxjs";
import { MetricsInterceptor } from "./metrics.interceptor";
import type { MetricsService } from "./metrics.service";

function buildMetricsServiceMock() {
  return { observeHttpRequest: vi.fn() } as unknown as MetricsService;
}

function buildHttpContext(request: Record<string, unknown>, response: Record<string, unknown>) {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function buildCallHandler(observable: Observable<unknown>): CallHandler {
  return { handle: () => observable } as CallHandler;
}

describe("MetricsInterceptor", () => {
  it("records the request on a successful response, using the matched route's path template", async () => {
    const metrics = buildMetricsServiceMock();
    const interceptor = new MetricsInterceptor(metrics);
    const context = buildHttpContext(
      { method: "GET", path: "/tickets/ticket-1", route: { path: "/tickets/:id" } },
      { statusCode: 200 },
    );

    await interceptor.intercept(context, buildCallHandler(of("ok"))).toPromise();

    expect(metrics.observeHttpRequest).toHaveBeenCalledWith(
      "GET",
      "/tickets/:id",
      200,
      expect.any(Number),
    );
  });

  it("falls back to the raw request path when no route was matched (e.g. a 404)", async () => {
    const metrics = buildMetricsServiceMock();
    const interceptor = new MetricsInterceptor(metrics);
    const context = buildHttpContext(
      { method: "GET", path: "/does-not-exist" },
      { statusCode: 404 },
    );

    await interceptor.intercept(context, buildCallHandler(of("not found"))).toPromise();

    expect(metrics.observeHttpRequest).toHaveBeenCalledWith(
      "GET",
      "/does-not-exist",
      404,
      expect.any(Number),
    );
  });

  it("still records the request when the handler errors", async () => {
    const metrics = buildMetricsServiceMock();
    const interceptor = new MetricsInterceptor(metrics);
    const context = buildHttpContext(
      { method: "POST", path: "/tickets", route: { path: "/tickets" } },
      { statusCode: 500 },
    );

    await expect(
      interceptor
        .intercept(context, buildCallHandler(throwError(() => new Error("boom"))))
        .toPromise(),
    ).rejects.toThrow("boom");

    expect(metrics.observeHttpRequest).toHaveBeenCalledWith(
      "POST",
      "/tickets",
      500,
      expect.any(Number),
    );
  });

  it("skips non-HTTP execution contexts (e.g. a WebSocket message) without touching MetricsService", async () => {
    const metrics = buildMetricsServiceMock();
    const interceptor = new MetricsInterceptor(metrics);
    const context = { getType: () => "ws" } as unknown as ExecutionContext;

    const result = await interceptor.intercept(context, buildCallHandler(of("event"))).toPromise();

    expect(result).toBe("event");
    expect(metrics.observeHttpRequest).not.toHaveBeenCalled();
  });
});
