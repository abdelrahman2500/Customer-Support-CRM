import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 37 — `GET /audit-logs`.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, exactly like
 * `identity.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL` pointed at a
 * real, migrated, and SEEDED database (re-seeded with the `audit:read`
 * permission this story adds).
 *
 * No manual trigger is needed to produce a real `AuditLog` row: the
 * globally-registered `AuditInterceptor` already logs every mutating
 * request automatically (unchanged by this story) — a plain `POST
 * /customers` call in this suite is itself real audit-log-generating
 * activity.
 */
describe("Audit logs — read endpoint (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let adminBranchId: string;

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

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    adminBranchId = me.body.branchId;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/audit-logs").expect(401);
  });

  async function waitForAuditLogRow(
    action: string,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    do {
      const response = await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      if (response.body.some((log: { action: string }) => log.action === action)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for an audit log row with action "${action}"`);
  }

  it("surfaces a real audit log row for a real mutating request, scoped to the admin's branch", async () => {
    const displayName = `Audit log e2e customer ${randomUUID()}`;
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName })
      .expect(201);
    expect(createResponse.body.id).toBeTypeOf("string");

    await waitForAuditLogRow("POST /api/v1/customers");

    const response = await request(app.getHttpServer())
      .get("/api/v1/audit-logs")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const match = response.body.find(
      (log: { action: string; branchId: string }) =>
        log.action === "POST /api/v1/customers" && log.branchId === adminBranchId,
    );
    expect(match).toMatchObject({
      action: "POST /api/v1/customers",
      entityType: "http_request",
      branchId: adminBranchId,
    });
  });

  it("returns rows ordered newest-first", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/audit-logs")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const timestamps = response.body.map((log: { createdAt: string }) => new Date(log.createdAt).getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });

  it("rejects an Agent user (no audit:read permission) with 403", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const agentEmail = `audit-agent-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Audit Log Test Agent",
        branchId: adminBranchId,
        roleId: agentRole.id,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/audit-logs")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
      .expect(403);
  });
});
