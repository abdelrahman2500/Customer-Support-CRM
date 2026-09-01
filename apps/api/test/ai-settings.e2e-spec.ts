import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 81 — `GET/PATCH /ai/settings`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, mirroring
 * `branding.e2e-spec.ts`'s exact shape (401/403 boilerplate, PATCH
 * persistence + partial-update). This suite's fixture branch is shared
 * with every other e2e file (single-branch seed) — the final test
 * restores every flag to `true` (the seeded default) so this suite never
 * leaves the branch in a state that would break `tickets.e2e-spec.ts`/
 * `portal-chat.e2e-spec.ts`'s own AI assertions when run afterward.
 */
describe("AI Settings (e2e)", () => {
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
    await request(app.getHttpServer()).get("/api/v1/ai/settings").expect(401);
    await request(app.getHttpServer())
      .patch("/api/v1/ai/settings")
      .send({ chatEnabled: false })
      .expect(401);
  });

  it("rejects an Agent-role user lacking ai:read/ai:update on every route (403)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-ai-settings-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: "agent-test-password-123",
        fullName: "Test Agent AI Settings",
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
      .get("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ chatEnabled: false })
      .expect(403);
  });

  it("persists a real PATCH, reflected on the next GET, leaves other fields untouched on a partial update, then restores all-enabled defaults", async () => {
    const initial = await request(app.getHttpServer())
      .get("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(initial.body).toEqual({
      summarizeEnabled: true,
      suggestReplyEnabled: true,
      categorizeEnabled: true,
      chatEnabled: true,
    });

    await request(app.getHttpServer())
      .patch("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ summarizeEnabled: false, chatEnabled: false })
      .expect(200);

    const afterFirstUpdate = await request(app.getHttpServer())
      .get("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterFirstUpdate.body).toEqual({
      summarizeEnabled: false,
      suggestReplyEnabled: true,
      categorizeEnabled: true,
      chatEnabled: false,
    });

    // A partial update (categorizeEnabled only) must leave the two
    // already-set flags exactly as they were.
    await request(app.getHttpServer())
      .patch("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ categorizeEnabled: false })
      .expect(200);

    const afterPartialUpdate = await request(app.getHttpServer())
      .get("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterPartialUpdate.body).toEqual({
      summarizeEnabled: false,
      suggestReplyEnabled: true,
      categorizeEnabled: false,
      chatEnabled: false,
    });

    // Restore the seeded, all-enabled default — this branch is shared
    // with every other e2e suite in this run.
    await request(app.getHttpServer())
      .patch("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        summarizeEnabled: true,
        suggestReplyEnabled: true,
        categorizeEnabled: true,
        chatEnabled: true,
      })
      .expect(200);
  });
});
