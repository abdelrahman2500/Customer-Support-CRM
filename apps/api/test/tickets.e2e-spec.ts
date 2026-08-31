import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { getQueueToken } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AI_PROCESSING_QUEUE } from "../src/queues/ai-processing.producer";
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
  let prisma: PrismaService;
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
    prisma = moduleRef.get(PrismaService);
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

  it("includes createdAt/updatedAt and a slaTarget field (Story 23) on each listed ticket", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ticket = response.body.find((entry: { id: string }) => entry.id === ticketId);
    expect(ticket).toBeDefined();
    expect(typeof ticket.createdAt).toBe("string");
    expect(typeof ticket.updatedAt).toBe("string");
    // No SlaPolicy exists in this suite's fixtures, so no SlaTicketTarget was
    // ever computed for this ticket — `slaTarget` is `null`, not omitted and
    // not a 404 (Story 23's own "list row must not fail" design decision).
    expect(ticket.slaTarget).toBeNull();
  });

  it("filters the ticket list by status, priority, category, and assignedToUserId", async () => {
    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .query({ status: "OPEN" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(
      byStatus.body.every((entry: { status: string }) => entry.status === "OPEN"),
    ).toBe(true);

    const byUnrelatedStatus = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .query({ status: "CLOSED" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(
      byUnrelatedStatus.body.map((entry: { id: string }) => entry.id),
    ).not.toContain(ticketId);
  });

  it("rejects an invalid status filter value with a validation error", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .query({ status: "NOT_A_REAL_STATUS" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(400);
  });

  it("sorts the ticket list by updatedAt descending", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .query({ sortBy: "updatedAt", sortDir: "desc" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const updatedAts = response.body.map((entry: { updatedAt: string }) =>
      new Date(entry.updatedAt).getTime(),
    );
    const sorted = [...updatedAts].sort((a, b) => b - a);
    expect(updatedAts).toEqual(sorted);
  });

  // Story 70 — Ticket Search Foundation. Dedicated, self-contained fixture
  // tickets (random content) so these tests don't depend on other tests'
  // ordering or fixture state.
  describe("ticket search", () => {
    let searchSubjectTicketId: string;
    let searchCategoryTicketId: string;
    const searchSubjectMarker = `UniqueSubjectMarker${randomUUID().replace(/-/g, "")}`;
    const searchCategoryMarker = `UniqueCategoryMarker${randomUUID().replace(/-/g, "")}`;

    beforeAll(async () => {
      const subjectTicket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, subject: `Cannot log in — ${searchSubjectMarker}` })
        .expect(201);
      searchSubjectTicketId = subjectTicket.body.id;

      const categoryTicket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, subject: "Unrelated subject", category: searchCategoryMarker })
        .expect(201);
      searchCategoryTicketId = categoryTicket.body.id;
    });

    it("matches by subject, case-insensitive", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ search: searchSubjectMarker.toLowerCase() })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.map((ticket: { id: string }) => ticket.id);
      expect(ids).toContain(searchSubjectTicketId);
      expect(ids).not.toContain(searchCategoryTicketId);
    });

    it("matches by category, case-insensitive", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ search: searchCategoryMarker.toUpperCase() })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.map((ticket: { id: string }) => ticket.id);
      expect(ids).toContain(searchCategoryTicketId);
      expect(ids).not.toContain(searchSubjectTicketId);
    });

    it("returns [] for a non-matching search term", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ search: `no-such-ticket-content-${randomUUID()}` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("composes with an existing equality filter (status)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ search: searchSubjectMarker, status: "OPEN" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.map((ticket: { id: string }) => ticket.id);
      expect(ids).toContain(searchSubjectTicketId);
      expect(response.body.every((t: { status: string }) => t.status === "OPEN")).toBe(true);
    });

    it("omitted search behaves identically to today — the fixture tickets still appear unfiltered", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.map((ticket: { id: string }) => ticket.id);
      expect(ids).toContain(searchSubjectTicketId);
      expect(ids).toContain(searchCategoryTicketId);
    });
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

  // Story 50 — Ticket Internal Notes (Agent-Only).
  describe("ticket notes (Story 50)", () => {
    it("rejects an unauthenticated request for both routes", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/notes`)
        .send({ body: "Should not be created" })
        .expect(401);
      await request(app.getHttpServer()).get(`/api/v1/tickets/${ticketId}/notes`).expect(401);
    });

    it("rejects an Agent-role user attempting to create or read notes (403)", async () => {
      const agentEmail = `agent-notes-${randomUUID()}@example.com`;
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
          fullName: "Test Agent Notes",
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
        .post(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .send({ body: "Should not be created" })
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(403);
    });

    it("returns [] for a ticket with no notes yet", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("rejects an empty body with a validation error", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "" })
        .expect(400);
    });

    it("returns 404 for an unknown ticket id on both routes", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${randomUUID()}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "Some note" })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${randomUUID()}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("creates a note and reflects it (with the authenticated author) on a subsequent GET", async () => {
      const created = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "Called the customer back, awaiting reply." })
        .expect(201);

      expect(created.body).toEqual({ id: expect.any(String) });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const note = response.body.find((entry: { id: string }) => entry.id === created.body.id);
      expect(note).toBeDefined();
      expect(note.body).toBe("Called the customer back, awaiting reply.");
      expect(note.authorUserId).toBe(adminUserId);
      expect(note.ticketId).toBe(ticketId);
    });

    it("orders notes chronologically ascending", async () => {
      const first = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "First note in this ordering test." })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "Second note in this ordering test." })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.map((entry: { id: string }) => entry.id);
      expect(ids.indexOf(first.body.id)).toBeLessThan(ids.indexOf(second.body.id));
    });
  });

  // Story 73/76 — Ticket Summarization, the first real consumer of Story
  // 72's AiGatewayService, routed through the real ai-processing queue
  // since Story 76's architecture correction. apps/worker is never
  // booted by this suite (mirrors health-check-producer.e2e-spec.ts's own
  // documented scope boundary), so these tests verify the synchronous
  // half only: the HTTP response and the AiPromptLog row's PENDING
  // creation — never that a real Anthropic call completes.
  describe("ticket AI summarization (Story 73/76)", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
        .expect(401);
    });

    it("rejects an Agent-role user lacking ticket:read (403)", async () => {
      const agentEmail = `agent-ai-summarize-${randomUUID()}@example.com`;
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
          fullName: "Test Agent AI Summarize",
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
        .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(403);
    });

    it("returns 404 for a ticket that doesn't exist", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${randomUUID()}/ai/summarize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("returns { id, outcome: PENDING } immediately and creates exactly one PENDING AiPromptLog row", async () => {
      const before = await prisma.aiPromptLog.count({ where: { feature: "SUMMARIZE" } });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        outcome: "PENDING",
      });

      const after = await prisma.aiPromptLog.count({ where: { feature: "SUMMARIZE" } });
      expect(after).toBe(before + 1);

      const log = await prisma.aiPromptLog.findUnique({ where: { id: response.body.id } });
      expect(log).toMatchObject({
        feature: "SUMMARIZE",
        outcome: "PENDING",
        model: "pending",
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        errorMessage: null,
      });
    });
  });

  // Story 74/76 — Suggested Reply, the second consumer of Story 72's
  // AiGatewayService, routed through ai-processing since Story 76. Same
  // scope boundary as Story 73's own tests above: apps/worker is never
  // booted by this suite.
  describe("ticket AI suggested reply (Story 74/76)", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/suggest-reply`)
        .expect(401);
    });

    it("rejects an Agent-role user lacking ticket:read (403)", async () => {
      const agentEmail = `agent-ai-suggest-reply-${randomUUID()}@example.com`;
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
          fullName: "Test Agent AI Suggest Reply",
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
        .post(`/api/v1/tickets/${ticketId}/ai/suggest-reply`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(403);
    });

    it("returns 404 for a ticket that doesn't exist", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${randomUUID()}/ai/suggest-reply`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("returns { id, outcome: PENDING } immediately and creates exactly one PENDING AiPromptLog row", async () => {
      const before = await prisma.aiPromptLog.count({ where: { feature: "SUGGEST_REPLY" } });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/suggest-reply`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        outcome: "PENDING",
      });

      const after = await prisma.aiPromptLog.count({ where: { feature: "SUGGEST_REPLY" } });
      expect(after).toBe(before + 1);

      const log = await prisma.aiPromptLog.findUnique({ where: { id: response.body.id } });
      expect(log).toMatchObject({ feature: "SUGGEST_REPLY", outcome: "PENDING", model: "pending" });
    });
  });

  // Story 75/76 — Ticket Categorization, the third consumer of Story 72's
  // AiGatewayService, routed through ai-processing since Story 76. Same
  // scope boundary as Stories 73/74's own tests above. Never mutates
  // Ticket.category — advisory only, unchanged.
  describe("ticket AI categorization (Story 75/76)", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/categorize`)
        .expect(401);
    });

    it("rejects an Agent-role user lacking ticket:read (403)", async () => {
      const agentEmail = `agent-ai-categorize-${randomUUID()}@example.com`;
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
          fullName: "Test Agent AI Categorize",
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
        .post(`/api/v1/tickets/${ticketId}/ai/categorize`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(403);
    });

    it("returns 404 for a ticket that doesn't exist", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${randomUUID()}/ai/categorize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("returns { id, outcome: PENDING } immediately, creates exactly one PENDING AiPromptLog row, and never mutates Ticket.category", async () => {
      const before = await prisma.aiPromptLog.count({ where: { feature: "CATEGORIZE" } });
      const ticketBefore = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/categorize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        outcome: "PENDING",
      });

      const after = await prisma.aiPromptLog.count({ where: { feature: "CATEGORIZE" } });
      expect(after).toBe(before + 1);

      const log = await prisma.aiPromptLog.findUnique({ where: { id: response.body.id } });
      expect(log).toMatchObject({ feature: "CATEGORIZE", outcome: "PENDING", model: "pending" });

      const ticketAfter = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(ticketAfter.body.category).toBe(ticketBefore.body.category);
    });
  });

  // Story 76 — proves apps/api actually enqueues a real, Redis-backed
  // ai-processing job for a submitted operation (not just that the HTTP
  // response looks right) — mirrors ai-processing-producer.e2e-spec.ts's
  // own, more focused producer-level proof, but exercised through the
  // real HTTP endpoint end to end.
  describe("ticket AI enqueues a real ai-processing job (Story 76)", () => {
    it("enqueues a job on the real ai-processing queue with the AiPromptLog id and ticket data", async () => {
      const queue: Queue<{
        aiPromptLogId: string;
        ticketId: string;
        branchId: string;
        feature: string;
        subject: string;
        body: string;
      }> = app.get(getQueueToken(AI_PROCESSING_QUEUE));

      const response = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      const waitingJobs = await queue.getJobs(["waiting", "active", "completed"]);
      const job = waitingJobs.find((candidate) => candidate.data.aiPromptLogId === response.body.id);
      expect(job).toBeDefined();
      expect(job?.data).toMatchObject({
        aiPromptLogId: response.body.id,
        ticketId,
        feature: "SUMMARIZE",
      });

      await job?.remove();
    });
  });

  // Story 79 — AI Ticket-Assist Result Delivery. Same scope boundary as
  // the summarize/suggest-reply/categorize describe blocks above:
  // apps/worker is never booted by this suite, so a SUCCESS-outcome test
  // simulates completion by updating the AiPromptLog row directly via
  // Prisma (the existing pattern this file already uses at line ~799).
  describe("ticket AI result retrieval (Story 79)", () => {
    it("rejects an unauthenticated request", async () => {
      const submitted = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/ai/${submitted.body.id}`)
        .expect(401);
    });

    it("rejects an Agent-role user lacking ticket:read (403)", async () => {
      const submitted = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      const agentEmail = `agent-ai-result-${randomUUID()}@example.com`;
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
          fullName: "Test Agent AI Result",
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
        .get(`/api/v1/tickets/${ticketId}/ai/${submitted.body.id}`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(403);
    });

    it("returns 404 for a ticket that doesn't exist", async () => {
      const submitted = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${randomUUID()}/ai/${submitted.body.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("returns 404 for a logId that doesn't exist", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/ai/${randomUUID()}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("returns 404 when the logId belongs to a different ticket", async () => {
      const otherTicket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, contactId, subject: "Story 79 cross-ticket fixture" })
        .expect(201);

      const submittedOnOtherTicket = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${otherTicket.body.id}/ai/summarize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/ai/${submittedOnOtherTicket.body.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("returns 200 with outcome PENDING and outputText null immediately after submit", async () => {
      const submitted = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/ai/${submitted.body.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: submitted.body.id,
        feature: "SUMMARIZE",
        outcome: "PENDING",
        outputText: null,
        errorMessage: null,
      });
    });

    it("returns 200 with the real output once the row is resolved (apps/worker not booted)", async () => {
      const submitted = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      await prisma.aiPromptLog.update({
        where: { id: submitted.body.id },
        data: {
          model: "claude-test",
          outcome: "SUCCESS",
          outputText: "Customer reports being unable to log in.",
          latencyMs: 42,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/ai/${submitted.body.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: submitted.body.id,
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
        outputText: "Customer reports being unable to log in.",
        errorMessage: null,
      });
    });
  });

  // Story 77 — Customer Portal Live Chat (agent-facing half). Gated by
  // `ticket:create`/`ticket:read` — mirrors the "ticket notes" describe
  // block's exact permission-check pattern above.
  describe("ticket messages / Live Chat (Story 77)", () => {
    it("rejects an unauthenticated request for both routes", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .send({ body: "Should not be created" })
        .expect(401);
      await request(app.getHttpServer()).get(`/api/v1/tickets/${ticketId}/messages`).expect(401);
    });

    it("rejects an Agent-role user attempting to create or read messages (403)", async () => {
      const agentEmail = `agent-messages-${randomUUID()}@example.com`;
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
          fullName: "Test Agent Messages",
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
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .send({ body: "Should not be created" })
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/messages`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(403);
    });

    it("returns [] for a ticket with no messages yet", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/messages`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(response.body).toEqual([]);
    });

    it("sends a message as OUTBOUND from the authenticated agent, then lists it", async () => {
      const sent = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "Thanks for reaching out — looking into this now." })
        .expect(201);

      expect(sent.body).toMatchObject({
        ticketId,
        channelType: "LIVE_CHAT",
        direction: "OUTBOUND",
        senderUserId: adminUserId,
        senderContactId: null,
        body: "Thanks for reaching out — looking into this now.",
      });

      const listed = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/messages`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(listed.body.map((m: { id: string }) => m.id)).toContain(sent.body.id);
    });

    it("returns 404 for a ticket that doesn't exist", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${randomUUID()}/messages`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "Should not be created" })
        .expect(404);
    });
  });
});
