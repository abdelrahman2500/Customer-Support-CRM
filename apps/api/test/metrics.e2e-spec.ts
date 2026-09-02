import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 112's `GET /metrics` — the Prometheus half
 * of "Prometheus-format `/metrics` endpoints expose request, queue, and
 * processing metrics for Grafana dashboards"
 * (docs/architecture/11-quality-and-operations.md). Bootstraps the REAL
 * `AppModule`, mirroring `request-id.e2e-spec.ts`'s own bootstrap pattern.
 * `/metrics` is `@Public()` and excluded from the global prefix (see
 * `main.ts`), so no login/token is needed here either.
 */
describe("Metrics (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready", "metrics"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves Prometheus-format text with no authentication required", async () => {
    const response = await request(app.getHttpServer()).get("/metrics").expect(200);

    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("# HELP");
    expect(response.text).toContain("# TYPE");
  });

  it("includes default Node.js process metrics", async () => {
    const response = await request(app.getHttpServer()).get("/metrics").expect(200);

    expect(response.text).toContain("process_cpu_seconds_total");
    expect(response.text).toContain("nodejs_eventloop_lag_seconds");
  });

  it("includes this app's own BullMQ queue-depth gauge for every registered queue", async () => {
    const response = await request(app.getHttpServer()).get("/metrics").expect(200);

    expect(response.text).toContain("bullmq_queue_jobs");
    for (const queueName of [
      "health-check",
      "sla-timers",
      "sla-timer-events",
      "ai-processing",
      "ai-processing-events",
    ]) {
      expect(response.text).toContain(`queue="${queueName}"`);
    }
  });

  it("records the request that just retrieved /metrics itself in the HTTP duration histogram on the next scrape", async () => {
    await request(app.getHttpServer()).get("/metrics").expect(200);

    const response = await request(app.getHttpServer()).get("/metrics").expect(200);

    expect(response.text).toContain("http_request_duration_seconds");
    expect(response.text).toContain('route="/metrics"');
  });
});
