import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { SLA_BREACHED_EVENT } from "../src/modules/sla-policies/sla-detection.events";

/**
 * Integration suite for Story 49 — `GET /tickets/:id/sla-escalations`.
 *
 * Bootstraps the REAL `AppModule` — same guards
 * (`AuthGuard`/`PermissionsGuard`/`ThrottlerGuard`), same `AuditInterceptor`,
 * same `TenantMiddleware`, same global `ValidationPipe`/prefix as
 * `src/main.ts` — against a REAL Postgres/Redis, exactly like
 * `sla-targets.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL` pointed at
 * a real, migrated, and SEEDED database.
 *
 * Combines `sla-targets.e2e-spec.ts`'s bootstrap (SuperAdmin login,
 * Agent-role user creation-and-login, real ticket creation) with
 * `sla-breach-escalation.e2e-spec.ts`'s technique of emitting
 * `SLA_BREACHED_EVENT` directly on the real, compiled `EventEmitter2` to
 * produce a genuine, persisted `SlaEscalation` row — no fake timers, no
 * direct Prisma seeding.
 */
describe("SLA Escalations (e2e)", () => {
  let app: INestApplication;
  let eventEmitter: EventEmitter2;
  let adminAccessToken: string;
  let adminBranchId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    eventEmitter = moduleRef.get(EventEmitter2);

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

  async function createTicket(): Promise<string> {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `SLA escalations e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "SLA escalations e2e ticket" })
      .expect(201);
    return ticket.body.id;
  }

  async function waitForEscalations(
    ticketId: string,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<request.Response> {
    const deadline = Date.now() + timeoutMs;
    let lastResponse: request.Response;
    do {
      lastResponse = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/sla-escalations`)
        .set("Authorization", `Bearer ${adminAccessToken}`);
      if (lastResponse.status === 200 && lastResponse.body.length > 0) {
        return lastResponse;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    return lastResponse;
  }

  it("rejects an unauthenticated request", async () => {
    const ticketId = await createTicket();

    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/sla-escalations`)
      .expect(401);
  });

  // Story 100 — Agent's default seed grant now includes `sla:read`
  // (previously `[]`), so this route is now reachable by a freshly seeded
  // Agent-role user; this proves that, rather than a 403.
  it("allows an Agent-role user with the default sla:read grant to read SLA escalations (Story 100)", async () => {
    const ticketId = await createTicket();

    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-sla-escalations-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent SLA Escalations",
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
      .get(`/api/v1/tickets/${ticketId}/sla-escalations`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);
  });

  it("returns an empty array for a ticket with no escalations", async () => {
    const ticketId = await createTicket();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/sla-escalations`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it("returns a real SlaEscalation row produced by emitting sla.breached on the real EventEmitter2", async () => {
    const ticketId = await createTicket();
    const targetAt = new Date("2026-01-01T00:00:00.000Z");

    eventEmitter.emit(SLA_BREACHED_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt,
    });

    const response = await waitForEscalations(ticketId);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].targetType).toBe("response");
    expect(new Date(response.body[0].targetAt).getTime()).toBe(targetAt.getTime());
    expect(response.body[0].escalatedAt).toBeDefined();
    expect(new Date(response.body[0].escalatedAt).getTime()).not.toBeNaN();
  });

  it("returns 404 for an unknown ticket id", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${randomUUID()}/sla-escalations`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });
});
