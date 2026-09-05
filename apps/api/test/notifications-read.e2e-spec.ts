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

    // Story S-8b — a `Paginated<NotificationSummary>` envelope.
    expect(Array.isArray(response.body.items)).toBe(true);
  });

  // Story 106 — Bounded Result Caps.
  it("returns at most one page, and says how many rows there are in total", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.items.length).toBeLessThanOrEqual(response.body.pageSize);
    expect(response.body.total).toBeGreaterThanOrEqual(response.body.items.length);
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

    const match = response.body.items.find(
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

    const match = response.body.items.find((n: { ticketId: string }) => n.ticketId === ticketId);
    expect(match).toMatchObject({
      eventType: TICKET_ESCALATED_EVENT,
      ticketId,
      branchId: adminBranchId,
    });
  });

  // Story 100 — Agent's default seed grant now includes `notification:read`
  // (previously `[]`), so this route is now reachable by a freshly seeded
  // Agent-role user; this proves that, rather than a 403.
  it("allows an Agent user with the default notification:read grant (Story 100)", async () => {
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
      .expect(200);
  });

  /**
   * Story S-8b — paging `GET /notifications`.
   *
   * `NotificationLog` is written by the SLA and escalation listeners, so
   * this table is shared, always growing and never a known size. Every
   * assertion below is therefore relative — against the endpoint's own
   * reported `total`, or by comparing pages to each other — rather than
   * against a fixed row count, which is what keeps them stable when the
   * suite is run repeatedly against the same database.
   */
  describe("pagination (Story S-8b)", () => {
    function get(query: Record<string, unknown> = {}) {
      return request(app.getHttpServer())
        .get("/api/v1/notifications")
        .query(query)
        .set("Authorization", `Bearer ${adminAccessToken}`);
    }

    it("defaults to page 1 at a page size of 25", async () => {
      const response = await get().expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(25);
      expect(response.body.items.length).toBeLessThanOrEqual(25);
      expect(response.body.totalPages).toBe(Math.max(1, Math.ceil(response.body.total / 25)));
    });

    it("echoes back an explicit page and pageSize", async () => {
      const response = await get({ page: 2, pageSize: 5 }).expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.pageSize).toBe(5);
      expect(response.body.items.length).toBeLessThanOrEqual(5);
    });

    it("returns the first page, and a non-overlapping second page", async () => {
      const first = await get({ page: 1, pageSize: 2 }).expect(200);
      if (first.body.total <= 2) {
        // Not enough rows in this database to have a second page; the
        // assertions below would be vacuous rather than wrong.
        expect(first.body.totalPages).toBe(1);
        return;
      }

      const second = await get({ page: 2, pageSize: 2 }).expect(200);
      const firstIds = first.body.items.map((n: { id: string }) => n.id);
      const secondIds = second.body.items.map((n: { id: string }) => n.id);

      expect(secondIds.length).toBeGreaterThan(0);
      for (const id of secondIds) {
        expect(firstIds).not.toContain(id);
      }
    });

    it("returns the last page with at least one row", async () => {
      const first = await get({ pageSize: 2 }).expect(200);
      const last = await get({ page: first.body.totalPages, pageSize: 2 }).expect(200);

      expect(last.body.page).toBe(first.body.totalPages);
      expect(last.body.items.length).toBeGreaterThan(0);
      expect(last.body.items.length).toBeLessThanOrEqual(2);
    });

    it("returns 200 with an empty page past the end, keeping the metadata accurate", async () => {
      const first = await get({ pageSize: 5 }).expect(200);
      const beyond = await get({ page: first.body.totalPages + 50, pageSize: 5 }).expect(200);

      expect(beyond.body.items).toEqual([]);
      expect(beyond.body.page).toBe(first.body.totalPages + 50);
      expect(beyond.body.pageSize).toBe(5);
      expect(beyond.body.total).toBe(first.body.total);
      expect(beyond.body.totalPages).toBe(first.body.totalPages);
    });

    it("keeps totalPages consistent with total and pageSize", async () => {
      const response = await get({ pageSize: 3 }).expect(200);

      expect(response.body.totalPages).toBe(Math.max(1, Math.ceil(response.body.total / 3)));
    });

    it("orders deterministically enough for pages not to overlap", async () => {
      // `loggedAt` is not unique - the listeners write several rows per
      // event - so the service adds `id` as a tiebreaker.
      const size = 3;
      const pages = await Promise.all([
        get({ page: 1, pageSize: size }).expect(200),
        get({ page: 2, pageSize: size }).expect(200),
        get({ page: 3, pageSize: size }).expect(200),
      ]);

      const ids = pages.flatMap((p) => p.body.items.map((n: { id: string }) => n.id));
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("keeps newest-first ordering within a page", async () => {
      const response = await get({ pageSize: 10 }).expect(200);

      const loggedAts = response.body.items.map((n: { loggedAt: string }) =>
        new Date(n.loggedAt).getTime(),
      );
      expect(loggedAts).toEqual([...loggedAts].sort((a, b) => b - a));
    });

    it("resolves an effective branchId on every paginated row", async () => {
      const response = await get({ pageSize: 100 }).expect(200);

      /**
       * Every row reports a branch, never null. Escalation rows carry a
       * null `branchId` column (see the service doc comment) and are
       * resolved to the caller's branch instead.
       *
       * Deliberately not asserting `=== adminBranchId`: a row that carries
       * its own non-null `branchId` is passed through as-is, and that
       * column is written independently of the ticket it points at, so it
       * can legitimately differ from the ticket's branch. The scope this
       * endpoint enforces is on `ticket.branchId`, not on that column -
       * which is exactly why the service filters through the relation. The
       * customer-scoped exclusion is asserted in
       * `portal-notifications.e2e-spec.ts`, against rows it creates itself.
       */
      for (const notification of response.body.items) {
        expect(notification.branchId).toBeTruthy();
      }
      expect(response.body.total).toBeGreaterThanOrEqual(response.body.items.length);
    });

    it("accepts the maximum page size", async () => {
      const response = await get({ pageSize: 100 }).expect(200);

      expect(response.body.pageSize).toBe(100);
      expect(response.body.items.length).toBeLessThanOrEqual(100);
    });

    it("rejects a page size above the maximum rather than silently clamping it", async () => {
      await get({ pageSize: 101 }).expect(400);
      await get({ pageSize: 1000 }).expect(400);
    });

    it("rejects an invalid pageSize with 400", async () => {
      await get({ pageSize: 0 }).expect(400);
      await get({ pageSize: -1 }).expect(400);
      await get({ pageSize: 2.5 }).expect(400);
      await get({ pageSize: "abc" }).expect(400);
    });

    it("rejects an invalid page with 400", async () => {
      await get({ page: 0 }).expect(400);
      await get({ page: -1 }).expect(400);
      await get({ page: 1.5 }).expect(400);
      await get({ page: "abc" }).expect(400);
    });

    it("rejects an unknown query parameter, so a future filter cannot be silently ignored", async () => {
      // `forbidNonWhitelisted` - the endpoint has no filters, and asking
      // for one must fail loudly rather than return an unfiltered page.
      await get({ eventType: "sla.at_risk" }).expect(400);
    });

    it("still requires authentication on a paginated request", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/notifications")
        .query({ page: 2, pageSize: 10 })
        .expect(401);
    });
  });
});
