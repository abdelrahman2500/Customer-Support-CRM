import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TestMachineController } from "../src/test-fixtures/test-machine-route.controller";

/**
 * RM-22 — API-Key Authentication for Machine-to-Machine Consumers.
 * Integration suite for `integrations/api-keys/*` CRUD, the existing
 * `integration:manage` permission gate on it, and the real
 * `ApiKeyGuard`/`AuthGuard` handoff against `TestMachineController` — see
 * that fixture's own doc comment for why it lives in its own file and
 * exists only for this suite (never part of the real `AppModule`/
 * production route surface).
 */
describe("Integrations — API-Key Authentication (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestMachineController],
    }).compile();
    app = moduleRef.createNestApplication();

    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();

    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must both be set for this suite to run");
    }
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    adminAccessToken = loginResponse.body.accessToken;

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    adminUserId = me.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createApiKey(
    scopes: string[] = ["integration:read"],
  ): Promise<{ id: string; rawKey: string }> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/integrations/api-keys")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ label: `e2e key ${randomUUID()}`, scopes })
      .expect(201);
    return response.body;
  }

  async function getAgentAccessToken(): Promise<string> {
    const agentEmail = `agent-api-keys-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent API Keys",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);

    const agentLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);
    return agentLogin.body.accessToken as string;
  }

  describe("permission gate on the admin CRUD", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/integrations/api-keys").expect(401);
    });

    it("rejects an Agent-role user, which has no integration:manage grant by default", async () => {
      const agentAccessToken = await getAgentAccessToken();

      await request(app.getHttpServer())
        .get("/api/v1/integrations/api-keys")
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(403);
    });
  });

  describe("CRUD", () => {
    it("rejects an unknown scope", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/integrations/api-keys")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ label: "bad scope", scopes: ["not-a-real-scope"] })
        .expect(400);
    });

    it("creates a key, returning the raw key exactly once", async () => {
      const created = await createApiKey();

      expect(created).toMatchObject({
        id: expect.any(String),
        label: expect.any(String),
        scopes: ["integration:read"],
        revokedAt: null,
        createdByUserId: adminUserId,
        rawKey: expect.stringMatching(/^crmk_/),
      });
    });

    it("never returns hashedKey or rawKey again from list", async () => {
      const created = await createApiKey();

      const listResponse = await request(app.getHttpServer())
        .get("/api/v1/integrations/api-keys")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const listed = listResponse.body.find((row: { id: string }) => row.id === created.id);

      expect(listed).not.toHaveProperty("rawKey");
      expect(listed).not.toHaveProperty("hashedKey");
      expect(listed).toHaveProperty("keyPrefix");
    });

    it("revokes a key via DELETE, which then rejects further use", async () => {
      const created = await createApiKey();

      await request(app.getHttpServer())
        .delete(`/api/v1/integrations/api-keys/${created.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const listResponse = await request(app.getHttpServer())
        .get("/api/v1/integrations/api-keys")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const revoked = listResponse.body.find((row: { id: string }) => row.id === created.id);
      expect(revoked.revokedAt).not.toBeNull();
    });
  });

  describe("the allowlisted machine route", () => {
    it("accepts a valid, correctly-scoped API key", async () => {
      const created = await createApiKey(["integration:read"]);

      const response = await request(app.getHttpServer())
        .get("/api/v1/test/machine-route")
        .set("Authorization", `Bearer ${created.rawKey}`)
        .expect(200);

      expect(response.body).toMatchObject({ ok: true, userId: adminUserId });
      expect(typeof response.body.branchId).toBe("string");
    });

    it("rejects a key missing the required scope with 403", async () => {
      const created = await createApiKey(["integration:write"]);

      await request(app.getHttpServer())
        .get("/api/v1/test/machine-route")
        .set("Authorization", `Bearer ${created.rawKey}`)
        .expect(403);
    });

    it("rejects a revoked key with 401", async () => {
      const created = await createApiKey(["integration:read"]);
      await request(app.getHttpServer())
        .delete(`/api/v1/integrations/api-keys/${created.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get("/api/v1/test/machine-route")
        .set("Authorization", `Bearer ${created.rawKey}`)
        .expect(401);
    });

    it("rejects a bogus key with 401", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/test/machine-route")
        .set("Authorization", "Bearer crmk_totally-made-up")
        .expect(401);
    });

    it("rejects a request with no Authorization header at all", async () => {
      await request(app.getHttpServer()).get("/api/v1/test/machine-route").expect(401);
    });

    it("also accepts a real JWT — @AllowApiKey() adds a second path in, never replaces the first", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/test/machine-route")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ ok: true, userId: adminUserId });
    });
  });

  describe("isolation from every existing route (regression)", () => {
    it("an API key cannot be used on an ordinary JWT-only route — still rejected exactly as before this story", async () => {
      const created = await createApiKey(["integration:read", "integration:write"]);

      await request(app.getHttpServer())
        .get("/api/v1/integrations/webhook-subscriptions")
        .set("Authorization", `Bearer ${created.rawKey}`)
        .expect(401);
    });
  });
});
