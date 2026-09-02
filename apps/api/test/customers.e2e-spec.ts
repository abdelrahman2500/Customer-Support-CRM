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
    const response = await request(app.getHttpServer())
      .get("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ids = response.body.map((customer: { id: string }) => customer.id);
    expect(ids).toContain(customerId);
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

    it("omitting every query param returns every customer in the branch, unaffected", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.map((customer: { id: string }) => customer.id);
      expect(ids).toContain(activeCustomerId);
      expect(ids).toContain(inactiveCustomerId);
    });

    it("filters by search, case-insensitively, matching displayName", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker.toLowerCase() })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const ids = response.body.map((customer: { id: string }) => customer.id);
      expect(ids).toContain(activeCustomerId);
      expect(ids).toContain(inactiveCustomerId);
    });

    it("returns [] for a search that matches nothing", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: `no-such-customer-${randomUUID()}` })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("filters by isActive: true/false", async () => {
      const activeOnly = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker, isActive: "true" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(activeOnly.body.map((c: { id: string }) => c.id)).toEqual([activeCustomerId]);

      const inactiveOnly = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker, isActive: "false" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(inactiveOnly.body.map((c: { id: string }) => c.id)).toEqual([inactiveCustomerId]);
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
      expect(ascending.body.map((c: { id: string }) => c.id)).toEqual([
        activeCustomerId,
        inactiveCustomerId,
      ]);

      const descending = await request(app.getHttpServer())
        .get("/api/v1/customers")
        .query({ search: searchMarker, sortBy: "displayName", sortDir: "desc" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(descending.body.map((c: { id: string }) => c.id)).toEqual([
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
});
