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
import { TICKET_UPDATED_EVENT, TICKET_ESCALATED_EVENT } from "../src/modules/tickets/tickets.events";
import type { TicketUpdatedEvent, TicketEscalatedEvent } from "../src/modules/tickets/tickets.events";

/**
 * Integration suite for Story 20 — Realtime / Socket.IO Foundation.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, exactly like
 * `ticket-escalation-notification.e2e-spec.ts`'s login-and-create-ticket
 * setup. Unlike every prior e2e suite in this codebase, this one also calls
 * `app.listen(0)` for a real bound port (plan Design item 3) — a Socket.IO
 * connection needs a live TCP socket, not just an unlistened `http.Server`
 * wrapped by `supertest`.
 */
describe("Realtime / Socket.IO Foundation (e2e)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let eventEmitter: EventEmitter2;
  let adminAccessToken: string;
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

  function waitForDisconnect(client: Socket, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for disconnect")), timeoutMs);
      client.once("disconnect", () => {
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

  async function createTicket(): Promise<{ id: string }> {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Realtime e2e customer ${randomUUID()}` })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: customer.body.id, subject: "Realtime e2e ticket" })
      .expect(201);

    return { id: created.body.id as string };
  }

  it("disconnects a connection with no token before any join is possible", async () => {
    const client = connect();

    await waitForDisconnect(client);

    expect(client.connected).toBe(false);
  });

  it("allows joining ticket:{id} for a ticket in the caller's own branch and relays a real ticket.updated event", async () => {
    const ticket = await createTicket();
    const client = connect(adminAccessToken);
    await waitForConnect(client);

    const ack = await join(client, `ticket:${ticket.id}`);
    expect(ack).toEqual({ ok: true });

    const received = waitForEvent<TicketUpdatedEvent>(client, TICKET_UPDATED_EVENT);

    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ subject: "Realtime e2e ticket (updated)" })
      .expect(200);

    const payload = await received;
    expect(payload.ticket.id).toBe(ticket.id);
    expect(payload.ticket.subject).toBe("Realtime e2e ticket (updated)");
  });

  it("denies joining ticket:{id} for a ticket that does not exist", async () => {
    const client = connect(adminAccessToken);
    await waitForConnect(client);

    const ack = await join(client, `ticket:${randomUUID()}`);

    expect(ack).toEqual({ ok: false });
  });

  it("relays a real ticket.escalated event into a joined ticket:{id} room", async () => {
    const ticket = await createTicket();
    const client = connect(adminAccessToken);
    await waitForConnect(client);
    await join(client, `ticket:${ticket.id}`);

    const received = waitForEvent<TicketEscalatedEvent>(client, TICKET_ESCALATED_EVENT);

    eventEmitter.emit(TICKET_ESCALATED_EVENT, {
      ticket: {
        id: ticket.id,
        subject: "Realtime e2e ticket",
        category: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: "unused-in-this-assertion",
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
      },
      actorUserId: null,
    } satisfies TicketEscalatedEvent);

    const payload = await received;
    expect(payload.ticket.id).toBe(ticket.id);
  });

  it(
    "fans a relayed event out across two app instances via the Redis adapter",
    async () => {
      // A second, independent AppModule instance, its own gateway, its own
      // RedisIoAdapter — connected to the SAME real Redis as `app`. Follows
      // `sla-timers-producer.e2e-spec.ts`'s own two-real-instance-against-
      // real-Redis shape.
      const moduleRefB = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const appB = moduleRefB.createNestApplication();
      const eventEmitterB = moduleRefB.get(EventEmitter2);
      const redisIoAdapterB = new RedisIoAdapter(appB);
      await redisIoAdapterB.connectToRedis();
      appB.useWebSocketAdapter(redisIoAdapterB);
      await appB.init();
      await appB.listen(0);

      try {
        const ticket = await createTicket();

        // Client connects to instance A only (this suite's own `app`).
        const clientA = connect(adminAccessToken);
        await waitForConnect(clientA);
        await join(clientA, `ticket:${ticket.id}`);

        const received = waitForEvent<TicketUpdatedEvent>(clientA, TICKET_UPDATED_EVENT);

        // Emitted on instance B's own EventEmitter2 — instance A's socket
        // only receives this if the Redis adapter is actually fanning
        // events out across instances, not merely broadcasting within
        // instance B's own in-memory Socket.IO rooms (which have no
        // connected sockets at all).
        eventEmitterB.emit(TICKET_UPDATED_EVENT, {
          ticket: {
            id: ticket.id,
            subject: "cross-instance relay",
            category: null,
            priority: "MEDIUM",
            status: "OPEN",
            customerId: "unused-in-this-assertion",
            contactId: null,
            departmentId: null,
            assignedToUserId: null,
          },
          actorUserId: null,
        } satisfies TicketUpdatedEvent);

        const payload = await received;
        expect(payload.ticket.id).toBe(ticket.id);
        expect(payload.ticket.subject).toBe("cross-instance relay");
      } finally {
        await appB.close();
      }
    },
    20_000,
  );
});
