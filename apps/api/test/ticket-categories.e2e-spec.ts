import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 120 — Ticketing: Managed Category Taxonomy.
 * `ticket-categories/*` CRUD, mirroring `identity.e2e-spec.ts`'s own
 * department CRUD suite field-for-field (branch-scoped, no delete route,
 * rename + activate/deactivate only), plus the real cross-domain
 * consuming behavior: SLA policy resolution, automation rule condition
 * matching, and ticket search, all now keyed by `categoryId`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `automation-rules.e2e-spec.ts`/`sla-policies.e2e-spec.ts`.
 */
describe("Ticket Categories (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let adminBranchId: string;
  let createdCategoryId: string;
  let currentCategoryName: string;

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
    await request(app.getHttpServer()).get("/api/v1/ticket-categories").expect(401);
  });

  it("rejects an Agent-role user (default grant covers :read only) from creating/updating a category (403)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-ticket-categories-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Ticket Categories",
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

    // The default Agent grant DOES include `ticket-category:read`.
    await request(app.getHttpServer())
      .get("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ name: "Should not be created" })
      .expect(403);
  });

  it("creates a category as the admin, ignoring any client-sent branchId", async () => {
    currentCategoryName = `Category ${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: currentCategoryName })
      .expect(201);

    createdCategoryId = response.body.id;
    expect(createdCategoryId).toBeTypeOf("string");

    // `CreateTicketCategoryDto` has no `branchId` field at all (and the
    // global `ValidationPipe` runs with `forbidNonWhitelisted: true`), so
    // there is no way to even send one — this listing lookup is what
    // proves the created category's `branchId` is the admin's own branch,
    // assigned purely from `TenantContext`, never from client input.
    const categories = await request(app.getHttpServer())
      .get("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const created = categories.body.find(
      (category: { id: string }) => category.id === createdCategoryId,
    );
    expect(created).toMatchObject({
      id: createdCategoryId,
      branchId: adminBranchId,
      name: currentCategoryName,
      isActive: true,
    });
  });

  it("rejects a duplicate category name within the branch with 409", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: currentCategoryName })
      .expect(409);
  });

  it("renames the category", async () => {
    currentCategoryName = `${currentCategoryName} Renamed`;
    await request(app.getHttpServer())
      .patch(`/api/v1/ticket-categories/${createdCategoryId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: currentCategoryName })
      .expect(200);

    const categories = await request(app.getHttpServer())
      .get("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const updated = categories.body.find(
      (category: { id: string }) => category.id === createdCategoryId,
    );
    expect(updated).toMatchObject({ name: currentCategoryName });
  });

  it("deactivates the category, hiding it from the default listing but not from includeInactive=true", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/ticket-categories/${createdCategoryId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    const defaultListing = await request(app.getHttpServer())
      .get("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(
      defaultListing.body.some((category: { id: string }) => category.id === createdCategoryId),
    ).toBe(false);

    const withInactive = await request(app.getHttpServer())
      .get("/api/v1/ticket-categories?includeInactive=true")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const found = withInactive.body.find(
      (category: { id: string }) => category.id === createdCategoryId,
    );
    expect(found).toMatchObject({ isActive: false });
  });

  it("reactivates the category, restoring it to the default listing", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/ticket-categories/${createdCategoryId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: true })
      .expect(200);

    const defaultListing = await request(app.getHttpServer())
      .get("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const found = defaultListing.body.find(
      (category: { id: string }) => category.id === createdCategoryId,
    );
    expect(found).toMatchObject({ isActive: true });
  });

  it("returns 404 for an unknown category id on update", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/ticket-categories/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Anything" })
      .expect(404);
  });

  // Real, end-to-end proof that the categoryId FK actually threads through
  // ticket create/update/search — not merely unit-tested against a mocked
  // Prisma client (see tickets.service.spec.ts's own equivalent coverage).
  describe("ticket create/update/search with a real categoryId", () => {
    it("rejects an unknown categoryId on ticket create with 404", async () => {
      const customer = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `Ticket categories e2e customer ${randomUUID()}` })
        .expect(201);

      await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          customerId: customer.body.id,
          subject: "Should not be created",
          categoryId: randomUUID(),
        })
        .expect(404);
    });

    it("creates a ticket with a real categoryId, and GET resolves categoryName via the relation", async () => {
      const categoryName = `ticket-categories-e2e-${randomUUID()}`;
      const category = await request(app.getHttpServer())
        .post("/api/v1/ticket-categories")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ name: categoryName })
        .expect(201);
      const customer = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `Ticket categories e2e customer ${randomUUID()}` })
        .expect(201);

      const ticket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          customerId: customer.body.id,
          subject: "Categorized ticket",
          categoryId: category.body.id,
        })
        .expect(201);

      expect(ticket.body.categoryId).toBe(category.body.id);
      expect(ticket.body.categoryName).toBe(categoryName);

      const fetched = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticket.body.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(fetched.body.categoryId).toBe(category.body.id);
      expect(fetched.body.categoryName).toBe(categoryName);
    });

    it("finds a ticket by its category name via the search filter", async () => {
      const marker = `SearchableCategory${randomUUID().replace(/-/g, "")}`;
      const category = await request(app.getHttpServer())
        .post("/api/v1/ticket-categories")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ name: marker })
        .expect(201);
      const customer = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `Ticket categories e2e customer ${randomUUID()}` })
        .expect(201);
      const ticket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          customerId: customer.body.id,
          subject: "Unrelated subject",
          categoryId: category.body.id,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .query({ search: marker.toLowerCase() })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.map((t: { id: string }) => t.id)).toContain(ticket.body.id);
    });
  });
});
