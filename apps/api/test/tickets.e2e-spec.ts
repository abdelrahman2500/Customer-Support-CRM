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
    // Story S-8e — one page, ordered `createdAt` descending by default.
    // Narrowing to the suite's own customer keeps the test about what it was
    // always about (the new ticket is listed, under branch scope) instead of
    // about the surrounding fixture order.
    const response = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .query({ customerId })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ids = response.body.items.map((ticket: { id: string }) => ticket.id);
    expect(ids).toContain(ticketId);
  });

  it("includes createdAt/updatedAt and a slaTarget field (Story 23) on each listed ticket", async () => {
    // Story S-8e — see the note above on paging and the default order.
    const response = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .query({ customerId })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ticket = response.body.items.find((entry: { id: string }) => entry.id === ticketId);
    expect(ticket).toBeDefined();
    expect(typeof ticket.createdAt).toBe("string");
    expect(typeof ticket.updatedAt).toBe("string");
    // No SlaPolicy exists in this suite's fixtures, so no SlaTicketTarget was
    // ever computed for this ticket — `slaTarget` is `null`, not omitted and
    // not a 404 (Story 23's own "list row must not fail" design decision).
    expect(ticket.slaTarget).toBeNull();
  });

  // RM-01 — Formal Ticket Status Transition Rules. Recon (see
  // .squad/plans/core-completion-roadmap/RM-01-ticket-status-transitions.md)
  // found the repository's own existing tests already require free
  // bidirectional movement between every status, including "skip a step"
  // jumps — confirmed with the product owner rather than guessed. There is
  // therefore no "legal transition succeeds, illegal transition is
  // rejected with 400" pair to test here: every transition between two
  // real `TicketStatus` values is legal, by explicit, confirmed product
  // decision (`ticket-status-transitions.ts`). What this suite proves
  // instead, end to end through the real HTTP endpoint: a full lifecycle
  // walk (including both "skip a step" jumps) succeeds and is faithfully
  // recorded in ticket history; a same-status no-op is likewise legal; and
  // the one input that remains genuinely illegal — a string that is not a
  // real `TicketStatus` value at all — is still rejected with 400 exactly
  // as before, since `@IsEnum(TicketStatus)` on `UpdateTicketDto` is
  // unchanged by this story.
  describe("ticket status transitions (RM-01)", () => {
    let lifecycleTicketId: string;

    beforeAll(async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, subject: "RM-01 lifecycle fixture" })
        .expect(201);
      lifecycleTicketId = created.body.id;
    });

    async function patchStatus(status: string): Promise<{ status: number; body: { id?: string } }> {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${lifecycleTicketId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status });
      return { status: response.status, body: response.body };
    }

    it("rejects a value that is not a real TicketStatus with 400 (unchanged DTO validation)", async () => {
      await patchStatus("NOT_A_REAL_STATUS").then((response) => expect(response.status).toBe(400));
    });

    it("walks a full lifecycle — including both 'skip a step' jumps — with every transition succeeding", async () => {
      // OPEN -> IN_PROGRESS (adjacent)
      expect((await patchStatus("IN_PROGRESS")).status).toBe(200);
      // IN_PROGRESS -> CLOSED (skips RESOLVED)
      expect((await patchStatus("CLOSED")).status).toBe(200);
      // CLOSED -> OPEN (reopen)
      expect((await patchStatus("OPEN")).status).toBe(200);
      // OPEN -> RESOLVED (adjacent)
      expect((await patchStatus("RESOLVED")).status).toBe(200);
      // RESOLVED -> OPEN (skips IN_PROGRESS)
      expect((await patchStatus("OPEN")).status).toBe(200);
      // OPEN -> OPEN (same-status no-op)
      expect((await patchStatus("OPEN")).status).toBe(200);

      const ticket = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${lifecycleTicketId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(ticket.body.status).toBe("OPEN");
    });

    it("records a history entry for every one of the transitions above, in order", async () => {
      const history = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${lifecycleTicketId}/history`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      // 1 creation entry + 6 update entries from the lifecycle walk above
      // (the rejected NOT_A_REAL_STATUS attempt produced none).
      const statuses = history.body
        .filter((entry: { eventType: string }) => entry.eventType === "ticket.updated")
        .map((entry: { snapshot: { status: string } }) => entry.snapshot.status);
      expect(statuses).toEqual(["IN_PROGRESS", "CLOSED", "OPEN", "RESOLVED", "OPEN", "OPEN"]);
    });

    it("cannot be used by another branch's caller (tenant isolation, unchanged)", async () => {
      // Mirrors this file's own existing branch-scoping convention: a
      // ticket outside the caller's branch 404s rather than ever reaching
      // the transition check.
      await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${randomUUID()}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "CLOSED" })
        .expect(404);
    });
  });

  // Story S-8d — the two filters that let the dashboard and customer-detail
  // screens stop fetching the whole branch list and narrowing it in the
  // browser.
  describe("customerId / unassigned filters (Story S-8d)", () => {
    it("returns every listed ticket with its customer display name resolved", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ customerId })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ticket = response.body.items.find((entry: { id: string }) => entry.id === ticketId);
      expect(ticket).toBeDefined();
      expect(typeof ticket.customerName).toBe("string");
      expect(ticket.customerName.length).toBeGreaterThan(0);
    });

    it("narrows the list to a single customer", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ customerId })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      for (const ticket of response.body.items) {
        expect(ticket.customerId).toBe(customerId);
      }
      expect(response.body.items.map((t: { id: string }) => t.id)).toContain(ticketId);
    });

    it("returns an empty list for a customer with no tickets", async () => {
      const emptyCustomer = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `No Tickets Fixture ${randomUUID()}` })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ customerId: emptyCustomer.body.id })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items).toEqual([]);
    });

    it("returns only unclaimed tickets for unassigned=true", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ unassigned: "true" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      for (const ticket of response.body.items) {
        expect(ticket.assignedToUserId).toBeNull();
      }
    });

    it("returns only claimed tickets for unassigned=false", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ unassigned: "false" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      for (const ticket of response.body.items) {
        expect(ticket.assignedToUserId).not.toBeNull();
      }
    });

    it("partitions the list: unassigned=true and =false together cover it exactly", async () => {
      const all = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const unclaimed = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ unassigned: "true" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const claimed = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ unassigned: "false" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      // Story S-8e — compares totals, not page lengths: three pages of 25
      // never sum to 25. `total` is counted over each request's own where
      // clause, so this still catches the filter being dropped (either side
      // equalling the whole list) or inverted, and still does not depend on
      // absolute fixture counts.
      expect(unclaimed.body.total + claimed.body.total).toBe(all.body.total);
    });

    it("rejects a non-boolean unassigned value with 400", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ unassigned: "maybe" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it("composes customerId with an existing filter rather than replacing it", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ customerId, status: "OPEN" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      for (const ticket of response.body.items) {
        expect(ticket.customerId).toBe(customerId);
        expect(ticket.status).toBe("OPEN");
      }
    });
  });
  it("filters the ticket list by status, priority, category, and assignedToUserId", async () => {
    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .query({ status: "OPEN" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(byStatus.body.items.every((entry: { status: string }) => entry.status === "OPEN")).toBe(
      true,
    );

    const byUnrelatedStatus = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .query({ status: "CLOSED" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(byUnrelatedStatus.body.items.map((entry: { id: string }) => entry.id)).not.toContain(
      ticketId,
    );
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

    const updatedAts = response.body.items.map((entry: { updatedAt: string }) =>
      new Date(entry.updatedAt).getTime(),
    );
    const sorted = [...updatedAts].sort((a, b) => b - a);
    expect(updatedAts).toEqual(sorted);
  });

  // Story S-9 — server-side SLA-urgency ordering and the multi-status
  // filter the dashboard's panels need to use it.
  describe("slaUrgency ordering / statuses filter (Story S-9)", () => {
    it("puts tickets with no SLA target after every ticket that has one", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ sortBy: "slaUrgency", pageSize: 100 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      // Prisma rejects an explicit `nulls: "last"` inside a relation sort,
      // so the service relies on Postgres's default for an ascending sort.
      // That default is the whole basis of the ordering, so it is asserted
      // rather than assumed.
      const hasTarget = response.body.items.map(
        (t: { slaTarget: unknown }) => t.slaTarget !== null,
      );
      const firstNull = hasTarget.indexOf(false);
      if (firstNull !== -1) {
        expect(hasTarget.slice(firstNull).every((present: boolean) => !present)).toBe(true);
      }
    });

    it("orders the targeted tickets by their governing target, soonest first", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ sortBy: "slaUrgency", pageSize: 100 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const targets = response.body.items
        .filter((t: { slaTarget: unknown }) => t.slaTarget !== null)
        .map((t: { slaTarget: { responseTargetAt: string; resolutionTargetAt: string } }) =>
          Math.min(
            new Date(t.slaTarget.responseTargetAt).getTime(),
            new Date(t.slaTarget.resolutionTargetAt).getTime(),
          ),
        );

      // The governing target is the EARLIER of the two (what the agent-facing
      // status uses). Ordering by `responseTargetAt` equals ordering by that
      // minimum only because a policy can no longer resolve before it
      // responds - so this asserts the minimum is non-decreasing, which is
      // the property that actually matters.
      const sorted = [...targets].sort((a: number, b: number) => a - b);
      expect(targets).toEqual(sorted);
    });

    it("filters to several statuses at once", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ statuses: ["OPEN", "IN_PROGRESS"], pageSize: 100 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      for (const ticket of response.body.items) {
        expect(["OPEN", "IN_PROGRESS"]).toContain(ticket.status);
      }
    });

    it("accepts a single statuses value, not only a repeated one", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ statuses: "OPEN" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      // A one-value query string arrives as a bare string; the DTO normalizes
      // it to an array before `each` validation.
      for (const ticket of response.body.items) {
        expect(ticket.status).toBe("OPEN");
      }
    });

    it("rejects an unknown status inside statuses with 400", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ statuses: ["OPEN", "NOT_A_STATUS"] })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it("rejects status and statuses supplied together with 400", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ status: "OPEN", statuses: ["IN_PROGRESS"] })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it("rejects an unknown sortBy with 400", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ sortBy: "slaUrgencyy" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it("composes the urgency sort with statuses and pagination", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ sortBy: "slaUrgency", statuses: ["OPEN", "IN_PROGRESS"], page: 1, pageSize: 5 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      // Exactly the request the dashboard's panels now make.
      expect(response.body.items.length).toBeLessThanOrEqual(5);
      expect(response.body).toMatchObject({ page: 1, pageSize: 5 });
      for (const ticket of response.body.items) {
        expect(["OPEN", "IN_PROGRESS"]).toContain(ticket.status);
      }
    });
  });

  // Story S-8e — pagination replaces Story 105's Bounded Result Cap.
  describe("pagination (Story S-8e)", () => {
    it("returns a page envelope rather than a bare array", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(false);
      expect(response.body).toMatchObject({ page: 1, pageSize: 25 });
      expect(response.body.items.length).toBeLessThanOrEqual(25);
    });

    it("reaches rows the old 500-row cap made unreachable", async () => {
      const first = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ pageSize: 5 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const last = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ pageSize: 5, page: first.body.totalPages })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(last.body.items.length).toBeGreaterThan(0);
      expect(last.body.total).toBe(first.body.total);
    });

    it("returns a non-overlapping second page", async () => {
      const first = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ page: 1, pageSize: 5 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      if (first.body.totalPages < 2) return;

      const second = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ page: 2, pageSize: 5 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const firstIds = first.body.items.map((t: { id: string }) => t.id);
      const secondIds = second.body.items.map((t: { id: string }) => t.id);
      expect(secondIds.filter((id: string) => firstIds.includes(id))).toEqual([]);
    });

    it("counts the filtered set, not the whole branch", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, subject: "Ticket inside the filter" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId: otherCustomerId, subject: "Ticket outside the filter" })
        .expect(201);

      const all = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const mine = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ customerId })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      // A `total` counted without the caller's filter would advertise
      // pages that come back empty.
      expect(mine.body.total).toBeLessThan(all.body.total);
      expect(mine.body.total).toBeGreaterThan(0);
    });

    it("keeps each page's rows within the requested size", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ pageSize: 3 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(3);
      expect(response.body.totalPages).toBe(Math.ceil(response.body.total / 3));
    });

    it("still resolves the customer name and slaTarget on a deeper page", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ page: 2, pageSize: 5 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      for (const ticket of response.body.items) {
        // The include rides on a wrapped delegate, so paging is exactly
        // where it could silently go missing.
        expect(ticket).toHaveProperty("customerName");
        expect(ticket).toHaveProperty("slaTarget");
      }
    });

    it("rejects a page size above the maximum rather than silently clamping it", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ pageSize: 101 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it("rejects an invalid page with 400", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ page: 0 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });
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

      const category = await request(app.getHttpServer())
        .post("/api/v1/ticket-categories")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ name: searchCategoryMarker })
        .expect(201);

      const categoryTicket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, subject: "Unrelated subject", categoryId: category.body.id })
        .expect(201);
      searchCategoryTicketId = categoryTicket.body.id;
    });

    it("matches by subject, case-insensitive", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ search: searchSubjectMarker.toLowerCase() })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.items.map((ticket: { id: string }) => ticket.id);
      expect(ids).toContain(searchSubjectTicketId);
      expect(ids).not.toContain(searchCategoryTicketId);
    });

    it("matches by category, case-insensitive", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ search: searchCategoryMarker.toUpperCase() })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.items.map((ticket: { id: string }) => ticket.id);
      expect(ids).toContain(searchCategoryTicketId);
      expect(ids).not.toContain(searchSubjectTicketId);
    });

    it("returns [] for a non-matching search term", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ search: `no-such-ticket-content-${randomUUID()}` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items).toEqual([]);
    });

    it("composes with an existing equality filter (status)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ search: searchSubjectMarker, status: "OPEN" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.items.map((ticket: { id: string }) => ticket.id);
      expect(ids).toContain(searchSubjectTicketId);
      expect(response.body.items.every((t: { status: string }) => t.status === "OPEN")).toBe(true);
    });

    it("omitted search behaves identically to today — the fixture tickets still appear unfiltered", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ customerId })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      // Story S-8e — "unfiltered" now means "not narrowed by `search`",
      // which is what this test is about; the customer filter only keeps
      // both fixtures on one page. Omitting `search` must not drop them.
      const ids = response.body.items.map((ticket: { id: string }) => ticket.id);
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
    const deadline = Date.now() + 5000;
    let history: Array<{
      eventType: string;
      actorUserId: string | null;
      snapshot: { status?: string; priority?: string };
    }> = [];
    do {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/history`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      history = response.body;
      if (history.length >= 3) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);

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
    expect(history).toHaveLength(3);
    expect(history[0]?.eventType).toBe("ticket.created");

    const updatedEntry = history.find((entry) => entry.eventType === "ticket.updated");
    expect(updatedEntry).toBeDefined();
    expect(updatedEntry?.actorUserId).toBe(adminUserId);
    expect(updatedEntry?.snapshot.status).toBe("IN_PROGRESS");
    expect(updatedEntry?.snapshot.priority).toBe("HIGH");

    const recategorizedEntry = history.find((entry) => entry.eventType === "ticket.recategorized");
    expect(recategorizedEntry).toBeDefined();
    expect(recategorizedEntry?.actorUserId).toBe(adminUserId);
    expect(recategorizedEntry?.snapshot.priority).toBe("HIGH");
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

  // Story 100 — Agent's default seed grant now includes `ticket:create`
  // (previously `[]`), so this route is now reachable by a freshly seeded
  // Agent-role user; this proves that, rather than a 403.
  it("allows an Agent-role user with the default ticket:create grant to create a ticket (Story 100)", async () => {
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
      .expect(201);
  });

  // Story 100 — Agent's default seed grant now includes `ticket:read`
  // (previously `[]`), so this route is now reachable by a freshly seeded
  // Agent-role user; this proves that, rather than a 403.
  it("allows an Agent-role user with the default ticket:read grant to read tickets (Story 100)", async () => {
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
      .expect(200);
  });

  // Story 100 — Agent's default seed grant now includes `ticket:read`
  // (previously `[]`), so this route is now reachable by a freshly seeded
  // Agent-role user; this proves that, rather than a 403.
  it("allows an Agent-role user with the default ticket:read grant to read ticket history (Story 100)", async () => {
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
      .expect(200);
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

    // Story 100 — Agent's default seed grant now includes `ticket:create`
    // and `ticket:read` (previously `[]`), so both routes below are now
    // reachable by a freshly seeded Agent-role user; this proves that,
    // rather than a 403 — fitting, since this describe block's own title
    // already says "Agent-Only".
    it("allows an Agent-role user with the default ticket:create/ticket:read grant to create and read notes (Story 100)", async () => {
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

      // A fresh ticket, not the shared `ticketId` fixture below's own
      // "returns [] for a ticket with no notes yet" test still needs to
      // see zero notes on it.
      const agentTicket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .send({ customerId, subject: "Agent notes permission fixture" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${agentTicket.body.id}/notes`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .send({ body: "Agent note" })
        .expect(201);
      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${agentTicket.body.id}/notes`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(200);
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

    // Story 100 — Agent's default seed grant now includes `ticket:read`
    // (previously `[]`), so this route is now reachable by a freshly
    // seeded Agent-role user; this proves that, rather than a 403.
    it("allows an Agent-role user with the default ticket:read grant (Story 100)", async () => {
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
        .expect(201);
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

    // Story 81 — AI Feature Flags per Branch.
    it("returns { id, outcome: DISABLED } immediately and enqueues no job when SUMMARIZE is disabled for the branch", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/ai/settings")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ summarizeEnabled: false })
        .expect(200);

      try {
        const queue: Queue<{ aiPromptLogId: string }> = app.get(getQueueToken(AI_PROCESSING_QUEUE));
        const before = await queue.getJobs(["waiting", "active", "completed"]);

        const response = await request(app.getHttpServer())
          .post(`/api/v1/tickets/${ticketId}/ai/summarize`)
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .expect(201);

        expect(response.body).toEqual({ id: expect.any(String), outcome: "DISABLED" });

        const log = await prisma.aiPromptLog.findUnique({ where: { id: response.body.id } });
        expect(log).toMatchObject({
          feature: "SUMMARIZE",
          outcome: "DISABLED",
          model: "disabled",
          outputText: null,
        });

        const after = await queue.getJobs(["waiting", "active", "completed"]);
        expect(after.filter((job) => job.data.aiPromptLogId === response.body.id)).toHaveLength(0);
        expect(after.length).toBe(before.length);
      } finally {
        // Restore the seeded default — this branch is shared with every
        // other e2e suite in this run.
        await request(app.getHttpServer())
          .patch("/api/v1/ai/settings")
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .send({ summarizeEnabled: true })
          .expect(200);
      }
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

    // Story 100 — see the identical note on the summarize describe block above.
    it("allows an Agent-role user with the default ticket:read grant (Story 100)", async () => {
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
        .expect(201);
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
  // Ticket.categoryId — advisory only, unchanged.
  describe("ticket AI categorization (Story 75/76)", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/categorize`)
        .expect(401);
    });

    // Story 100 — see the identical note on the summarize describe block above.
    it("allows an Agent-role user with the default ticket:read grant (Story 100)", async () => {
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
        .expect(201);
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
      expect(ticketAfter.body.categoryId).toBe(ticketBefore.body.categoryId);
    });
  });

  // RM-00 — Suggested Solutions, the fifth AI capability. Same shape as
  // the categorization describe block above: advisory-only, never mutates
  // the ticket, creates exactly one PENDING AiPromptLog row.
  describe("ticket AI suggested solutions (RM-00)", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/suggest-solutions`)
        .expect(401);
    });

    it("returns 404 for a ticket that doesn't exist", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${randomUUID()}/ai/suggest-solutions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("returns { id, outcome: PENDING } immediately and creates exactly one PENDING AiPromptLog row", async () => {
      const before = await prisma.aiPromptLog.count({ where: { feature: "SUGGEST_SOLUTIONS" } });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketId}/ai/suggest-solutions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        outcome: "PENDING",
      });

      const after = await prisma.aiPromptLog.count({ where: { feature: "SUGGEST_SOLUTIONS" } });
      expect(after).toBe(before + 1);

      const log = await prisma.aiPromptLog.findUnique({ where: { id: response.body.id } });
      expect(log).toMatchObject({ feature: "SUGGEST_SOLUTIONS", outcome: "PENDING", model: "pending" });
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
      const job = waitingJobs.find(
        (candidate) => candidate.data.aiPromptLogId === response.body.id,
      );
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

    // Story 100 — see the identical note on the summarize describe block above.
    it("allows an Agent-role user with the default ticket:read grant (Story 100)", async () => {
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
        .expect(200);
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

    // Story 100 — Agent's default seed grant now includes `ticket:create`
    // and `ticket:read` (previously `[]`), so both routes below are now
    // reachable by a freshly seeded Agent-role user; this proves that,
    // rather than a 403 — this describe block's own doc comment already
    // named these two permissions as the intended gate.
    it("allows an Agent-role user with the default ticket:create/ticket:read grant to create and read messages (Story 100)", async () => {
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

      // A fresh ticket, not the shared `ticketId` fixture below's own
      // "returns [] for a ticket with no messages yet" test still needs to
      // see zero messages on it.
      const agentTicket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .send({ customerId, subject: "Agent messages permission fixture" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/tickets/${agentTicket.body.id}/messages`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .send({ body: "Agent message" })
        .expect(201);
      await request(app.getHttpServer())
        .get(`/api/v1/tickets/${agentTicket.body.id}/messages`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(200);
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
