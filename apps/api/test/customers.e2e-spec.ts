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

  it("rejects an Agent-role user attempting to create a customer (403)", async () => {
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
      .expect(403);
  });
});
