import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import request from "supertest";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { RedisIoAdapter } from "../src/realtime/redis-io.adapter";
import { SLA_AT_RISK_EVENT, SLA_BREACHED_EVENT } from "../src/modules/sla-policies/sla-detection.events";
import type { SlaAtRiskEvent, SlaBreachedEvent } from "../src/modules/sla-policies/sla-detection.events";
import { TICKET_ESCALATED_EVENT } from "../src/modules/tickets/tickets.events";
import type { TicketEscalatedEvent } from "../src/modules/tickets/tickets.events";

/**
 * Integration suite for Story 22 — In-App Notification Delivery.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, `app.listen(0)`
 * for a real bound port, and a real `socket.io-client` — the same shape
 * `realtime-socketio-foundation.e2e-spec.ts` (Story 20) already established.
 * `moduleRef.get(EventEmitter2)` is used to emit real events directly
 * rather than driving the full upstream SLA-timer/escalation chain, matching
 * `ticket-escalation-notification.e2e-spec.ts`'s own "emit directly, don't
 * drive the whole chain" convention.
 *
 * Known scope limit, same as `tickets.e2e-spec.ts`: `prisma/seed.ts` creates
 * exactly one `Branch`, so this suite cannot authenticate two agents in two
 * real, distinct branches. The isolation scenario below instead emits an
 * event carrying a different, unrelated `branchId` than the one the
 * connected client actually joined, and asserts nothing arrives — the same
 * mechanism (room selection) a true second branch would exercise. True
 * branch-isolation at the *authorization* layer (can a socket join another
 * branch's room at all) is already covered, unmodified, by
 * `realtime.gateway.spec.ts` (Story 20).
 */
describe("In-App Notification Delivery (e2e)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let eventEmitter: EventEmitter2;
  let adminAccessToken: string;
  let adminBranchId: string;
  let baseUrl: string;
  const clients: Socket[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    eventEmitter = moduleRef.get(EventEmitter2);

    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);

    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;

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

  afterEach(() => {
    clients.forEach((client) => client.disconnect());
    clients.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  function connect(token?: string): Socket {
    const client = io(baseUrl, {
      auth: token !== undefined ? { token } : {},
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
    });
    clients.push(client);
    return client;
  }

  function waitForConnect(client: Socket, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for connect")), timeoutMs);
      client.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  function waitForEvent<T>(client: Socket, event: string, timeoutMs = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for "${event}"`)),
        timeoutMs,
      );
      client.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  function join(client: Socket, room: string): Promise<{ ok: boolean }> {
    return new Promise((resolve) => {
      client.emit("join", { room }, resolve);
    });
  }

  async function connectAndJoinOwnBranch(): Promise<Socket> {
    const client = connect(adminAccessToken);
    await waitForConnect(client);
    const ack = await join(client, `branch:${adminBranchId}:notifications`);
    expect(ack).toEqual({ ok: true });
    return client;
  }

  async function createTicket(): Promise<{ id: string }> {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Notification delivery e2e customer ${randomUUID()}` })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "Notification delivery e2e ticket" })
      .expect(201);

    return { id: created.body.id as string };
  }

  it("relays a real sla.at_risk event into the caller's own branch:{id}:notifications room", async () => {
    // Uses a real ticket id (not a synthetic one) so the sibling listeners
    // that also react to `sla.at_risk` (`SlaAtRiskNotificationListener`,
    // `SlaEscalationListener`'s own `sla.breached` counterpart) can persist
    // their own rows without an unrelated foreign-key failure — this
    // story's relay is independent of them either way (Design item 5), but
    // a real ticket id keeps this suite's own output free of unrelated,
    // harmless-but-noisy error logs.
    const ticket = await createTicket();
    const client = await connectAndJoinOwnBranch();
    const received = waitForEvent<SlaAtRiskEvent>(client, SLA_AT_RISK_EVENT);

    const event: SlaAtRiskEvent = {
      ticketId: ticket.id,
      branchId: adminBranchId,
      targetType: "response",
      targetAt: new Date(),
    };
    eventEmitter.emit(SLA_AT_RISK_EVENT, event);

    const payload = await received;
    expect(payload.ticketId).toBe(event.ticketId);
    expect(payload.branchId).toBe(adminBranchId);
  });

  it("relays a real sla.breached event into the caller's own branch:{id}:notifications room", async () => {
    const ticket = await createTicket();
    const client = await connectAndJoinOwnBranch();
    const received = waitForEvent<SlaBreachedEvent>(client, SLA_BREACHED_EVENT);

    const event: SlaBreachedEvent = {
      ticketId: ticket.id,
      branchId: adminBranchId,
      targetType: "resolution",
      targetAt: new Date(),
    };
    eventEmitter.emit(SLA_BREACHED_EVENT, event);

    const payload = await received;
    expect(payload.ticketId).toBe(event.ticketId);
    expect(payload.branchId).toBe(adminBranchId);
  });

  it("relays a real ticket.escalated event into the caller's own branch:{id}:notifications room", async () => {
    const ticket = await createTicket();
    const client = await connectAndJoinOwnBranch();
    const received = waitForEvent<TicketEscalatedEvent>(client, TICKET_ESCALATED_EVENT);

    const event: TicketEscalatedEvent = {
      ticket: {
        id: ticket.id,
        subject: "Notification delivery e2e ticket",
        category: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "unused-in-this-assertion",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      },
      actorUserId: null,
    };
    eventEmitter.emit(TICKET_ESCALATED_EVENT, event);

    const payload = await received;
    expect(payload.ticket.id).toBe(ticket.id);
  });

  it("does not deliver an event carrying a different branch id (isolation proxy)", async () => {
    const ticket = await createTicket();
    const client = await connectAndJoinOwnBranch();
    const received = waitForEvent<SlaAtRiskEvent>(client, SLA_AT_RISK_EVENT, 1000);

    eventEmitter.emit(SLA_AT_RISK_EVENT, {
      ticketId: ticket.id,
      branchId: randomUUID(),
      targetType: "response",
      targetAt: new Date(),
    } satisfies SlaAtRiskEvent);

    await expect(received).rejects.toThrow('timed out waiting for "sla.at_risk"');
  });
});
