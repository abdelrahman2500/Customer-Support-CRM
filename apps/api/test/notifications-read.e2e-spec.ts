import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SLA_AT_RISK_EVENT } from "../src/modules/sla-policies/sla-detection.events";

/**
 * Integration suite for Story 36 — `GET /notifications`.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, exactly like
 * `identity.e2e-spec.ts`/`sla-policies.e2e-spec.ts`. Requires
 * `DATABASE_URL`/`REDIS_URL` pointed at a real, migrated, and SEEDED
 * database (re-seeded with the `notification:read` permission this story
 * adds).
 *
 * Emits `sla.at_risk` directly on the real, compiled `EventEmitter2` — the
 * same deterministic technique `sla-at-risk-notification.e2e-spec.ts`
 * already established — to produce a real, persisted `NotificationLog` row
 * to assert the new read endpoint actually surfaces, rather than only
 * exercising it against whatever rows happen to already exist from other
 * suites' prior runs against this persistent database.
 */
describe("Notifications — read endpoint (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
  let adminAccessToken: string;
  let adminBranchId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
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
      .send({ displayName: `Notifications read e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "Notifications read e2e ticket" })
      .expect(201);
    return ticket.body.id;
  }

  async function waitForNotificationLogRow(
    ticketId: string,
    targetAt: Date,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ) {
    const deadline = Date.now() + timeoutMs;
    do {
      const rows = await prisma.notificationLog.findMany({
        where: { eventType: SLA_AT_RISK_EVENT, ticketId, targetType: "response", targetAt },
      });
      if (rows.length > 0) {
        return rows[0];
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    throw new Error("Timed out waiting for the NotificationLog row to be persisted");
  }

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/notifications").expect(401);
  });

  it("returns an array shape for the authenticated admin", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it("surfaces a real, freshly-created sla.at_risk notification, scoped to the admin's branch", async () => {
    const ticketId = await createTicket();
    const targetAt = new Date("2030-01-01T00:00:00.000Z");

    eventEmitter.emit(SLA_AT_RISK_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt,
    });
    await waitForNotificationLogRow(ticketId, targetAt);

    const response = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const match = response.body.find(
      (notification: { ticketId: string; targetAt: string }) =>
        notification.ticketId === ticketId && notification.targetAt === targetAt.toISOString(),
    );
    expect(match).toMatchObject({
      eventType: SLA_AT_RISK_EVENT,
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
    });
  });

  it("also surfaces a real ticket.escalated notification (whose own branchId column is null) correctly scoped via the ticket relation", async () => {
    // `TICKET_ESCALATED_EVENT` rows persist with `branchId: null` (see
    // `TicketEscalatedNotificationListener`'s own doc comment) — this
    // proves the endpoint's ticket-relation scoping genuinely includes
    // them rather than silently dropping every escalation notification.
    const { TICKET_ESCALATED_EVENT } = await import("../src/modules/tickets/tickets.events");
    const ticketId = await createTicket();

    eventEmitter.emit(TICKET_ESCALATED_EVENT, {
      ticket: { id: ticketId },
      actorUserId: null,
    });

    const deadline = Date.now() + 5000;
    let row = null;
    do {
      row = await prisma.notificationLog.findFirst({
        where: { eventType: TICKET_ESCALATED_EVENT, ticketId },
      });
      if (row) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    expect(row).not.toBeNull();
    expect(row?.branchId).toBeNull();

    const response = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const match = response.body.find((n: { ticketId: string }) => n.ticketId === ticketId);
    expect(match).toMatchObject({
      eventType: TICKET_ESCALATED_EVENT,
      ticketId,
      branchId: adminBranchId,
    });
  });

  it("rejects an Agent user (no notification:read permission) with 403", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const agentEmail = `notif-agent-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Notifications Test Agent",
        branchId: adminBranchId,
        roleId: agentRole.id,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
      .expect(403);
  });
});
