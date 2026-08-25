import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for the `auth/*` and `identity/*` HTTP surface.
 *
 * Bootstraps the REAL `AppModule` — the same guards
 * (`AuthGuard`/`PermissionsGuard`/`ThrottlerGuard`), the same
 * `AuditInterceptor`, the same `TenantMiddleware`, the same global
 * `ValidationPipe`/prefix as `src/main.ts` — against a REAL Postgres/Redis.
 * See docs/architecture/11-quality-and-operations.md ("Testing strategy").
 *
 * Requires `DATABASE_URL`/`REDIS_URL` pointed at a real, migrated, and
 * SEEDED database (`pnpm --filter @crm/api prisma:migrate` then
 * `prisma:seed`) — locally via `docker-compose.yml`, or via the Postgres/
 * Redis service containers configured in `.github/workflows/ci.yml`. It
 * logs in as the seed's bootstrap admin (`SEED_ADMIN_EMAIL`/
 * `SEED_ADMIN_PASSWORD`) rather than creating its own bootstrap user.
 */
describe("Identity & Access (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let adminBranchId: string;
  let adminDepartmentId: string | null;
  let agentRoleId: string;
  let createdAgentUserId: string;
  const agentEmail = `agent-${randomUUID()}@example.com`;
  const agentPassword = "agent-test-password-123";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects login with a wrong password", async () => {
    const email = process.env.SEED_ADMIN_EMAIL;
    if (!email) {
      throw new Error("SEED_ADMIN_EMAIL must be set for this suite to run");
    }
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "definitely-the-wrong-password" })
      .expect(401);
  });

  it("logs in as the seeded admin and issues an access token + refresh cookie", async () => {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must be set for this suite to run");
    }

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);

    expect(response.body.accessToken).toBeTypeOf("string");
    expect(response.headers["set-cookie"]?.[0]).toMatch(/^refreshToken=/);
    adminAccessToken = response.body.accessToken;
  });

  it("returns the authenticated admin from GET /auth/me", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body.email).toBe(process.env.SEED_ADMIN_EMAIL);
    adminBranchId = response.body.branchId;
    adminDepartmentId = response.body.departmentId;
    expect(adminBranchId).toBeTypeOf("string");
  });

  it("rejects an identity route with no token", async () => {
    await request(app.getHttpServer()).get("/api/v1/identity/users").expect(401);
  });

  it("lists roles and permissions as the admin", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const roleNames = roles.body.map((role: { name: string }) => role.name);
    expect(roleNames).toContain("SuperAdmin");
    expect(roleNames).toContain("Agent");

    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    agentRoleId = agentRole.id;

    const permissions = await request(app.getHttpServer())
      .get("/api/v1/identity/permissions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const permissionKeys = permissions.body.map((p: { key: string }) => p.key);
    expect(permissionKeys).toEqual(
      expect.arrayContaining([
        "user:create",
        "user:read",
        "user:update",
        "role:read",
        "permission:read",
      ]),
    );
  });

  it("creates a new Agent-role user as the admin", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent",
        branchId: adminBranchId,
        departmentId: adminDepartmentId ?? undefined,
        roleId: agentRoleId,
      })
      .expect(201);

    expect(response.body.email).toBe(agentEmail);
    createdAgentUserId = response.body.id;
  });

  it("lists users in the admin's branch, including the newly created agent", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const emails = response.body.map((user: { email: string }) => user.email);
    expect(emails).toContain(agentEmail);
  });

  it("rejects the Agent user attempting to create another user (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({
        email: `should-not-be-created-${randomUUID()}@example.com`,
        password: "whatever-password",
        fullName: "Should Not Be Created",
        branchId: adminBranchId,
        roleId: agentRoleId,
      })
      .expect(403);
  });

  it("deactivates the agent user, after which they can no longer log in", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(401);
  });
});
