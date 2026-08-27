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
 * Integration suite for Story 18 — SLA at-risk notification reaction.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, exactly like
 * `sla-breach-escalation.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL`
 * pointed at a real, migrated, and SEEDED database.
 *
 * Emits `sla.at_risk` directly on the real, compiled `EventEmitter2`
 * (the same pattern `sla-breach-escalation.e2e-spec.ts` already established
 * for `sla.breached`) to exercise this story's own reaction in isolation
 * from Story 15's detection cadence. Resolves `PrismaService` directly (the
 * same documented exception `sla-breach-escalation.e2e-spec.ts` already
 * established: no HTTP endpoint exposes `NotificationLog` rows, by design —
 * this story adds none) to assert on persisted rows.
 */
describe("SLA At-Risk Notification Reaction (e2e)", () => {
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
      .send({ displayName: `SLA at-risk notification e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "SLA at-risk notification e2e ticket" })
      .expect(201);
    return ticket.body.id;
  }

  async function waitForNotificationLogRows(
    ticketId: string,
    targetAt: Date,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ) {
    const deadline = Date.now() + timeoutMs;
    let rows: Awaited<ReturnType<typeof prisma.notificationLog.findMany>> = [];
    do {
      rows = await prisma.notificationLog.findMany({
        where: { eventType: SLA_AT_RISK_EVENT, ticketId, targetType: "response", targetAt },
      });
      if (rows.length > 0) {
        return rows;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    return rows;
  }

  it("persists a NotificationLog row for a real sla.at_risk transition", async () => {
    const ticketId = await createTicket();
    const targetAt = new Date("2026-01-01T00:00:00.000Z");

    eventEmitter.emit(SLA_AT_RISK_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt,
    });

    const rows = await waitForNotificationLogRows(ticketId, targetAt);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.branchId).toBe(adminBranchId);
    expect(rows[0]?.eventType).toBe(SLA_AT_RISK_EVENT);
  });

  it("does not persist a second row for a duplicate delivery of the same transition", async () => {
    const ticketId = await createTicket();
    const targetAt = new Date("2026-01-02T00:00:00.000Z");

    eventEmitter.emit(SLA_AT_RISK_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt,
    });
    await waitForNotificationLogRows(ticketId, targetAt);

    eventEmitter.emit(SLA_AT_RISK_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt,
    });
    // The duplicate is expected to produce nothing — give it a moment to
    // (not) land rather than asserting instantaneously.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const rows = await prisma.notificationLog.findMany({
      where: { eventType: SLA_AT_RISK_EVENT, ticketId, targetType: "response", targetAt },
    });
    expect(rows).toHaveLength(1);
  });

  it("treats a different targetAt for the same ticket/targetType as a new, independent log entry", async () => {
    const ticketId = await createTicket();
    const firstTargetAt = new Date("2026-01-03T00:00:00.000Z");
    const secondTargetAt = new Date("2026-01-03T01:00:00.000Z");

    eventEmitter.emit(SLA_AT_RISK_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt: firstTargetAt,
    });
    await waitForNotificationLogRows(ticketId, firstTargetAt);

    eventEmitter.emit(SLA_AT_RISK_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt: secondTargetAt,
    });
    const secondRows = await waitForNotificationLogRows(ticketId, secondTargetAt);
    expect(secondRows).toHaveLength(1);

    const allRowsForTicket = await prisma.notificationLog.findMany({
      where: { eventType: SLA_AT_RISK_EVENT, ticketId, targetType: "response" },
    });
    expect(allRowsForTicket).toHaveLength(2);
  });
});
