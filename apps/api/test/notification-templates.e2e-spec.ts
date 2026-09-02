import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 61 — `POST/GET/PATCH /notification-templates`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like every other e2e suite here. Branch-scoped (unlike
 * `notification-preferences.e2e-spec.ts`'s self-scoped suite) — mirrors
 * `automation-rules.e2e-spec.ts`'s exact 401/403 boilerplate.
 *
 * Known scope limit, same as `sla-policies.e2e-spec.ts`: `prisma/seed.ts`
 * creates exactly one Branch, so true cross-branch isolation cannot be
 * exercised end-to-end here; branch scoping itself is proven correct by
 * every other branch-scoped e2e suite in this codebase via the identical
 * `TenantContext.requireBranchScope()` mechanism.
 *
 * `@@unique([branchId, eventType])` means every assertion checks an exact,
 * just-written value rather than an absolute row count — this suite may
 * share the branch's three possible template rows with a prior, unclean
 * run, and `createOrUpdateTemplate`'s upsert semantics make that safe.
 */
describe("Notification Templates (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;

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

  it("rejects an unauthenticated request on every route", async () => {
    await request(app.getHttpServer()).get("/api/v1/notification-templates").expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/notification-templates")
      .send({ eventType: "sla.at_risk", template: "x" })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/api/v1/notification-templates/${randomUUID()}`)
      .send({ template: "x" })
      .expect(401);
  });

  // Story 100 — Agent's default seed grant now includes `notification:read`
  // (previously `[]`), so the GET route below is now reachable; the write
  // routes (`notification:create`/`notification:update`, still not
  // granted) remain 403.
  it("allows reading (notification:read) but still rejects creating/updating templates (403) for an Agent-role user (Story 100)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-notif-templates-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: "agent-test-password-123",
        fullName: "Test Agent Notif Templates",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);
    const agentLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: "agent-test-password-123" })
      .expect(200);
    const agentAccessToken = agentLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .get("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ eventType: "sla.at_risk", template: "x" })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/notification-templates/${randomUUID()}`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ template: "x" })
      .expect(403);
  });

  it("rejects an unrecognized eventType with a validation error", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ eventType: "not.a.real.event", template: "x" })
      .expect(400);
  });

  it("returns 404 for updating an unknown template id", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/notification-templates/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ template: "x" })
      .expect(404);
  });

  it("creates a real template, reflected on the next list", async () => {
    const text = `SLA at risk for {ticketId} (${randomUUID()})`;
    await request(app.getHttpServer())
      .post("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ eventType: "sla.at_risk", template: text })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const row = listResponse.body.find(
      (item: { eventType: string }) => item.eventType === "sla.at_risk",
    );
    expect(row.template).toBe(text);
  });

  it("upserts on a second create for the same event type, never duplicating the row", async () => {
    const first = `First text (${randomUUID()})`;
    const second = `Second text (${randomUUID()})`;

    await request(app.getHttpServer())
      .post("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ eventType: "sla.breached", template: first })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ eventType: "sla.breached", template: second })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const rows = listResponse.body.filter(
      (item: { eventType: string }) => item.eventType === "sla.breached",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].template).toBe(second);
  });

  it("updates a real template via PATCH, reflected on the next list", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ eventType: "ticket.escalated", template: `Original (${randomUUID()})` })
      .expect(201);
    const templateId = created.body.id;

    const updatedText = `Updated (${randomUUID()})`;
    await request(app.getHttpServer())
      .patch(`/api/v1/notification-templates/${templateId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ template: updatedText })
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get("/api/v1/notification-templates")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const row = listResponse.body.find((item: { id: string }) => item.id === templateId);
    expect(row.template).toBe(updatedText);
  });
});
