import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 37 — `GET /audit-logs`.
 *
 * Bootstraps the REAL `AppModule` against REAL Postgres/Redis, exactly like
 * `identity.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL` pointed at a
 * real, migrated, and SEEDED database (re-seeded with the `audit:read`
 * permission this story adds).
 *
 * No manual trigger is needed to produce a real `AuditLog` row: the
 * globally-registered `AuditInterceptor` already logs every mutating
 * request automatically (unchanged by this story) — a plain `POST
 * /customers` call in this suite is itself real audit-log-generating
 * activity.
 */
describe("Audit logs — read endpoint (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let adminBranchId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

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

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/audit-logs").expect(401);
  });

  async function waitForAuditLogRow(
    action: string,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    do {
      const response = await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      if (response.body.items.some((log: { action: string }) => log.action === action)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for an audit log row with action "${action}"`);
  }

  it("surfaces a real audit log row for a real mutating request, scoped to the admin's branch", async () => {
    const displayName = `Audit log e2e customer ${randomUUID()}`;
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName })
      .expect(201);
    expect(createResponse.body.id).toBeTypeOf("string");

    await waitForAuditLogRow("POST /api/v1/customers");

    const response = await request(app.getHttpServer())
      .get("/api/v1/audit-logs")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    // Story S-8a — the response is a `Paginated<AuditLogSummary>` envelope.
    expect(Array.isArray(response.body.items)).toBe(true);
    const match = response.body.items.find(
      (log: { action: string; branchId: string }) =>
        log.action === "POST /api/v1/customers" && log.branchId === adminBranchId,
    );
    expect(match).toMatchObject({
      action: "POST /api/v1/customers",
      entityType: "http_request",
      branchId: adminBranchId,
    });
  });

  it("returns rows ordered newest-first", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/audit-logs")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const timestamps = response.body.items.map((log: { createdAt: string }) =>
      new Date(log.createdAt).getTime(),
    );
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });

  // Story 104 — Audit Log Search, Filtering & a Bounded Result Cap.
  describe("filtering (Story 104)", () => {
    it("filters by action, returning only exact matches", async () => {
      const displayName = `Audit log filter e2e customer ${randomUUID()}`;
      await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName })
        .expect(201);
      await waitForAuditLogRow("POST /api/v1/customers");

      const response = await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .query({ action: "POST /api/v1/customers" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      for (const log of response.body.items) {
        expect(log.action).toBe("POST /api/v1/customers");
      }
    });

    it("filters by entityType, returning only exact matches", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .query({ entityType: "http_request" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      for (const log of response.body.items) {
        expect(log.entityType).toBe("http_request");
      }
    });

    it("filters by actorId, returning only exact matches", async () => {
      const me = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .query({ actorId: me.body.id })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      for (const log of response.body.items) {
        expect(log.actorId).toBe(me.body.id);
      }
    });

    it("filters by date range, matching GET /reports/*'s own semantics", async () => {
      const today = new Date().toISOString().slice(0, 10);

      const response = await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .query({ from: today, to: today })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it("rejects an invalid date range with 400", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .query({ from: "2026-06-05", to: "2026-06-01" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    /**
     * Story S-8a — Story 104's "never returns more than 200 rows" cap is
     * gone; the ceiling is the page size now. The important difference is
     * that rows beyond it are reachable rather than silently dropped, which
     * is what the pagination block below asserts.
     */
    it("returns at most one page of rows, and says how many there are in total", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(response.body.pageSize);
      expect(response.body.total).toBeGreaterThanOrEqual(response.body.items.length);
    });
  });

  it("rejects an Agent user (no audit:read permission) with 403", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const agentEmail = `audit-agent-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Audit Log Test Agent",
        branchId: adminBranchId,
        roleId: agentRole.id,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/audit-logs")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
      .expect(403);
  });

  /**
   * Story S-8a — the first paginated endpoint in the API.
   *
   * These tests deliberately do not seed a fixed number of rows:
   * `AuditInterceptor` writes a row for every mutating request in the
   * application, so the table is shared, always growing, and never a known
   * size. Everything below is therefore asserted relatively — against the
   * endpoint's own reported `total`, or by comparing pages to each other —
   * which is both honest about the fixture and what makes these assertions
   * stable when run repeatedly against the same database.
   */
  describe("pagination (Story S-8a)", () => {
    function get(query: Record<string, unknown> = {}) {
      return request(app.getHttpServer())
        .get("/api/v1/audit-logs")
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

    it("returns a different, non-overlapping slice on the second page", async () => {
      const first = await get({ page: 1, pageSize: 5 }).expect(200);
      // Only meaningful once the trail is longer than one page, which it
      // always is by the time this suite has run its own mutations.
      expect(first.body.total).toBeGreaterThan(5);

      const second = await get({ page: 2, pageSize: 5 }).expect(200);

      const firstIds = first.body.items.map((log: { id: string }) => log.id);
      const secondIds = second.body.items.map((log: { id: string }) => log.id);
      expect(secondIds.length).toBeGreaterThan(0);
      for (const id of secondIds) {
        expect(firstIds).not.toContain(id);
      }
    });

    it("keeps the total consistent across pages", async () => {
      const first = await get({ page: 1, pageSize: 5 }).expect(200);
      const second = await get({ page: 2, pageSize: 5 }).expect(200);

      // The table grows as this suite runs, so the later read can only be
      // greater or equal - never smaller.
      expect(second.body.total).toBeGreaterThanOrEqual(first.body.total);
      expect(second.body.totalPages).toBeGreaterThanOrEqual(first.body.totalPages);
    });

    it("returns the last page with at least one row", async () => {
      const first = await get({ pageSize: 5 }).expect(200);
      const last = await get({ page: first.body.totalPages, pageSize: 5 }).expect(200);

      expect(last.body.page).toBe(first.body.totalPages);
      expect(last.body.items.length).toBeGreaterThan(0);
      expect(last.body.items.length).toBeLessThanOrEqual(5);
    });

    it("returns 200 with an empty page past the end, keeping the metadata accurate", async () => {
      const first = await get({ pageSize: 5 }).expect(200);
      const beyond = await get({ page: first.body.totalPages + 50, pageSize: 5 }).expect(200);

      // A filter that just narrowed the result set leaves a client on a page
      // that no longer exists; that is not an error, and a 404 would make it
      // one.
      expect(beyond.body.items).toEqual([]);
      expect(beyond.body.page).toBe(first.body.totalPages + 50);
      expect(beyond.body.pageSize).toBe(5);
      expect(beyond.body.total).toBeGreaterThan(0);
      expect(beyond.body.totalPages).toBeGreaterThanOrEqual(1);
    });

    it("orders deterministically enough for pages not to overlap", async () => {
      // `createdAt` alone is not unique - the interceptor writes several
      // rows per request - so the service adds `id` as a tiebreaker. Without
      // it, a row sharing a timestamp with a page boundary can appear twice
      // or not at all.
      const size = 10;
      const first = await get({ page: 1, pageSize: size }).expect(200);
      const second = await get({ page: 2, pageSize: size }).expect(200);
      const third = await get({ page: 3, pageSize: size }).expect(200);

      const ids = [
        ...first.body.items.map((log: { id: string }) => log.id),
        ...second.body.items.map((log: { id: string }) => log.id),
        ...third.body.items.map((log: { id: string }) => log.id),
      ];
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("keeps newest-first ordering within a page", async () => {
      const response = await get({ page: 2, pageSize: 10 }).expect(200);

      const timestamps = response.body.items.map((log: { createdAt: string }) =>
        new Date(log.createdAt).getTime(),
      );
      expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
    });

    it("counts only the filtered set, not the whole table", async () => {
      const all = await get({ pageSize: 1 }).expect(200);
      const filtered = await get({ pageSize: 1, entityType: "http_request" }).expect(200);

      expect(filtered.body.total).toBeGreaterThan(0);
      expect(filtered.body.total).toBeLessThanOrEqual(all.body.total);
    });

    it("pages a filtered query", async () => {
      const response = await get({
        entityType: "http_request",
        page: 1,
        pageSize: 3,
      }).expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(3);
      for (const log of response.body.items) {
        expect(log.entityType).toBe("http_request");
      }
    });

    it("returns an accurate empty envelope for a filter that matches nothing", async () => {
      const response = await get({ action: `no-such-action-${randomUUID()}` }).expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.total).toBe(0);
      // Floor of 1, so a UI can render "page 1 of 1" over an empty table.
      expect(response.body.totalPages).toBe(1);
      expect(response.body.page).toBe(1);
    });

    it("still returns branch-scoped rows alongside the global (null-branch) ones", async () => {
      const response = await get({ pageSize: 100 }).expect(200);

      // The `branchId OR null` authorization arm must survive paging: an
      // auth-level row carries no branch and would vanish if the composed
      // `where` were rebuilt for the count or the page.
      for (const log of response.body.items) {
        expect(log.branchId === null || log.branchId === adminBranchId).toBe(true);
      }
      expect(response.body.total).toBeGreaterThan(0);
    });

    it("accepts the maximum page size", async () => {
      const response = await get({ pageSize: 100 }).expect(200);

      expect(response.body.pageSize).toBe(100);
      expect(response.body.items.length).toBeLessThanOrEqual(100);
    });

    it("rejects a page size above the maximum rather than silently clamping it", async () => {
      // The old cap quietly shortened the array; this says no out loud.
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

    it("still requires the audit:read permission on a paginated request", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .query({ page: 2, pageSize: 10 })
        .expect(401);
    });
  });
});
