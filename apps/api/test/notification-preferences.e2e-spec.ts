import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 58 — `GET/PATCH /notification-preferences`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like every other e2e suite here. Self-scoped, so — unlike most other
 * suites — no `@RequirePermissions`/role-creation dance is needed; this
 * suite instead proves cross-user isolation using a second, plain Agent
 * user (created only to prove one user's preference never leaks to
 * another's, not to test any permission boundary).
 */
describe("Notification Preferences (e2e)", () => {
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

  it("rejects an unauthenticated request on both routes", async () => {
    await request(app.getHttpServer()).get("/api/v1/notification-preferences").expect(401);
    await request(app.getHttpServer())
      .patch("/api/v1/notification-preferences")
      .send({ eventType: "sla.at_risk", inAppEnabled: false })
      .expect(401);
  });

  it("rejects an unrecognized eventType with a validation error", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ eventType: "not.a.real.event", inAppEnabled: false })
      .expect(400);
  });

  it("defaults every event type to enabled for a brand-new user", async () => {
    // A dedicated, brand-new Agent user — guaranteed to have no
    // NotificationPreference rows yet, unlike the shared seed admin (which
    // other tests in this file may have already mutated).
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-notif-prefs-default-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Notif Prefs Default",
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

    const response = await request(app.getHttpServer())
      .get("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);

    expect(response.body).toEqual([
      { eventType: "sla.at_risk", inAppEnabled: true },
      { eventType: "sla.breached", inAppEnabled: true },
      { eventType: "ticket.escalated", inAppEnabled: true },
    ]);
  });

  it("persists a real PATCH, reflected on the next GET", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ eventType: "sla.breached", inAppEnabled: false })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const slaBreached = response.body.find(
      (row: { eventType: string }) => row.eventType === "sla.breached",
    );
    expect(slaBreached.inAppEnabled).toBe(false);

    // Restore, so this test is safe to re-run against the same shared
    // seeded admin without leaving a permanent side effect for any other
    // suite that might (in the future) read this admin's preferences.
    await request(app.getHttpServer())
      .patch("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ eventType: "sla.breached", inAppEnabled: true })
      .expect(200);
  });

  it("never leaks one user's preference to another's", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-notif-prefs-isolation-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Notif Prefs Isolation",
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
      .patch("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ eventType: "ticket.escalated", inAppEnabled: false })
      .expect(200);

    const adminResponse = await request(app.getHttpServer())
      .get("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const adminTicketEscalated = adminResponse.body.find(
      (row: { eventType: string }) => row.eventType === "ticket.escalated",
    );
    expect(adminTicketEscalated.inAppEnabled).toBe(true);
  });
});
