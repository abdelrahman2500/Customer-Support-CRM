import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 57 — `automation-rules/*` CRUD and the real
 * `ticket.created` → `automation.rule_matched` → assignment reaction.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `sla-policies.e2e-spec.ts`. The admin's own user id (already a real,
 * in-branch `User`) stands in as the assignment target for the matching-rule
 * tests — no dedicated second user is needed for those.
 */
describe("Automation Rules (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let adminUserId: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  async function createTicket(category?: string): Promise<{ id: string; assignedToUserId: string | null }> {
    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Automation rules e2e customer ${randomUUID()}` })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: customer.body.id,
        subject: "Automation rules e2e ticket",
        ...(category ? { category } : {}),
      })
      .expect(201);
    return ticket.body;
  }

  async function waitForAssignment(
    ticketId: string,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<request.Response> {
    const deadline = Date.now() + timeoutMs;
    let lastResponse: request.Response;
    do {
      lastResponse = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`);
      if (lastResponse.body?.assignedToUserId) {
        return lastResponse;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    return lastResponse;
  }

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/automation-rules").expect(401);
  });

  it("rejects an Agent-role user lacking automation:* (403)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-automation-rules-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Automation Rules",
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
      .get("/api/v1/automation-rules")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/v1/automation-rules")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ name: "Should not be created", actionAssignToUserId: adminUserId })
      .expect(403);
  });

  it("rejects an unknown actionAssignToUserId with 404", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/automation-rules")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Bad rule", actionAssignToUserId: randomUUID() })
      .expect(404);
  });

  it("creates, lists, gets, and updates a rule", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/automation-rules")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "CRUD test rule", actionAssignToUserId: adminUserId })
      .expect(201);
    const ruleId = createResponse.body.id;
    expect(createResponse.body.isActive).toBe(true);
    expect(createResponse.body.conditionCategory).toBeNull();

    const listResponse = await request(app.getHttpServer())
      .get("/api/v1/automation-rules")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(listResponse.body.map((rule: { id: string }) => rule.id)).toContain(ruleId);

    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/automation-rules/${ruleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(getResponse.body.id).toBe(ruleId);

    await request(app.getHttpServer())
      .patch(`/api/v1/automation-rules/${ruleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    const afterUpdate = await request(app.getHttpServer())
      .get(`/api/v1/automation-rules/${ruleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterUpdate.body.isActive).toBe(false);
  });

  it("returns 404 for an unknown rule id", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/automation-rules/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("auto-assigns a real, newly-created ticket matching an active category-scoped rule, and logs it in history", async () => {
    const matchingCategory = `automation-rules-e2e-${randomUUID()}`;
    await request(app.getHttpServer())
      .post("/api/v1/automation-rules")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        name: "Auto-assign matching category",
        conditionCategory: matchingCategory,
        actionAssignToUserId: adminUserId,
      })
      .expect(201);

    const ticket = await createTicket(matchingCategory);
    expect(ticket.assignedToUserId).toBeNull();

    const response = await waitForAssignment(ticket.id);
    expect(response.body.assignedToUserId).toBe(adminUserId);

    const history = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticket.id}/history`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(
      history.body.some((entry: { eventType: string }) => entry.eventType === "ticket.updated"),
    ).toBe(true);
  });

  it("auto-assigns via a wildcard (conditionCategory: null) rule when no category-specific rule matches", async () => {
    // Unlike every other rule this suite creates (each scoped to its own
    // `randomUUID()` category, so it can never match another suite's
    // ticket), a *wildcard* rule matches literally every ticket in this
    // shared branch — left active, it would silently auto-assign every
    // ticket every other e2e suite creates afterward (extra, unexpected
    // `ticket.updated` history entries breaking their own assertions). The
    // `finally` guarantees it is deactivated before this suite's next test
    // runs, even if an assertion above throws.
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/automation-rules")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Wildcard auto-assign", actionAssignToUserId: adminUserId })
      .expect(201);
    const wildcardRuleId = createResponse.body.id;

    try {
      const ticket = await createTicket(`unmatched-category-${randomUUID()}`);
      const response = await waitForAssignment(ticket.id);
      expect(response.body.assignedToUserId).toBe(adminUserId);
    } finally {
      await request(app.getHttpServer())
        .patch(`/api/v1/automation-rules/${wildcardRuleId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ isActive: false });
    }
  });

  it("never overrides an explicit assignedToUserId set at creation", async () => {
    // A dedicated second user, distinct from `adminUserId` (the rule's own
    // action target) — if automation incorrectly fired here, the ticket
    // would end up assigned to `adminUserId` instead, which this test can
    // actually detect (unlike asserting against the same user the rule
    // would assign anyway).
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const explicitAgent = await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: `agent-explicit-assignment-${randomUUID()}@example.com`,
        password: "agent-test-password-123",
        fullName: "Test Agent Explicit Assignment",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);
    const explicitAgentId = explicitAgent.body.id;

    const matchingCategory = `automation-rules-e2e-explicit-${randomUUID()}`;
    await request(app.getHttpServer())
      .post("/api/v1/automation-rules")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        name: "Should not override",
        conditionCategory: matchingCategory,
        actionAssignToUserId: adminUserId,
      })
      .expect(201);

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Automation rules e2e explicit customer ${randomUUID()}` })
      .expect(201);
    const ticket = await request(app.getHttpServer())
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        customerId: customer.body.id,
        subject: "Explicitly assigned ticket",
        category: matchingCategory,
        assignedToUserId: explicitAgentId,
      })
      .expect(201);
    expect(ticket.body.assignedToUserId).toBe(explicitAgentId);

    // Give the (inapplicable) automation reaction a moment to have fired if
    // it were going to.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const response = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticket.body.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(response.body.assignedToUserId).toBe(explicitAgentId);
  });
});
