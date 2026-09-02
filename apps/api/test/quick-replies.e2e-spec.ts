import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 91 — `quick-replies/*` CRUD. Bootstraps the
 * REAL `AppModule` against a REAL Postgres, exactly like
 * `automation-rules.e2e-spec.ts`.
 */
describe("Quick Replies (e2e)", () => {
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

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/quick-replies").expect(401);
  });

  // Story 100 — Agent's default seed grant now includes `quick-reply:read`
  // (previously `[]`), so the GET route below is now reachable; only the
  // write route (`quick-reply:create`, still not granted) remains 403.
  it("allows reading (quick-reply:read) but still rejects creating (403) for an Agent-role user (Story 100)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-quick-replies-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Quick Replies",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);

    const agentLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);
    const agentAccessToken = agentLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .get("/api/v1/quick-replies")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/quick-replies")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ title: "Should not be created", body: "Should not be created" })
      .expect(403);
  });

  it("rejects an empty title or body with 400", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/quick-replies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "", body: "Some body" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/quick-replies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "Some title", body: "" })
      .expect(400);
  });

  it("creates, lists, and updates a quick reply", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/quick-replies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        title: `CRUD test quick reply ${randomUUID()}`,
        body: "You can reset your password from the login page.",
      })
      .expect(201);
    const quickReplyId = createResponse.body.id;
    expect(createResponse.body.isActive).toBe(true);

    const listResponse = await request(app.getHttpServer())
      .get("/api/v1/quick-replies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(listResponse.body.map((reply: { id: string }) => reply.id)).toContain(quickReplyId);

    await request(app.getHttpServer())
      .patch(`/api/v1/quick-replies/${quickReplyId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ title: "Updated title", body: "Updated body", isActive: false })
      .expect(200);

    const afterUpdate = await request(app.getHttpServer())
      .get("/api/v1/quick-replies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const updated = afterUpdate.body.find((reply: { id: string }) => reply.id === quickReplyId);
    expect(updated).toMatchObject({
      title: "Updated title",
      body: "Updated body",
      isActive: false,
    });
  });

  it("returns 404 updating an unknown quick reply id", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/quick-replies/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(404);
  });
});
