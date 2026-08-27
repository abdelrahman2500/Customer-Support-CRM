import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TICKET_ESCALATED_EVENT } from "../src/modules/tickets/tickets.events";
import type { TicketEscalatedEvent } from "../src/modules/tickets/tickets.events";

/**
 * Integration suite for Story 19 — ticket escalation notification reaction.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, exactly like
 * `sla-at-risk-notification.e2e-spec.ts`. Requires `DATABASE_URL`/
 * `REDIS_URL` pointed at a real, migrated, and SEEDED database.
 *
 * Emits `ticket.escalated` directly on the real, compiled `EventEmitter2`
 * (the same pattern `sla-at-risk-notification.e2e-spec.ts`/
 * `sla-breach-escalation.e2e-spec.ts` already established) to prove this
 * story's own reaction against a real event, per the intake's own
 * instruction, rather than driving the full
 * `sla.breached → sla.escalated → ticket.escalated` chain. Resolves
 * `PrismaService` directly (the same documented exception those suites
 * already established: no HTTP endpoint exposes `NotificationLog` rows) to
 * assert on persisted rows.
 */
describe("Ticket Escalation Notification Reaction (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
  let adminAccessToken: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  /** Creates a real ticket and returns its real `TicketSummary` shape (via `GET /tickets/:id`). */
  async function createTicketEscalatedEvent(): Promise<TicketEscalatedEvent> {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Ticket escalation notification e2e customer ${randomUUID()}` })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "Ticket escalation notification e2e ticket" })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${created.body.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    return { ticket: ticket.body, actorUserId: null };
  }

  async function waitForNotificationLogRows(
    ticketId: string,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ) {
    const deadline = Date.now() + timeoutMs;
    let rows: Awaited<ReturnType<typeof prisma.notificationLog.findMany>> = [];
    do {
      rows = await prisma.notificationLog.findMany({
        where: { eventType: TICKET_ESCALATED_EVENT, dedupeKey: ticketId },
      });
      if (rows.length > 0) {
        return rows;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    return rows;
  }

  it("persists a NotificationLog row for a real ticket.escalated event", async () => {
    const event = await createTicketEscalatedEvent();

    eventEmitter.emit(TICKET_ESCALATED_EVENT, event);

    const rows = await waitForNotificationLogRows(event.ticket.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventType).toBe(TICKET_ESCALATED_EVENT);
    expect(rows[0]?.ticketId).toBe(event.ticket.id);
    expect(rows[0]?.dedupeKey).toBe(event.ticket.id);
    // SLA-shaped columns are not part of this event's payload — confirmed left null.
    expect(rows[0]?.branchId).toBeNull();
    expect(rows[0]?.targetType).toBeNull();
    expect(rows[0]?.targetAt).toBeNull();
  });

  it("does not persist a second row for a duplicate delivery of the same event", async () => {
    const event = await createTicketEscalatedEvent();

    eventEmitter.emit(TICKET_ESCALATED_EVENT, event);
    await waitForNotificationLogRows(event.ticket.id);

    eventEmitter.emit(TICKET_ESCALATED_EVENT, event);
    // The duplicate is expected to produce nothing — give it a moment to
    // (not) land rather than asserting instantaneously.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const rows = await prisma.notificationLog.findMany({
      where: { eventType: TICKET_ESCALATED_EVENT, dedupeKey: event.ticket.id },
    });
    expect(rows).toHaveLength(1);
  });
});
