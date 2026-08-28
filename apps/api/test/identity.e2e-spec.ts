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
 *
 * Known scope limit: `prisma/seed.ts` creates exactly one Branch per
 * organization, and there is deliberately no branch-create endpoint (Story
 * 45's plan keeps branch creation out of scope), so this suite cannot
 * produce a second, colliding branch to exercise a duplicate BRANCH name
 * 409 end-to-end. That path is covered by
 * `identity.service.spec.ts`'s mocked-Prisma `updateBranch` P2002 test
 * (unit-only).
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
  const secondAgentEmail = `agent2-${randomUUID()}@example.com`;
  const secondAgentPassword = "agent2-test-password-123";
  let createdDepartmentId: string;
  let currentDepartmentName: string;

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

  it("rejects a branches/departments request with no token", async () => {
    await request(app.getHttpServer()).get("/api/v1/identity/branches").expect(401);
    await request(app.getHttpServer()).get("/api/v1/identity/departments").expect(401);
  });

  it("lists exactly the admin's own branch via GET /identity/branches", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/identity/branches")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body).toEqual([
      { id: adminBranchId, name: expect.any(String), isActive: true },
    ]);
  });

  it("lists the admin's own branch's departments via GET /identity/departments", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    for (const department of response.body) {
      expect(department).toMatchObject({ branchId: adminBranchId });
    }
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

  it("rejects the Agent user (no branch:read permission) from listing branches/departments (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .get("/api/v1/identity/branches")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${agentAccessToken}`)
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

  it("rejects PATCH /identity/branches/:id, POST /identity/departments, and PATCH /identity/departments/:id with no token", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/branches/${adminBranchId}`)
      .send({ name: "Should Not Apply" })
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/identity/departments")
      .send({ name: "Should Not Be Created" })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/departments/${randomUUID()}`)
      .send({ name: "Should Not Apply" })
      .expect(401);
  });

  it("creates a second Agent-role user for the new branch/department permission checks", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: secondAgentEmail,
        password: secondAgentPassword,
        fullName: "Second Test Agent",
        branchId: adminBranchId,
        departmentId: adminDepartmentId ?? undefined,
        roleId: agentRoleId,
      })
      .expect(201);

    expect(response.body.email).toBe(secondAgentEmail);
  });

  it("rejects the Agent user (no branch:update permission) from updating the branch (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/branches/${adminBranchId}`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ name: "Should Not Apply" })
      .expect(403);
  });

  it("rejects the Agent user (no department:create permission) from creating a department (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .post("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ name: "Should Not Be Created" })
      .expect(403);
  });

  it("rejects the Agent user (no department:update permission) from updating a department (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/departments/${adminDepartmentId}`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ name: "Should Not Apply" })
      .expect(403);
  });

  it("renames the branch as the admin", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/identity/branches/${adminBranchId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Renamed Main Branch" })
      .expect(200);

    expect(response.body).toEqual({ id: adminBranchId });

    const branches = await request(app.getHttpServer())
      .get("/api/v1/identity/branches")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(branches.body).toEqual([
      { id: adminBranchId, name: "Renamed Main Branch", isActive: true },
    ]);
  });

  it("deactivates the branch, hiding it from the default listing but not from includeInactive=true", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/branches/${adminBranchId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    const defaultListing = await request(app.getHttpServer())
      .get("/api/v1/identity/branches")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(defaultListing.body).toEqual([]);

    const withInactive = await request(app.getHttpServer())
      .get("/api/v1/identity/branches?includeInactive=true")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(withInactive.body).toEqual([
      { id: adminBranchId, name: "Renamed Main Branch", isActive: false },
    ]);
  });

  it("reactivates the branch, restoring it to the default listing", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/branches/${adminBranchId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: true })
      .expect(200);

    const defaultListing = await request(app.getHttpServer())
      .get("/api/v1/identity/branches")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(defaultListing.body).toEqual([
      { id: adminBranchId, name: "Renamed Main Branch", isActive: true },
    ]);
  });

  it("creates a department as the admin, ignoring any client-sent branchId", async () => {
    currentDepartmentName = `Dept ${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: currentDepartmentName })
      .expect(201);

    createdDepartmentId = response.body.id;
    expect(createdDepartmentId).toBeTypeOf("string");

    // `CreateDepartmentDto` has no `branchId` field at all (and the global
    // `ValidationPipe` runs with `forbidNonWhitelisted: true`), so there is no
    // way to even send one — this listing lookup is what proves the created
    // department's `branchId` is the admin's own branch, assigned purely from
    // `TenantContext`, never from client input.
    const departments = await request(app.getHttpServer())
      .get("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const created = departments.body.find(
      (department: { id: string }) => department.id === createdDepartmentId,
    );
    expect(created).toMatchObject({
      id: createdDepartmentId,
      branchId: adminBranchId,
      name: currentDepartmentName,
      isActive: true,
    });
  });

  it("renames the department", async () => {
    currentDepartmentName = `${currentDepartmentName} Renamed`;
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/departments/${createdDepartmentId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: currentDepartmentName })
      .expect(200);

    const departments = await request(app.getHttpServer())
      .get("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const updated = departments.body.find(
      (department: { id: string }) => department.id === createdDepartmentId,
    );
    expect(updated).toMatchObject({ name: currentDepartmentName });
  });

  it("deactivates the department, hiding it from the default listing but not from includeInactive=true", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/departments/${createdDepartmentId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    const defaultListing = await request(app.getHttpServer())
      .get("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(
      defaultListing.body.some((department: { id: string }) => department.id === createdDepartmentId),
    ).toBe(false);

    const withInactive = await request(app.getHttpServer())
      .get("/api/v1/identity/departments?includeInactive=true")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const found = withInactive.body.find(
      (department: { id: string }) => department.id === createdDepartmentId,
    );
    expect(found).toMatchObject({ isActive: false });
  });

  it("reactivates the department, restoring it to the default listing", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/departments/${createdDepartmentId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: true })
      .expect(200);

    const defaultListing = await request(app.getHttpServer())
      .get("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const found = defaultListing.body.find(
      (department: { id: string }) => department.id === createdDepartmentId,
    );
    expect(found).toMatchObject({ isActive: true });
  });

  it("rejects a duplicate department name within the branch with 409", async () => {
    const duplicateName = `Dup Dept ${randomUUID()}`;
    await request(app.getHttpServer())
      .post("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: duplicateName })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: duplicateName })
      .expect(409);
  });

  it("does not strip a user's department assignment when the department is deactivated", async () => {
    const regressionDeptName = `Regression Dept ${randomUUID()}`;
    const createDeptResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: regressionDeptName })
      .expect(201);
    const regressionDepartmentId = createDeptResponse.body.id as string;

    const regressionAgentEmail = `regression-agent-${randomUUID()}@example.com`;
    const regressionAgentPassword = "regression-agent-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: regressionAgentEmail,
        password: regressionAgentPassword,
        fullName: "Regression Agent",
        branchId: adminBranchId,
        departmentId: regressionDepartmentId,
        roleId: agentRoleId,
      })
      .expect(201);

    const loginBefore = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: regressionAgentEmail, password: regressionAgentPassword })
      .expect(200);
    const meBefore = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginBefore.body.accessToken}`)
      .expect(200);
    expect(meBefore.body.departmentId).toBe(regressionDepartmentId);

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/departments/${regressionDepartmentId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    // Deactivation must not cascade to the user: they stay listed and active...
    const usersAfter = await request(app.getHttpServer())
      .get("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const regressionUser = usersAfter.body.find(
      (user: { email: string }) => user.email === regressionAgentEmail,
    );
    expect(regressionUser).toMatchObject({ isActive: true });

    // ...and, more to the point, their `UserBranchRole.departmentId` is left
    // completely untouched — surfaced here via the `departmentId` claim
    // `GET /auth/me` reports after a fresh login.
    const loginAfter = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: regressionAgentEmail, password: regressionAgentPassword })
      .expect(200);
    const meAfter = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginAfter.body.accessToken}`)
      .expect(200);
    expect(meAfter.body.departmentId).toBe(regressionDepartmentId);
  });
});
