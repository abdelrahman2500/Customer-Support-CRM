import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 62 — `GET/PATCH /branding`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like every other e2e suite here. Branch-scoped (like
 * `audit-logs-read.e2e-spec.ts`), mirrors `automation-rules.e2e-spec.ts`'s
 * exact 401/403 boilerplate.
 *
 * Config + admin-form preview only (Story 62's own scope) — no assertion
 * here ever checks a rendered logo/color anywhere outside this API surface,
 * matching the story's explicit non-goal of live, shared-layout
 * consumption.
 */
describe("Branding (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();

    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must be set for this suite to run");
    }
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    adminAccessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request on every route", async () => {
    await request(app.getHttpServer()).get("/api/v1/branding").expect(401);
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .send({ primaryColor: "#112233" })
      .expect(401);
  });

  it("rejects an Agent-role user lacking branding:read/update on every route (403)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-branding-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: "agent-test-password-123",
        fullName: "Test Agent Branding",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);
    const agentLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: "agent-test-password-123" })
      .expect(200);
    const agentAccessToken = agentLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ primaryColor: "#112233" })
      .expect(403);
  });

  it("rejects an invalid hex color with a validation error", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ primaryColor: "not-a-color" })
      .expect(400);
  });

  it("rejects an invalid logoUrl with a validation error", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ logoUrl: "not-a-url" })
      .expect(400);
  });

  it("persists a real PATCH, reflected on the next GET, and leaves other fields untouched on a partial update", async () => {
    const logoUrl = `https://example.com/logo-${randomUUID()}.png`;
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ logoUrl, primaryColor: "#112233", secondaryColor: "#445566" })
      .expect(200);

    const afterFirstUpdate = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterFirstUpdate.body).toEqual({
      logoUrl,
      primaryColor: "#112233",
      secondaryColor: "#445566",
    });

    // A partial update (secondaryColor only) must leave logoUrl/primaryColor
    // exactly as they were.
    await request(app.getHttpServer())
      .patch("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ secondaryColor: "#778899" })
      .expect(200);

    const afterPartialUpdate = await request(app.getHttpServer())
      .get("/api/v1/branding")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterPartialUpdate.body).toEqual({
      logoUrl,
      primaryColor: "#112233",
      secondaryColor: "#778899",
    });
  });
});
