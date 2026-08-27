import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TICKET_ESCALATED_EVENT } from "../src/modules/tickets/tickets.events";
import type {
  TicketCreatedEvent,
  TicketUpdatedEvent,
  TicketEscalatedEvent,
} from "../src/modules/tickets/tickets.events";

/**
 * Integration suite for the `tickets/*` HTTP surface.
 *
 * Bootstraps the REAL `AppModule` — same guards
 * (`AuthGuard`/`PermissionsGuard`/`ThrottlerGuard`), same `AuditInterceptor`,
 * same `TenantMiddleware`, same global `ValidationPipe`/prefix as
 * `src/main.ts` — against a REAL Postgres/Redis, exactly like
 * `customers.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL` pointed at a
 * real, migrated, and SEEDED database. Logs in as the seed's bootstrap admin
 * and builds its `Customer`/`Contact` fixtures through the real Customer
 * Management API (`POST /api/v1/customers`, `POST /api/v1/customers/:id/contacts`)
 * — not a direct DB insert — exactly as this story's plan requires.
 *
 * Known scope limit, same as `customers.e2e-spec.ts`: `prisma/seed.ts`
 * creates exactly one Branch, so this suite cannot exercise true
 * cross-branch isolation end-to-end. The "wrong owner"/"foreign id" cases
 * below (a contact belonging to a different customer, a random unknown
 * department/user id) stand in for that and are the realistic failure
 * shapes this branch *can* produce; true cross-branch rejection is covered
 * by `tickets.service.spec.ts`'s mocked-TenantContext tests instead.
 *
 * Two assertions below (in the "creates a ticket..." and "updates status
 * and priority" tests) additionally listen on the REAL `EventEmitter2`
 * resolved from this compiled module's DI container — proving
 * `EventEmitterModule.forRoot()` is actually registered and that
 * `TicketsService` actually receives a working `EventEmitter2`, which the
 * mocked-`EventEmitter2` unit tests in `tickets.service.spec.ts` cannot
 * prove on their own (Story 08's plan, "E2E verification — is it
 * justified?"). No other scenario in this file changed.
 */
describe("Ticketing (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let adminUserId: string;
  let customerId: string;
  let otherCustomerId: string;
  let contactId: string;
  let ticketId: string;
  let eventEmitter: EventEmitter2;
  const createdEvents: TicketCreatedEvent[] = [];
  const updatedEvents: TicketUpdatedEvent[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();

    eventEmitter = moduleRef.get(EventEmitter2);
    eventEmitter.on("ticket.created", (payload: TicketCreatedEvent) => createdEvents.push(payload));
    eventEmitter.on("ticket.updated", (payload: TicketUpdatedEvent) => updatedEvents.push(payload));

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

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Ticketing Fixture Customer ${randomUUID()}` })
      .expect(201);
    customerId = customer.body.id;

    const otherCustomer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Ticketing Fixture Other Customer ${randomUUID()}` })
      .expect(201);
    otherCustomerId = otherCustomer.body.id;

    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Jane Doe", email: `jane-${randomUUID()}@example.com` })
      .expect(201);
    contactId = contact.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/tickets").expect(401);
  });

  it("rejects ticket creation with an unknown customerId with 404", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: randomUUID(), subject: "Should not be created" })
      .expect(404);
  });

  it("rejects ticket creation when the contact belongs to a different customer with 404", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId: otherCustomerId, contactId, subject: "Wrong-owner contact" })
      .expect(404);
  });

  it("rejects ticket creation with an unknown departmentId with 404", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, departmentId: randomUUID(), subject: "Unknown department" })
      .expect(404);
  });

  it("rejects ticket creation with an unknown assignedToUserId with 404", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, assignedToUserId: randomUUID(), subject: "Unknown assignee" })
      .expect(404);
  });

  it("rejects an empty subject with a validation error", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, subject: "" })
      .expect(400);
  });

  it("creates a ticket referencing the customer and contact, defaulting status/priority", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, contactId, subject: "Cannot log in" })
      .expect(201);

    expect(response.body.customerId).toBe(customerId);
    expect(response.body.contactId).toBe(contactId);
    expect(response.body.status).toBe("OPEN");
    expect(response.body.priority).toBe("MEDIUM");
    ticketId = response.body.id;

    expect(createdEvents.some((event) => event.ticket.id === ticketId)).toBe(true);
  });

  it("records exactly one history entry after ticket creation, with actor and snapshot", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/history`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].eventType).toBe("ticket.created");
    expect(response.body[0].actorUserId).toBe(adminUserId);
    expect(response.body[0].snapshot.id).toBe(ticketId);
  });

  it("lists tickets in the caller's active branch, including the new one", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ids = response.body.map((ticket: { id: string }) => ticket.id);
    expect(ids).toContain(ticketId);
  });

  it("gets a single ticket", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.id).toBe(ticketId);
  });

  it("returns 404 for an unknown ticket id", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("updates status and priority", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "IN_PROGRESS", priority: "HIGH" })
      .expect(200);

    expect(response.body.id).toBe(ticketId);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(after.body.status).toBe("IN_PROGRESS");
    expect(after.body.priority).toBe("HIGH");

    expect(
      updatedEvents.some(
        (event) =>
          event.ticket.id === ticketId &&
          event.ticket.status === "IN_PROGRESS" &&
          event.ticket.priority === "HIGH",
      ),
    ).toBe(true);
  });

  it("records a second and third history entry — ticket.updated and ticket.recategorized — after a priority-changing update", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/history`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    // `TicketsService.updateTicket` emits `ticket.updated` and (since this
    // update changes `priority`) `ticket.recategorized` via two independent,
    // unawaited `EventEmitter2.emit(...)` calls — nothing in the codebase
    // synchronizes the order in which their two separate async
    // `TicketHistoryListener` writes actually commit, so their relative
    // `createdAt` order is not a guarantee this test can assert on (verified
    // empirically: reproducibly `ticket.recategorized` before
    // `ticket.updated` under the current listener set, not the emission
    // order). Only `ticket.created` (the sole entry from a prior,
    // already-completed request) has a guaranteed position.
    expect(response.body).toHaveLength(3);
    expect(response.body[0].eventType).toBe("ticket.created");

    const updatedEntry = response.body.find(
      (entry: { eventType: string }) => entry.eventType === "ticket.updated",
    );
    expect(updatedEntry).toBeDefined();
    expect(updatedEntry.actorUserId).toBe(adminUserId);
    expect(updatedEntry.snapshot.status).toBe("IN_PROGRESS");
    expect(updatedEntry.snapshot.priority).toBe("HIGH");

    const recategorizedEntry = response.body.find(
      (entry: { eventType: string }) => entry.eventType === "ticket.recategorized",
    );
    expect(recategorizedEntry).toBeDefined();
    expect(recategorizedEntry.actorUserId).toBe(adminUserId);
    expect(recategorizedEntry.snapshot.priority).toBe("HIGH");
  });

  it("records a ticket.escalated history entry for a real, directly-emitted event", async () => {
    const ticket = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const escalatedEvent: TicketEscalatedEvent = { ticket: ticket.body, actorUserId: null };
    eventEmitter.emit(TICKET_ESCALATED_EVENT, escalatedEvent);

    const deadline = Date.now() + 5000;
    let history: Array<{ eventType: string }> = [];
    do {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/history`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      history = response.body;
      if (history.some((entry) => entry.eventType === TICKET_ESCALATED_EVENT)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);

    const escalatedEntry = history.find((entry) => entry.eventType === TICKET_ESCALATED_EVENT);
    expect(escalatedEntry).toBeDefined();
  });

  it("returns 404 for history on an unknown ticket id", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${randomUUID()}/history`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("rejects an unauthenticated request for ticket history", async () => {
    await request(app.getHttpServer()).get(`/api/v1/tickets/${ticketId}/history`).expect(401);
  });

  it("rejects reassignment to an unknown user id with 404", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ assignedToUserId: randomUUID() })
      .expect(404);
  });

  it("assigns the ticket to an in-branch user (the admin)", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ assignedToUserId: adminUserId })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(after.body.assignedToUserId).toBe(adminUserId);
  });

  it("rejects an Agent-role user attempting to create a ticket (403)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent",
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
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ customerId, subject: "Should not be created" })
      .expect(403);
  });

  it("rejects an Agent-role user attempting to read tickets (403)", async () => {
    const agentEmail = `agent-read-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Read",
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
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
  });

  it("rejects an Agent-role user attempting to read ticket history (403)", async () => {
    const agentEmail = `agent-history-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent History",
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
      .get(`/api/v1/tickets/${ticketId}/history`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
  });
});
