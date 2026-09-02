import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 111's `RequestIdMiddleware` — the
 * correlation/request ID half of "Structured JSON logs use pino; a
 * correlation/request ID propagates from API requests into worker jobs"
 * (docs/architecture/11-quality-and-operations.md). Bootstraps the REAL
 * `AppModule` (the same middleware stack `main.ts` wires), mirroring
 * `identity.e2e-spec.ts`'s own bootstrap pattern. Uses the `@Public()`
 * `GET /health` endpoint so no login/token is needed — this is
 * middleware-level behavior, orthogonal to authentication.
 */
describe("RequestIdMiddleware (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("echoes back a caller-supplied x-request-id unchanged", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .set("x-request-id", "caller-supplied-request-id")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("caller-supplied-request-id");
  });

  it("generates and returns a request id when the caller sends none", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);

    expect(response.headers["x-request-id"]).toBeTypeOf("string");
    expect(response.headers["x-request-id"]?.length).toBeGreaterThan(0);
  });

  it("generates a different id per request", async () => {
    const first = await request(app.getHttpServer()).get("/health").expect(200);
    const second = await request(app.getHttpServer()).get("/health").expect(200);

    expect(first.headers["x-request-id"]).not.toBe(second.headers["x-request-id"]);
  });
});
