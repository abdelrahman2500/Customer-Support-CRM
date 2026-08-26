import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

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
 */
describe("Ticketing (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let adminUserId: string;
  let customerId: string;
  let otherCustomerId: string;
  let contactId: string;
  let ticketId: string;

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
});
