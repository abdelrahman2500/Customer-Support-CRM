import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for the `sla-policies/*` HTTP surface.
 *
 * Bootstraps the REAL `AppModule` — same guards
 * (`AuthGuard`/`PermissionsGuard`/`ThrottlerGuard`), same `AuditInterceptor`,
 * same `TenantMiddleware`, same global `ValidationPipe`/prefix as
 * `src/main.ts` — against a REAL Postgres/Redis, exactly like
 * `customers.e2e-spec.ts`. Requires `DATABASE_URL`/`REDIS_URL` pointed at a
 * real, migrated, and SEEDED database. Logs in as the seed's bootstrap admin
 * and obtains a real, in-scope `departmentId` via `GET /api/v1/auth/me` —
 * there is no department-listing endpoint anywhere in this codebase.
 *
 * Known scope limit, same as `customers.e2e-spec.ts`/`tickets.e2e-spec.ts`:
 * `prisma/seed.ts` creates exactly one Branch, so this suite cannot exercise
 * true cross-branch isolation end-to-end. The "unknown department"/"unknown
 * policy id" cases below stand in for that; true cross-branch rejection is
 * covered by `sla-policies.service.spec.ts`'s mocked-TenantContext tests.
 */
describe("SLA Policies (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let departmentId: string | null;
  let policyId: string;

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
    departmentId = me.body.departmentId;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/sla-policies").expect(401);
  });

  it("creates a branch-wide policy (no department/category/priority) as the admin", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ responseTargetMinutes: 60, resolutionTargetMinutes: 480 })
      .expect(201);

    expect(response.body.departmentId).toBeNull();
    expect(response.body.category).toBeNull();
    expect(response.body.priority).toBeNull();
    expect(response.body.isActive).toBe(true);
    policyId = response.body.id;
  });

  it("creates a scoped policy with department/category/priority", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        departmentId: departmentId ?? undefined,
        category: "billing",
        priority: "HIGH",
        responseTargetMinutes: 30,
        resolutionTargetMinutes: 240,
      })
      .expect(201);

    expect(response.body.category).toBe("billing");
    expect(response.body.priority).toBe("HIGH");
  });

  it("rejects an unknown departmentId with 404", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        departmentId: randomUUID(),
        responseTargetMinutes: 60,
        resolutionTargetMinutes: 480,
      })
      .expect(404);
  });

  it("lists policies in the caller's active branch, including the new ones", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const ids = response.body.map((policy: { id: string }) => policy.id);
    expect(ids).toContain(policyId);
  });

  it("gets a single policy", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/sla-policies/${policyId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.id).toBe(policyId);
  });

  it("returns 404 for an unknown policy id", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/sla-policies/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
  });

  it("updates the policy", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/sla-policies/${policyId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ responseTargetMinutes: 30, isActive: false })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/sla-policies/${policyId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(after.body.responseTargetMinutes).toBe(30);
    expect(after.body.isActive).toBe(false);
  });

  it("rejects updating with an unknown departmentId with 404", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/sla-policies/${policyId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ departmentId: randomUUID() })
      .expect(404);
  });

  it("rejects an Agent-role user attempting to create an SLA policy (403)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-sla-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent SLA",
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
      .post("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ responseTargetMinutes: 60, resolutionTargetMinutes: 480 })
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/sla-policies")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
  });
});
