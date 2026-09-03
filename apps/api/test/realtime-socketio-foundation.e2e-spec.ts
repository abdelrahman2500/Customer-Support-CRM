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
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../src/modules/channels/channel-messages.events";
import type { ChannelMessageCreatedEvent } from "../src/modules/channels/channel-messages.events";

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
  let adminUserId: string;
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
    adminUserId = me.body.id;
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

  async function createTicket(): Promise<{ id: string; customerId: string }> {
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

    return { id: created.body.id as string, customerId: customer.body.id as string };
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
        categoryId: null,
        categoryName: null,
        priority: "MEDIUM",
        status: "OPEN",
        customerId: ticket.customerId,
        contactId: null,
        departmentId: null,
        assignedToUserId: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      },
      actorUserId: null,
    } satisfies TicketEscalatedEvent);

    const payload = await received;
    expect(payload.ticket.id).toBe(ticket.id);
  });

  // ---------------------------------------------------------------------
  // Story 71 — Agent Presence. Reuses this file's own `connect`/`join`/
  // `waitForEvent` helpers and the same real Postgres/Redis/Socket.IO
  // infrastructure. Known scope limit, same as every sibling e2e suite:
  // `prisma/seed.ts` creates exactly one Branch, so cross-branch presence
  // denial cannot be exercised end-to-end here — that case is covered by
  // `realtime.gateway.spec.ts`'s mocked-Prisma tests instead.
  // ---------------------------------------------------------------------
  describe("agent presence", () => {
    let secondAgentAccessToken: string;

    beforeAll(async () => {
      const roles = await request(app.getHttpServer())
        .get("/api/v1/identity/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

      const me = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const secondAgentEmail = `presence-watcher-${randomUUID()}@example.com`;
      const secondAgentPassword = "presence-watcher-test-password-123";
      await request(app.getHttpServer())
        .post("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          email: secondAgentEmail,
          password: secondAgentPassword,
          fullName: "Presence Watcher",
          branchId: me.body.branchId,
          departmentId: me.body.departmentId ?? undefined,
          roleId: agentRole.id,
        })
        .expect(201);

      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: secondAgentEmail, password: secondAgentPassword })
        .expect(200);
      secondAgentAccessToken = login.body.accessToken;
    });

    it("tells a fresh joiner the current (offline) status before the watched agent ever connects", async () => {
      const watcher = connect(secondAgentAccessToken);
      await waitForConnect(watcher);

      const received = waitForEvent<{ userId: string; status: string }>(
        watcher,
        "agent.presence.changed",
      );
      const ack = await join(watcher, `agent:${adminUserId}:presence`);
      expect(ack).toEqual({ ok: true });

      const payload = await received;
      expect(payload).toEqual({ userId: adminUserId, status: "offline" });
    });

    it("broadcasts online when the watched agent connects, and offline when they disconnect", async () => {
      const watcher = connect(secondAgentAccessToken);
      await waitForConnect(watcher);
      await join(watcher, `agent:${adminUserId}:presence`);

      const wentOnline = waitForEvent<{ userId: string; status: string }>(
        watcher,
        "agent.presence.changed",
      );
      const watched = connect(adminAccessToken);
      await waitForConnect(watched);
      expect(await wentOnline).toEqual({ userId: adminUserId, status: "online" });

      const wentOffline = waitForEvent<{ userId: string; status: string }>(
        watcher,
        "agent.presence.changed",
      );
      watched.disconnect();
      expect(await wentOffline).toEqual({ userId: adminUserId, status: "offline" });
    });

    it("allows a same-branch colleague to join another agent's presence room", async () => {
      const watcher = connect(secondAgentAccessToken);
      await waitForConnect(watcher);

      const ack = await join(watcher, `agent:${adminUserId}:presence`);

      expect(ack).toEqual({ ok: true });
    });

    it("always allows an agent to join their own presence room", async () => {
      const client = connect(adminAccessToken);
      await waitForConnect(client);

      const ack = await join(client, `agent:${adminUserId}:presence`);

      expect(ack).toEqual({ ok: true });
    });
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
            categoryId: null,
            categoryName: null,
            priority: "MEDIUM",
            status: "OPEN",
            customerId: ticket.customerId,
            contactId: null,
            departmentId: null,
            assignedToUserId: null,
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            updatedAt: new Date("2024-01-01T00:00:00.000Z"),
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

  // ---------------------------------------------------------------------
  // Story 77 — Customer Portal Live Chat. Decided V1 scope: authenticated
  // Customer Portal users only. Reuses this file's own `connect`/`join`/
  // `waitForEvent` helpers and the same real Postgres/Redis/Socket.IO
  // infrastructure — no new gateway, no new namespace.
  // ---------------------------------------------------------------------
  describe("customer portal live chat", () => {
    let customerId: string;
    let contactId: string;
    let contactAccessToken: string;
    let otherCustomerContactAccessToken: string;
    let ticketId: string;
    const portalPassword = "a-strong-portal-password-1";

    beforeAll(async () => {
      const customer = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `Realtime Live Chat Customer ${randomUUID()}` })
        .expect(201);
      customerId = customer.body.id;

      const contactEmail = `realtime-live-chat-${randomUUID()}@example.com`;
      const contact = await request(app.getHttpServer())
        .post(`/api/v1/customers/${customerId}/contacts`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ fullName: "Realtime Live Chat Contact", email: contactEmail })
        .expect(201);
      contactId = contact.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ newPassword: portalPassword })
        .expect(200);

      const contactLogin = await request(app.getHttpServer())
        .post("/api/v1/portal/auth/login")
        .send({ email: contactEmail, password: portalPassword })
        .expect(200);
      contactAccessToken = contactLogin.body.accessToken;

      const ticket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, contactId, subject: "Realtime Live Chat ticket" })
        .expect(201);
      ticketId = ticket.body.id;

      // A second, unrelated customer/contact — used only to prove
      // cross-customer room-join denial.
      const otherCustomer = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `Realtime Live Chat Other Customer ${randomUUID()}` })
        .expect(201);
      const otherContactEmail = `realtime-live-chat-other-${randomUUID()}@example.com`;
      const otherContact = await request(app.getHttpServer())
        .post(`/api/v1/customers/${otherCustomer.body.id}/contacts`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ fullName: "Realtime Live Chat Other Contact", email: otherContactEmail })
        .expect(201);
      await request(app.getHttpServer())
        .patch(
          `/api/v1/customers/${otherCustomer.body.id}/contacts/${otherContact.body.id}/portal-password`,
        )
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ newPassword: portalPassword })
        .expect(200);
      const otherContactLogin = await request(app.getHttpServer())
        .post("/api/v1/portal/auth/login")
        .send({ email: otherContactEmail, password: portalPassword })
        .expect(200);
      otherCustomerContactAccessToken = otherContactLogin.body.accessToken;
    });

    it("accepts a customer-audience connection (rejected before Story 77)", async () => {
      const client = connect(contactAccessToken);

      await waitForConnect(client);

      expect(client.connected).toBe(true);
    });

    it("allows the ticket's own customer to join ticket:{id}", async () => {
      const client = connect(contactAccessToken);
      await waitForConnect(client);

      const ack = await join(client, `ticket:${ticketId}`);

      expect(ack).toEqual({ ok: true });
    });

    it("denies a different customer joining ticket:{id}", async () => {
      const client = connect(otherCustomerContactAccessToken);
      await waitForConnect(client);

      const ack = await join(client, `ticket:${ticketId}`);

      expect(ack).toEqual({ ok: false });
    });

    it("denies a customer joining branch:{id}:notifications", async () => {
      const client = connect(contactAccessToken);
      await waitForConnect(client);

      const ack = await join(client, `branch:${adminUserId}:notifications`);

      expect(ack).toEqual({ ok: false });
    });

    it("denies a customer joining agent:{id}:presence", async () => {
      const client = connect(contactAccessToken);
      await waitForConnect(client);

      const ack = await join(client, `agent:${adminUserId}:presence`);

      expect(ack).toEqual({ ok: false });
    });

    it("relays a real channel.message.created event to both an agent and the ticket's own customer sharing ticket:{id}", async () => {
      const agentClient = connect(adminAccessToken);
      const customerClient = connect(contactAccessToken);
      await Promise.all([waitForConnect(agentClient), waitForConnect(customerClient)]);
      await join(agentClient, `ticket:${ticketId}`);
      await join(customerClient, `ticket:${ticketId}`);

      const agentReceived = waitForEvent<ChannelMessageCreatedEvent>(
        agentClient,
        CHANNEL_MESSAGE_CREATED_EVENT,
      );
      const customerReceived = waitForEvent<ChannelMessageCreatedEvent>(
        customerClient,
        CHANNEL_MESSAGE_CREATED_EVENT,
      );

      await request(app.getHttpServer())
        .post(`/api/v1/portal/tickets/${ticketId}/messages`)
        .set("Authorization", `Bearer ${contactAccessToken}`)
        .send({ body: "Hi, I need help with my order" })
        .expect(201);

      const [agentPayload, customerPayload] = await Promise.all([agentReceived, customerReceived]);
      expect(agentPayload.message.body).toBe("Hi, I need help with my order");
      expect(customerPayload.message.body).toBe("Hi, I need help with my order");
    });

    // The critical leak-prevention proof: an internal-only event (a Story
    // 50 internal note) must reach an agent sharing ticket:{id} exactly as
    // before, but must NEVER reach a customer sharing the same room.
    it("relays ticket.note-added to an agent but never to a customer sharing the same ticket:{id} room", async () => {
      const agentClient = connect(adminAccessToken);
      const customerClient = connect(contactAccessToken);
      await Promise.all([waitForConnect(agentClient), waitForConnect(customerClient)]);
      await join(agentClient, `ticket:${ticketId}`);
      await join(customerClient, `ticket:${ticketId}`);

      let customerReceivedAnything = false;
      customerClient.onAny(() => {
        customerReceivedAnything = true;
      });

      const agentReceived = waitForEvent<{ ticketId: string }>(agentClient, "ticket.note-added");

      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "Internal note: verified customer identity." })
        .expect(201);

      const agentPayload = await agentReceived;
      expect(agentPayload.ticketId).toBe(ticketId);

      // Give any (incorrect) delivery to the customer socket a moment to
      // arrive before asserting it never did.
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(customerReceivedAnything).toBe(false);
    });
  });
});
