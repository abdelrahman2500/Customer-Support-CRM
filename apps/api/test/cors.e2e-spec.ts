import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { parseCorsOrigins } from "../src/common/config/cors-origins";
import type { EnvConfig } from "../src/common/config/env.validation";

/**
 * Integration suite for Story 23's CORS prerequisite (named by
 * `realtime-socketio-foundation` Story 20's own plan as blocking any future
 * real browser client). Bootstraps the REAL `AppModule`, then applies
 * `app.enableCors(...)` the exact same way `src/main.ts` does — reading
 * `CORS_ORIGINS` via `ConfigService` and `parseCorsOrigins` — since the
 * other e2e suites in this repository build their own `INestApplication`
 * without ever calling `main.ts`'s `bootstrap()`. `apps/api/.env` sets
 * `CORS_ORIGINS="http://localhost:3000"` for local/dev/test runs (picked up
 * by `ConfigModule.forRoot()`'s default `.env` loading), matching this
 * story's own intake decision for local development.
 */
describe("CORS configuration (e2e)", () => {
  let app: INestApplication;
  let configuredOrigins: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    const config = app.get(ConfigService<EnvConfig, true>);
    configuredOrigins = parseCorsOrigins(config.get("CORS_ORIGINS", { infer: true }));
    app.enableCors({ origin: configuredOrigins, credentials: true });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("has at least one configured origin for this suite to exercise", () => {
    expect(configuredOrigins.length).toBeGreaterThan(0);
  });

  it("reflects an allowed origin in Access-Control-Allow-Origin", async () => {
    const allowedOrigin = configuredOrigins[0];
    if (!allowedOrigin) {
      throw new Error("Expected at least one configured CORS origin for this test to exercise");
    }

    const response = await request(app.getHttpServer())
      .get("/health")
      .set("Origin", allowedOrigin)
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not reflect an origin that is not in the allowed list", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .set("Origin", "http://not-an-allowed-origin.example.com")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).not.toBe(
      "http://not-an-allowed-origin.example.com",
    );
  });
});
