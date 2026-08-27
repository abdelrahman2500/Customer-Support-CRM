import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SLA_BREACHED_EVENT } from "../src/modules/sla-policies/sla-detection.events";
import type { TicketEscalatedEvent } from "../src/modules/tickets/tickets.events";

/**
 * Integration suite for Story 17 — SLA breach escalation.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, exactly like
 * `sla-targets.e2e-spec.ts`/`tickets.e2e-spec.ts`. Requires `DATABASE_URL`/
 * `REDIS_URL` pointed at a real, migrated, and SEEDED database.
 *
 * Emits `sla.breached` directly on the real, compiled `EventEmitter2`
 * (mirroring `sla-timers-producer.e2e-spec.ts`'s pattern of resolving a
 * BullMQ primitive directly rather than driving it through the live 60-
 * second scheduler) to exercise Story 17's own reaction in isolation from
 * Story 15's detection cadence — Story 15's own detection logic is already
 * covered by its own suites. Resolves `PrismaService` directly (the same
 * documented exception `ticket-recategorization.e2e-spec.ts` already
 * established: no HTTP endpoint exposes `SlaEscalation` rows, by design —
 * this story adds none) to assert on persisted `SlaEscalation` rows, and
 * listens on the real `EventEmitter2` (`tickets.e2e-spec.ts`'s exact
 * `eventEmitter.on(...)` pattern) to observe `ticket.escalated` firing for
 * real.
 */
describe("SLA Breach Escalation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
  let adminAccessToken: string;
  let adminBranchId: string;
  const escalatedEvents: TicketEscalatedEvent[] = [];

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

    eventEmitter.on("ticket.escalated", (payload: TicketEscalatedEvent) => escalatedEvents.push(payload));

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
      .send({ displayName: `SLA breach escalation e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "SLA breach escalation e2e ticket" })
      .expect(201);
    return ticket.body.id;
  }

  async function waitForEscalationRows(
    ticketId: string,
    targetAt: Date,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ) {
    const deadline = Date.now() + timeoutMs;
    let rows: Awaited<ReturnType<typeof prisma.slaEscalation.findMany>> = [];
    do {
      rows = await prisma.slaEscalation.findMany({
        where: { ticketId, targetType: "response", targetAt },
      });
      if (rows.length > 0) {
        return rows;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    return rows;
  }

  async function waitForTicketEscalatedEvent(
    ticketId: string,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<TicketEscalatedEvent | undefined> {
    const deadline = Date.now() + timeoutMs;
    let found = escalatedEvents.find((event) => event.ticket.id === ticketId);
    while (!found && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      found = escalatedEvents.find((event) => event.ticket.id === ticketId);
    }
    return found;
  }

  it("persists an SlaEscalation row and emits ticket.escalated for a real sla.breached transition", async () => {
    const ticketId = await createTicket();
    const targetAt = new Date("2026-01-01T00:00:00.000Z");

    eventEmitter.emit(SLA_BREACHED_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt,
    });

    const rows = await waitForEscalationRows(ticketId, targetAt);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.branchId).toBe(adminBranchId);

    const escalated = await waitForTicketEscalatedEvent(ticketId);
    expect(escalated).toBeDefined();
    expect(escalated?.ticket.id).toBe(ticketId);
    expect(escalated?.actorUserId).toBeNull();
  });

  it("does not persist a second row or emit a second ticket.escalated for a duplicate delivery of the same transition", async () => {
    const ticketId = await createTicket();
    const targetAt = new Date("2026-01-02T00:00:00.000Z");

    eventEmitter.emit(SLA_BREACHED_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt,
    });
    await waitForEscalationRows(ticketId, targetAt);
    await waitForTicketEscalatedEvent(ticketId);
    const countAfterFirst = escalatedEvents.filter((event) => event.ticket.id === ticketId).length;

    eventEmitter.emit(SLA_BREACHED_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt,
    });
    // The duplicate is expected to produce nothing — give it a moment to
    // (not) land rather than asserting instantaneously.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const rows = await prisma.slaEscalation.findMany({
      where: { ticketId, targetType: "response", targetAt },
    });
    expect(rows).toHaveLength(1);
    expect(escalatedEvents.filter((event) => event.ticket.id === ticketId)).toHaveLength(countAfterFirst);
  });

  it("treats a different targetAt for the same ticket/targetType as a new, independent escalation", async () => {
    const ticketId = await createTicket();
    const firstTargetAt = new Date("2026-01-03T00:00:00.000Z");
    const secondTargetAt = new Date("2026-01-03T01:00:00.000Z");

    eventEmitter.emit(SLA_BREACHED_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt: firstTargetAt,
    });
    await waitForEscalationRows(ticketId, firstTargetAt);

    eventEmitter.emit(SLA_BREACHED_EVENT, {
      ticketId,
      branchId: adminBranchId,
      targetType: "response",
      targetAt: secondTargetAt,
    });
    const secondRows = await waitForEscalationRows(ticketId, secondTargetAt);
    expect(secondRows).toHaveLength(1);

    const allRowsForTicket = await prisma.slaEscalation.findMany({
      where: { ticketId, targetType: "response" },
    });
    expect(allRowsForTicket).toHaveLength(2);
  });
});
