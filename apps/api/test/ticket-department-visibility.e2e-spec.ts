import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 68 (Ticket Department-Scoped Visibility) —
 * `Role.ticketVisibilityScope` and the resulting `GET /tickets`/
 * `GET /tickets/:id` filtering. Bootstraps the REAL `AppModule` against a
 * REAL Postgres/Redis, exactly like every sibling e2e suite.
 *
 * Deliberately its own file, not appended to `identity.e2e-spec.ts` — that
 * file has disclosed, pre-existing test-isolation defects (`CLAUDE.md`
 * §13) unrelated to this Story; keeping this suite separate avoids
 * entangling with them.
 */
describe("Ticket Department-Scoped Visibility (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let deptScopedAccessToken: string;
  let deptATicketId: string;
  let deptBTicketId: string;
  let unassignedTicketId: string;

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
    const branchId = me.body.branchId as string;

    // A DEPARTMENT-scoped custom role, granted the same permissions as a
    // real agent needs to exercise the ticket surface.
    const role = await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `Dept Visibility Role ${randomUUID()}`, ticketVisibilityScope: "DEPARTMENT" })
      .expect(201);
    const roleId = role.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${roleId}/permissions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ permissionKeys: ["ticket:read", "ticket:create"] })
      .expect(200);

    const deptA = await request(app.getHttpServer())
      .post("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `Dept A ${randomUUID()}` })
      .expect(201);
    const deptB = await request(app.getHttpServer())
      .post("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `Dept B ${randomUUID()}` })
      .expect(201);

    const deptScopedEmail = `dept-scoped-${randomUUID()}@example.com`;
    const deptScopedPassword = "dept-scoped-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: deptScopedEmail,
        password: deptScopedPassword,
        fullName: "Dept Scoped Agent",
        branchId,
        departmentId: deptA.body.id,
        roleId,
      })
      .expect(201);
    const deptScopedLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: deptScopedEmail, password: deptScopedPassword })
      .expect(200);
    deptScopedAccessToken = deptScopedLogin.body.accessToken;

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Dept Visibility Fixture Customer ${randomUUID()}` })
      .expect(201);
    const customerId = customer.body.id;

    const deptATicket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, subject: "Dept A ticket", departmentId: deptA.body.id })
      .expect(201);
    deptATicketId = deptATicket.body.id;

    const deptBTicket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, subject: "Dept B ticket", departmentId: deptB.body.id })
      .expect(201);
    deptBTicketId = deptBTicket.body.id;

    const unassignedTicket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ customerId, subject: "Unassigned-department ticket" })
      .expect(201);
    unassignedTicketId = unassignedTicket.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("a DEPARTMENT-scoped caller's GET /tickets includes only their department's ticket and the unassigned one", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${deptScopedAccessToken}`)
      .expect(200);

    const ids = response.body.map((ticket: { id: string }) => ticket.id);
    expect(ids).toContain(deptATicketId);
    expect(ids).toContain(unassignedTicketId);
    expect(ids).not.toContain(deptBTicketId);
  });

  it("a DEPARTMENT-scoped caller can GET their own department's ticket and the unassigned one directly", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${deptATicketId}`)
      .set("Authorization", `Bearer ${deptScopedAccessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${unassignedTicketId}`)
      .set("Authorization", `Bearer ${deptScopedAccessToken}`)
      .expect(200);
  });

  it("a DEPARTMENT-scoped caller gets 404, not 403, for a ticket in a different department", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tickets/${deptBTicketId}`)
      .set("Authorization", `Bearer ${deptScopedAccessToken}`)
      .expect(404);
  });

  it("a BRANCH-scoped caller (the seed admin, default scope) still sees every ticket — unchanged, pre-Story-68 behavior", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ids = response.body.map((ticket: { id: string }) => ticket.id);
    expect(ids).toContain(deptATicketId);
    expect(ids).toContain(deptBTicketId);
    expect(ids).toContain(unassignedTicketId);
  });
});
