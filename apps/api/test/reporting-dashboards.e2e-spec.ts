import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 110 — `reports/dashboards/*` CRUD
 * (saved dashboards). Bootstraps the REAL `AppModule` against a REAL
 * Postgres, exactly like `quick-replies.e2e-spec.ts`.
 */
describe("Reporting — Saved Dashboards (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let adminBranchId: string;
  let secondAgentAccessToken: string;

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

    // A second user in the SAME branch — used to prove shared-visibility
    // and ownership-scoped write rules (a non-owner, even in the same
    // branch, can see a shared dashboard but never write to it). The
    // seeded `Agent` role deliberately excludes `report:read` (Story
    // 100's own doc comment: "excluding every admin/configuration-only
    // permission... reporting..."), so — mirroring
    // `notification-read-state.e2e-spec.ts`'s own
    // `createNotificationReaderAgent` pattern — this creates a dedicated
    // custom role granted only `report:read`, never touching the shared
    // seeded `Agent` role.
    const roleResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `Report Reader E2E Role ${randomUUID()}` })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${roleResponse.body.id}/permissions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ permissionKeys: ["report:read"] })
      .expect(200);

    const secondAgentEmail = `dashboards-e2e-agent-${randomUUID()}@example.com`;
    const secondAgentPassword = "second-agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: secondAgentEmail,
        password: secondAgentPassword,
        fullName: "Test Second Agent Dashboards",
        branchId: adminBranchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: roleResponse.body.id,
      })
      .expect(201);
    const secondAgentLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    secondAgentAccessToken = secondAgentLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/reports/dashboards").expect(401);
  });

  it("rejects an empty name or empty/duplicate widgetTypes with 400", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/reports/dashboards")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "", widgetTypes: ["TICKET_VOLUME"] })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/reports/dashboards")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Some name", widgetTypes: [] })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/reports/dashboards")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Some name", widgetTypes: ["TICKET_VOLUME", "TICKET_VOLUME"] })
      .expect(400);
  });

  it("creates a private dashboard, lists it for the owner, and hides it from another agent until shared", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/reports/dashboards")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        name: `Private dashboard ${randomUUID()}`,
        widgetTypes: ["TICKET_VOLUME", "CSAT"],
      })
      .expect(201);
    const dashboardId = createResponse.body.id;

    const ownerList = await request(app.getHttpServer())
      .get("/api/v1/reports/dashboards")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const ownedRow = ownerList.body.find((d: { id: string }) => d.id === dashboardId);
    expect(ownedRow).toMatchObject({
      isShared: false,
      isOwner: true,
      widgets: [
        { widgetType: "TICKET_VOLUME", position: 0 },
        { widgetType: "CSAT", position: 1 },
      ],
    });

    // Not visible to the second agent yet (private, not the owner).
    const otherList = await request(app.getHttpServer())
      .get("/api/v1/reports/dashboards")
      .set("Authorization", `Bearer ${secondAgentAccessToken}`)
      .expect(200);
    expect(otherList.body.map((d: { id: string }) => d.id)).not.toContain(dashboardId);
    await request(app.getHttpServer())
      .get(`/api/v1/reports/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${secondAgentAccessToken}`)
      .expect(404);

    // The owner shares it.
    await request(app.getHttpServer())
      .patch(`/api/v1/reports/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isShared: true })
      .expect(200);

    // Now visible (read-only) to the second agent.
    const afterShareGet = await request(app.getHttpServer())
      .get(`/api/v1/reports/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${secondAgentAccessToken}`)
      .expect(200);
    expect(afterShareGet.body).toMatchObject({ isShared: true, isOwner: false });

    // But the second agent (a non-owner) still cannot write to it.
    await request(app.getHttpServer())
      .patch(`/api/v1/reports/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${secondAgentAccessToken}`)
      .send({ name: "Hijacked name" })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/reports/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${secondAgentAccessToken}`)
      .expect(404);
  });

  it("fully replaces the widget list on update", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/reports/dashboards")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `Reorder test ${randomUUID()}`, widgetTypes: ["TICKET_VOLUME", "CSAT"] })
      .expect(201);
    const dashboardId = createResponse.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/reports/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ widgetTypes: ["RESOLUTION_TIME", "TICKET_AGING", "SLA_COMPLIANCE"] })
      .expect(200);

    const afterUpdate = await request(app.getHttpServer())
      .get(`/api/v1/reports/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(afterUpdate.body.widgets).toEqual([
      { widgetType: "RESOLUTION_TIME", position: 0 },
      { widgetType: "TICKET_AGING", position: 1 },
      { widgetType: "SLA_COMPLIANCE", position: 2 },
    ]);
  });

  it("deletes a dashboard, and it 404s afterward", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/reports/dashboards")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `Delete test ${randomUUID()}`, widgetTypes: ["TICKET_VOLUME"] })
      .expect(201);
    const dashboardId = createResponse.body.id;

    await request(app.getHttpServer())
      .delete(`/api/v1/reports/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/reports/dashboards/${dashboardId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("returns 404 for an unknown dashboard id (get/update/delete)", async () => {
    const unknownId = randomUUID();
    await request(app.getHttpServer())
      .get(`/api/v1/reports/dashboards/${unknownId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/reports/dashboards/${unknownId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "x" })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/reports/dashboards/${unknownId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });
});
