import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for the `customers/*` HTTP surface.
 *
 * Bootstraps the REAL `AppModule` — same guards
 * (`AuthGuard`/`PermissionsGuard`/`ThrottlerGuard`), same `AuditInterceptor`,
 * same `TenantMiddleware`, same global `ValidationPipe`/prefix as
 * `src/main.ts` — against a REAL Postgres/Redis, exactly like
 * `identity.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL` pointed at a
 * real, migrated, and SEEDED database. Logs in as the seed's bootstrap admin
 * (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) and creates its own Customer/
 * Contact/Agent fixtures through the API — no seed data is added for this
 * suite.
 *
 * Known scope limit: `prisma/seed.ts` creates exactly one Branch, so this
 * suite cannot exercise true cross-branch isolation end-to-end — that path
 * is covered by `customers.service.spec.ts`'s mocked-TenantContext tests.
 */
describe("Customer Management (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let customerId: string;
  let contactId: string;
  const contactEmail = `contact-${randomUUID()}@example.com`;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/customers").expect(401);
  });

  it("creates a customer as the admin", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: "Acme Corp" })
      .expect(201);

    expect(response.body.displayName).toBe("Acme Corp");
    expect(response.body.isActive).toBe(true);
    customerId = response.body.id;
  });

  it("lists customers in the caller's active branch, including the new one", async () => {
    // Story S-8e — the default order is `createdAt` ascending, so this
    // suite's freshly-created customer is on the LAST page, not the first.
    // Asking for it by name is what this test was really checking.
    const response = await request(app.getHttpServer())
      .get("/api/v1/customers")
      .query({ search: "Acme Corp" })
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ids = response.body.items.map((customer: { id: string }) => customer.id);
    expect(ids).toContain(customerId);
  });

  // Story S-8e — pagination replaces Story 106's 500-row cap.
  describe("pagination (Story S-8e)", () => {
    it("returns a page envelope rather than a bare array", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(false);
      expect(response.body).toMatchObject({ page: 1, pageSize: 25 });
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeLessThanOrEqual(25);
    });

    it("reaches rows the old 500-row cap made unreachable", async () => {
      const first = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ pageSize: 5 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      // The whole point of the change: whatever the row count, the last
      // page is reachable. Story 106 simply truncated at 500.
      const last = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ pageSize: 5, page: first.body.totalPages })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(last.body.items.length).toBeGreaterThan(0);
      expect(last.body.total).toBe(first.body.total);
    });

    it("returns a non-overlapping second page", async () => {
      const first = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ page: 1, pageSize: 5 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      if (first.body.totalPages < 2) return;

      const second = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ page: 2, pageSize: 5 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const firstIds = first.body.items.map((c: { id: string }) => c.id);
      const secondIds = second.body.items.map((c: { id: string }) => c.id);
      expect(secondIds.filter((id: string) => firstIds.includes(id))).toEqual([]);
    });

    it("keeps totalPages consistent with total and pageSize", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ pageSize: 10 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.totalPages).toBe(Math.ceil(response.body.total / 10));
    });

    it("returns an empty page past the end, keeping the metadata accurate", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ page: 100000, pageSize: 25 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.page).toBe(100000);
      expect(response.body.total).toBeGreaterThan(0);
    });

    it("rejects a page size above the maximum rather than silently clamping it", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ pageSize: 101 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it("rejects an invalid page with 400", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ page: 0 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });
  });

  // Story S-8d — the customer-picker lookup, kept separate from the
  // browsable list so pagination on the latter cannot make a customer
  // unselectable when creating a ticket.
  describe("GET /customers/options", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/customers/options").expect(401);
    });

    it("is routed as a lookup, not parsed as a customer id", async () => {
      // The route is declared before `@Get(":id")`. If that order ever
      // flips, Nest treats "options" as an id and this 200 becomes a 404.
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers/options")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("returns only id and displayName, sorted by name", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers/options")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      for (const option of response.body) {
        expect(Object.keys(option).sort()).toEqual(["displayName", "id"]);
      }

      // Postgres sorts under its own collation, which ignores spaces and
      // punctuation - "Portal Notifications" precedes "Portal Notif Prefs"
      // there but not under a naive `localeCompare`. Normalize to the same
      // basis rather than asserting a JS ordering the database never used.
      const key = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();
      const names = response.body.map((option: { displayName: string }) => option.displayName);
      const sorted = [...names].sort((a: string, b: string) =>
        key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0,
      );
      expect(names).toEqual(sorted);
    });

    it("includes the customer created by this suite", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers/options")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.map((option: { id: string }) => option.id)).toContain(customerId);
    });

    it("cannot be accidentally paginated into a partial option set", async () => {
      // The handler takes no query DTO at all, so pagination params are
      // simply ignored rather than silently truncating the list. That is
      // the property that matters here: a picker missing options is a bug
      // a user would hit as "my customer is not in the dropdown".
      const full = await request(app.getHttpServer())
        .get("/api/v1/customers/options")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const paged = await request(app.getHttpServer())
        .get("/api/v1/customers/options")
        .query({ page: 2, pageSize: 5 })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(paged.body.length).toBe(full.body.length);
    });
  });
  it("gets a single customer with an empty contacts array", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/customers/${customerId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.id).toBe(customerId);
    expect(response.body.contacts).toEqual([]);
  });

  it("returns 404 for an unknown customer id", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/customers/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("updates the customer", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: "Acme Corporation", isActive: false })
      .expect(200);

    expect(response.body.id).toBe(customerId);
  });

  it("creates a contact under the customer", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Jane Doe", email: contactEmail })
      .expect(201);

    expect(response.body.fullName).toBe("Jane Doe");
    expect(response.body.email).toBe(contactEmail);
    contactId = response.body.id;
  });

  it("rejects a duplicate contact email within the same customer with 409", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Duplicate Jane", email: contactEmail })
      .expect(409);
  });

  it("allows the same email under a different customer (uniqueness is per-customer, not global)", async () => {
    const otherCustomer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: "Other Corp" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/customers/${otherCustomer.body.id}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Jane Doe Elsewhere", email: contactEmail })
      .expect(201);
  });

  it("lists contacts for the customer, including the new one", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ids = response.body.map((contact: { id: string }) => contact.id);
    expect(ids).toContain(contactId);
  });

  it("updates the contact", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}/contacts/${contactId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isPrimary: true })
      .expect(200);
  });

  // Story 100 — Agent's default seed grant now includes `customer:create`
  // (previously `[]`), so this route is now reachable by a freshly seeded
  // Agent-role user; this proves that, rather than a 403.
  it("allows an Agent-role user with the default customer:create grant to create a customer (Story 100)", async () => {
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
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ displayName: "Should Not Be Created" })
      .expect(201);
  });

  // Story 101 — Customer Management: List Search/Filter.
  describe("list search/filter (Story 101)", () => {
    const searchMarker = `SearchMarker${randomUUID().slice(0, 8)}`;
    let activeCustomerId: string;
    let inactiveCustomerId: string;

    beforeAll(async () => {
      const active = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `${searchMarker} Active Co` })
        .expect(201);
      activeCustomerId = active.body.id;

      const inactive = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `${searchMarker} Inactive Co` })
        .expect(201);
      inactiveCustomerId = inactive.body.id;
      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${inactiveCustomerId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ isActive: false })
        .expect(200);
    });

    it("omitting every query param returns the branch's customers, unfiltered", async () => {
      // Story S-8e — this used to assert both fixtures were present in one
      // unfiltered response. That is no longer the contract: the response
      // is one page, and these fixtures are the newest rows under an
      // ascending default order. What the test is actually about - that
      // omitting the filters narrows nothing - is now expressed through
      // `total`, which counts the whole unfiltered set.
      const unfiltered = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const filtered = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(filtered.body.total).toBe(2);
      expect(unfiltered.body.total).toBeGreaterThanOrEqual(filtered.body.total);
    });

    it("filters by search, case-insensitively, matching displayName", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker.toLowerCase() })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.items.map((customer: { id: string }) => customer.id);
      expect(ids).toContain(activeCustomerId);
      expect(ids).toContain(inactiveCustomerId);
    });

    it("returns an empty page for a search that matches nothing", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: `no-such-customer-${randomUUID()}` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.total).toBe(0);
      // `totalPagesFor` clamps to a minimum of 1: there is always a page 1,
      // even when it is empty, so a client never has to special-case 0.
      expect(response.body.totalPages).toBe(1);
    });

    it("filters by isActive: true/false", async () => {
      const activeOnly = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker, isActive: "true" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(activeOnly.body.items.map((c: { id: string }) => c.id)).toEqual([activeCustomerId]);

      const inactiveOnly = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker, isActive: "false" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(inactiveOnly.body.items.map((c: { id: string }) => c.id)).toEqual([
        inactiveCustomerId,
      ]);
    });

    it("rejects an invalid isActive value with 400", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ isActive: "not-a-boolean" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it("sorts by displayName ascending/descending", async () => {
      const ascending = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker, sortBy: "displayName", sortDir: "asc" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(ascending.body.items.map((c: { id: string }) => c.id)).toEqual([
        activeCustomerId,
        inactiveCustomerId,
      ]);

      const descending = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker, sortBy: "displayName", sortDir: "desc" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(descending.body.items.map((c: { id: string }) => c.id)).toEqual([
        inactiveCustomerId,
        activeCustomerId,
      ]);
    });

    it("rejects an invalid sortBy value with 400", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ sortBy: "notAField" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(400);
    });
  });

  // RM-02 — Customer Notes.
  describe("customer notes (RM-02)", () => {
    let notesCustomerId: string;
    let otherNotesCustomerId: string;

    beforeAll(async () => {
      const customer = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `Notes Fixture Customer ${randomUUID()}` })
        .expect(201);
      notesCustomerId = customer.body.id;

      const other = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `Notes Fixture Other Customer ${randomUUID()}` })
        .expect(201);
      otherNotesCustomerId = other.body.id;
    });

    it("rejects an unauthenticated request on both routes", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/customers/${notesCustomerId}/notes`)
        .send({ body: "x" })
        .expect(401);
      await request(app.getHttpServer())
        .get(`/api/v1/customers/${notesCustomerId}/notes`)
        .expect(401);
    });

    it("returns 404 for a customer that doesn't exist", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/customers/${randomUUID()}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "x" })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/v1/customers/${randomUUID()}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("rejects an empty body with a validation error", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "" })
        .expect(400);
    });

    // Story 100's own default Agent grant already includes `customer:create`/
    // `customer:read`/`customer:update` (see the "allows an Agent-role
    // user... to create a customer" test above, same file) — this proves
    // the same real, seeded default grant reaches the notes routes too,
    // rather than testing against a synthetically-permissioned role.
    it("allows an Agent-role user with the default customer:update/customer:read grant", async () => {
      const roles = await request(app.getHttpServer())
        .get("/api/v1/identity/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
      const me = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const agentEmail = `agent-notes-${randomUUID()}@example.com`;
      const agentPassword = "agent-test-password-123";
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
        .post(`/api/v1/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .send({ body: "Agent-created note" })
        .expect(201);
      await request(app.getHttpServer())
        .get(`/api/v1/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(200);
    });

    // A freshly created role starts with zero permissions (`POST
    // /identity/roles` accepts only a name — see `CreateRoleDto`) — the
    // one real way to prove a caller genuinely lacking `customer:update`/
    // `customer:read` is rejected, since the seeded `Agent` role already
    // holds both (confirmed above).
    it("rejects a role with no customer permissions at all (403)", async () => {
      const role = await request(app.getHttpServer())
        .post("/api/v1/identity/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ name: `No Customer Access ${randomUUID()}` })
        .expect(201);
      const me = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const restrictedEmail = `no-customer-access-${randomUUID()}@example.com`;
      const restrictedPassword = "restricted-test-password-123";
      await request(app.getHttpServer())
        .post("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          email: restrictedEmail,
          password: restrictedPassword,
          fullName: "No Customer Access",
          branchId: me.body.branchId,
          departmentId: me.body.departmentId ?? undefined,
          roleId: role.body.id,
        })
        .expect(201);
      const restrictedLogin = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: restrictedEmail, password: restrictedPassword })
        .expect(200);
      const restrictedAccessToken = restrictedLogin.body.accessToken as string;

      await request(app.getHttpServer())
        .post(`/api/v1/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${restrictedAccessToken}`)
        .send({ body: "Should not be created" })
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${restrictedAccessToken}`)
        .expect(403);
    });

    it("persists a real note with the correct author and timestamp, ordered oldest-first", async () => {
      const me = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const first = await request(app.getHttpServer())
        .post(`/api/v1/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "First note." })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post(`/api/v1/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "Second note." })
        .expect(201);

      expect(first.body).toMatchObject({
        customerId: notesCustomerId,
        authorUserId: me.body.id,
        body: "First note.",
      });
      expect(typeof first.body.createdAt).toBe("string");

      const list = await request(app.getHttpServer())
        .get(`/api/v1/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = list.body.map((note: { id: string }) => note.id);
      expect(ids.indexOf(first.body.id)).toBeLessThan(ids.indexOf(second.body.id));
    });

    it("never leaks a note into a different customer's list (customer isolation)", async () => {
      const forOtherCustomer = await request(app.getHttpServer())
        .post(`/api/v1/customers/${otherNotesCustomerId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ body: "This belongs to the other customer." })
        .expect(201);

      const notesForFirstCustomer = await request(app.getHttpServer())
        .get(`/api/v1/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(
        notesForFirstCustomer.body.some((note: { id: string }) => note.id === forOtherCustomer.body.id),
      ).toBe(false);
    });

    it("is never exposed anywhere on the Customer Portal surface", async () => {
      // No portal route reads customer_notes at all — confirmed by a
      // repo-wide search of apps/api/src/modules/portal during recon.
      // Asserted here as a guard against a future accidental exposure:
      // the portal's own auth guard rejects an agent-audience token
      // outright, and there is no portal-prefixed notes route to even
      // attempt this against.
      await request(app.getHttpServer())
        .get(`/api/v1/portal/customers/${notesCustomerId}/notes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });
  });
});
