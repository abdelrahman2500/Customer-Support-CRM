import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

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
  let customRoleId: string;
  let customRoleName: string;
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
    const prisma = app.get(PrismaService);
    const agentRole = await prisma.role.findUnique({ where: { name: "Agent" } });
    if (agentRole) {
      await prisma.rolePermission.deleteMany({ where: { roleId: agentRole.id } });
    }
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

  // ---------------------------------------------------------------------
  // Story 46 — Role & Permission Management
  // ---------------------------------------------------------------------

  it("rejects POST /identity/roles, PATCH /identity/roles/:id, and PATCH /identity/roles/:id/permissions with no token", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .send({ name: "Should Not Be Created" })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${agentRoleId}`)
      .send({ name: "Should Not Apply" })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${agentRoleId}/permissions`)
      .send({ permissionKeys: [] })
      .expect(401);
  });

  it("rejects the Agent user (no role:create permission) from creating a role (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ name: `Should Not Be Created ${randomUUID()}` })
      .expect(403);
  });

  it("rejects the Agent user (no role:update permission) from updating a role (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${agentRoleId}`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ name: "Should Not Apply" })
      .expect(403);
  });

  it("rejects the Agent user (no role:assign-permissions permission) from assigning permissions (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${agentRoleId}/permissions`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ permissionKeys: ["notification:read"] })
      .expect(403);
  });

  it("creates a custom role as the admin", async () => {
    customRoleName = `Custom Role ${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: customRoleName })
      .expect(201);

    customRoleId = response.body.id;
    expect(customRoleId).toBeTypeOf("string");

    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const created = roles.body.find((role: { id: string }) => role.id === customRoleId);
    expect(created).toMatchObject({ name: customRoleName, isActive: true, permissions: [] });
  });

  it("renames the custom role", async () => {
    customRoleName = `${customRoleName} Renamed`;
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${customRoleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: customRoleName })
      .expect(200);

    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const updated = roles.body.find((role: { id: string }) => role.id === customRoleId);
    expect(updated).toMatchObject({ name: customRoleName, isActive: true });
  });

  it("assigns a subset of permissions to the custom role", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${customRoleId}/permissions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ permissionKeys: ["ticket:read", "customer:read"] })
      .expect(200);

    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const updated = roles.body.find((role: { id: string }) => role.id === customRoleId);
    expect([...updated.permissions].sort()).toEqual(["customer:read", "ticket:read"]);
  });

  it("deactivates the custom role, hiding it from the default listing but not from includeInactive=true", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${customRoleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    const defaultListing = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(
      defaultListing.body.some((role: { id: string }) => role.id === customRoleId),
    ).toBe(false);

    const withInactive = await request(app.getHttpServer())
      .get("/api/v1/identity/roles?includeInactive=true")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const found = withInactive.body.find((role: { id: string }) => role.id === customRoleId);
    expect(found).toMatchObject({ isActive: false });
  });

  it("reactivates the custom role, restoring it to the default listing", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${customRoleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: true })
      .expect(200);

    const defaultListing = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const found = defaultListing.body.find((role: { id: string }) => role.id === customRoleId);
    expect(found).toMatchObject({ isActive: true });
  });

  it("rejects a duplicate role name with 409", async () => {
    const duplicateName = `Dup Role ${randomUUID()}`;
    await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: duplicateName })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: duplicateName })
      .expect(409);
  });

  it("rejects an unknown permission key in PATCH roles/:id/permissions with 400", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${customRoleId}/permissions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ permissionKeys: ["not-a-real-permission:whatever"] })
      .expect(400);
  });

  it("rejects renaming SuperAdmin with 400", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const superAdminRole = roles.body.find(
      (role: { name: string }) => role.name === "SuperAdmin",
    );
    expect(superAdminRole).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${superAdminRole.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Renamed Super Admin" })
      .expect(400);
  });

  it("rejects deactivating Agent with 400", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${agentRoleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(400);
  });

  it("proves permission grants on Agent are dynamic: the very next request with an already-issued token reflects the change, with no re-login in between", async () => {
    const dynamicAgentEmail = `agent-dynamic-${randomUUID()}@example.com`;
    const dynamicAgentPassword = "dynamic-agent-password-123";

    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: dynamicAgentEmail,
        password: dynamicAgentPassword,
        fullName: "Dynamic Agent",
        branchId: adminBranchId,
        departmentId: adminDepartmentId ?? undefined,
        roleId: agentRoleId,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: dynamicAgentEmail, password: dynamicAgentPassword })
      .expect(200);
    const dynamicAgentAccessToken = loginResponse.body.accessToken as string;

    // The Agent role does not (yet) grant notification:read.
    await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${dynamicAgentAccessToken}`)
      .expect(403);

    // As the admin, grant Agent the notification:read permission.
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${agentRoleId}/permissions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ permissionKeys: ["notification:read"] })
      .expect(200);

    // With NO token refresh/re-login step, the very next request using the
    // SAME already-issued access token now succeeds — proving permission
    // resolution is fully dynamic (re-checked fresh from the DB on every
    // guarded request), never cached and never dependent on token reissue.
    await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${dynamicAgentAccessToken}`)
      .expect(200);
  });

  // ---------------------------------------------------------------------
  // Story 47 — User Role/Department Reassignment
  //
  // Known scope limit: a true cross-branch reassignment attempt (moving a
  // user's UserBranchRole to a *different* Branch) cannot be exercised
  // end-to-end in this suite — `prisma/seed.ts` creates exactly one Branch
  // per organization and there is deliberately no branch-create endpoint
  // (see this file's own top-of-file doc comment, and Story 46's identical
  // disclosed limitation for duplicate BRANCH names), so there is no
  // second-branch fixture to reassign a user *into*. `UpdateUserAssignmentDto`
  // itself accepts no `branchId` field at all — Branch reassignment isn't
  // merely untested here, it isn't exposed as an option at all (Story 47
  // plan, Design item 2) — so this path is covered only at the unit level,
  // via `identity.service.spec.ts`'s mocked-Prisma `updateUserAssignment`
  // tests.
  // ---------------------------------------------------------------------

  it("rejects PATCH /identity/users/:id/assignment with no token", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/assignment`)
      .send({ departmentId: createdDepartmentId })
      .expect(401);
  });

  it("rejects the Agent user (no user:reassign permission) from reassigning a user (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/assignment`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ departmentId: createdDepartmentId })
      .expect(403);
  });

  it("reassigns the previously-created agent user's department, then role, as the admin", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ departmentId: createdDepartmentId })
      .expect(200);

    let users = await request(app.getHttpServer())
      .get("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    let updatedUser = users.body.find(
      (user: { id: string }) => user.id === createdAgentUserId,
    );
    expect(updatedUser).toMatchObject({ departmentId: createdDepartmentId });

    // Reassign to the custom role created/reactivated earlier in this suite
    // (Story 46 section) — it's guaranteed active at this point.
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ roleId: customRoleId })
      .expect(200);

    users = await request(app.getHttpServer())
      .get("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    updatedUser = users.body.find((user: { id: string }) => user.id === createdAgentUserId);
    expect(updatedUser).toMatchObject({
      roleId: customRoleId,
      departmentId: createdDepartmentId,
    });
  });

  it("clears the agent user's department via departmentId: null", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ departmentId: null })
      .expect(200);

    const users = await request(app.getHttpServer())
      .get("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const updatedUser = users.body.find(
      (user: { id: string }) => user.id === createdAgentUserId,
    );
    expect(updatedUser).toMatchObject({ departmentId: null });
  });

  it("rejects an unknown roleId with 404", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ roleId: randomUUID() })
      .expect(404);
  });

  it("rejects an unknown departmentId with 404", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ departmentId: randomUUID() })
      .expect(404);
  });

  it("rejects assigning an inactive role with 400", async () => {
    const inactiveRoleName = `Inactive Role ${randomUUID()}`;
    const createRoleResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: inactiveRoleName })
      .expect(201);
    const inactiveRoleId = createRoleResponse.body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${inactiveRoleId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ roleId: inactiveRoleId })
      .expect(400);
  });

  it("rejects assigning an inactive department with 400", async () => {
    const inactiveDeptName = `Inactive Dept ${randomUUID()}`;
    const createDeptResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: inactiveDeptName })
      .expect(201);
    const inactiveDepartmentId = createDeptResponse.body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/departments/${inactiveDepartmentId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ departmentId: inactiveDepartmentId })
      .expect(400);
  });

  it("rejects reassigning the sole SuperAdmin away from SuperAdmin with 400, then allows it once a second SuperAdmin exists", async () => {
    const usersBefore = await request(app.getHttpServer())
      .get("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const seededAdmin = usersBefore.body.find(
      (user: { email: string }) => user.email === process.env.SEED_ADMIN_EMAIL,
    );
    expect(seededAdmin).toBeTruthy();
    const seededAdminId = seededAdmin.id as string;

    // Exactly one SuperAdmin exists at this point in the suite (the seeded
    // bootstrap admin — `prisma/seed.ts` creates only one, and nothing
    // earlier in this file creates another) — reassigning them away from
    // SuperAdmin is rejected to prevent an unrecoverable lockout.
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${seededAdminId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ roleId: agentRoleId })
      .expect(400);

    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const superAdminRole = roles.body.find(
      (role: { name: string }) => role.name === "SuperAdmin",
    );
    expect(superAdminRole).toBeTruthy();

    const secondSuperAdminEmail = `super-admin-2-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: secondSuperAdminEmail,
        password: "second-super-admin-password-123",
        fullName: "Second Super Admin",
        branchId: adminBranchId,
        departmentId: adminDepartmentId ?? undefined,
        roleId: superAdminRole.id,
      })
      .expect(201);

    // Now that a second active SuperAdmin exists, reassigning the FIRST
    // admin away from SuperAdmin succeeds.
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${seededAdminId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ roleId: agentRoleId })
      .expect(200);

    // Restore the seeded bootstrap admin back to SuperAdmin — other e2e
    // spec files (and any later test run) log in as `SEED_ADMIN_EMAIL` and
    // expect it to remain SuperAdmin; this call's own JWT claims are
    // unaffected either way (Design item 7: a reassignment only takes
    // effect for a user's *next* token refresh/login, not their currently-
    // live token), so it still succeeds with the same already-issued
    // `adminAccessToken`.
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${seededAdminId}/assignment`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ roleId: superAdminRole.id })
      .expect(200);
  });

  // ---------------------------------------------------------------------
  // Story 48 — User Profile Correction: Email Change & Admin-Driven
  // Password Reset
  //
  // `secondAgentEmail`/`secondAgentPassword` (created in the Story 45
  // section, above) is reused for every 403 check below: the Story 46
  // section's "dynamic Agent" test replaced the Agent role's permission set
  // with exactly `["notification:read"]` (a full-replace, not additive —
  // see `setRolePermissions`), so by this point in the suite Agent holds
  // neither `user:update` nor `user:reset-password`, matching `ROLE_GRANTS`'s
  // `Agent: []` default with no manual edit needed for this story.
  // ---------------------------------------------------------------------

  it("rejects PATCH /identity/users/:id/password with no token", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/password`)
      .send({ newPassword: "should-not-apply-123" })
      .expect(401);
  });

  it("rejects the Agent user (no user:reset-password permission) from resetting another user's password (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}/password`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ newPassword: "should-not-apply-123" })
      .expect(403);
  });

  it("rejects the Agent user (no user:update permission) from changing another user's email (403)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: secondAgentEmail, password: secondAgentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ email: `should-not-apply-${randomUUID()}@example.com` })
      .expect(403);
  });

  it("changes an existing user's email as the admin, confirmed via GET /identity/users", async () => {
    const newEmail = `changed-${randomUUID()}@example.com`;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ email: newEmail })
      .expect(200);

    const users = await request(app.getHttpServer())
      .get("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const updatedUser = users.body.find((user: { id: string }) => user.id === createdAgentUserId);
    expect(updatedUser).toMatchObject({ email: newEmail });
  });

  it("rejects changing a user's email to one already in use by another user (409)", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${createdAgentUserId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ email: secondAgentEmail })
      .expect(409);
  });

  it("returns 404 when resetting the password of an unknown user id", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${randomUUID()}/password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: "whatever-password-123" })
      .expect(404);
  });

  it("resets a user's password as the admin: revokes their pre-reset refresh token, invalidates the old password, and allows login with the new one", async () => {
    // A dedicated, freshly created, still-ACTIVE user — `createdAgentUserId`
    // was deactivated earlier in this suite (Story 45 section) and can no
    // longer log in regardless of its password, which would make the
    // login-success/failure half of this proof meaningless.
    const resetAgentEmail = `agent-pwreset-${randomUUID()}@example.com`;
    const oldPassword = "old-password-123";
    const newPassword = "new-password-456";

    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: resetAgentEmail,
        password: oldPassword,
        fullName: "Password Reset Agent",
        branchId: adminBranchId,
        departmentId: adminDepartmentId ?? undefined,
        roleId: agentRoleId,
      })
      .expect(201);
    const resetAgentUserId = createResponse.body.id as string;

    // Log in with the OLD password to obtain a refresh token BEFORE the
    // reset — this is the token whose survival (or revocation) the rest of
    // this test proves.
    const preResetLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: resetAgentEmail, password: oldPassword })
      .expect(200);
    const setCookieHeader = preResetLogin.headers["set-cookie"] as unknown as string[];
    const rawRefreshCookie = setCookieHeader?.find((cookie) => cookie.startsWith("refreshToken="));
    expect(rawRefreshCookie).toBeTruthy();
    const preResetRefreshCookie = rawRefreshCookie!.split(";")[0]!;

    // As the admin, reset this user's password via the new dedicated route.
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${resetAgentUserId}/password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword })
      .expect(200);

    // Core proof of Design item 1: the refresh token obtained BEFORE the
    // reset is now rejected — `resetPassword`'s `revokeAllRefreshTokens`
    // revoked it, even though `refresh()` itself never reads `passwordHash`.
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", preResetRefreshCookie)
      .expect(401);

    // The OLD password no longer works...
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: resetAgentEmail, password: oldPassword })
      .expect(401);

    // ...and the NEW password does.
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: resetAgentEmail, password: newPassword })
      .expect(200);
  });
});
