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
 * Story 107 added `POST /identity/branches` (`branch:create`,
 * SuperAdmin-only), so this suite now exercises a real, end-to-end
 * duplicate BRANCH name 409 (previously only unit-testable against a
 * mocked Prisma client — see `identity.service.spec.ts`'s own
 * `updateBranch`/`createBranch` P2002 tests). `listBranches` itself stays
 * scoped to the caller's own branch only (Story 35's design, unchanged by
 * Story 107), so a created branch is verified via a direct Prisma read,
 * not via that endpoint.
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
  let createdBranchId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();

    const prisma = app.get(PrismaService);
    const superAdminRole = await prisma.role.findUnique({ where: { name: "SuperAdmin" } });
    if (superAdminRole) {
      await prisma.user.updateMany({
        where: {
          email: { not: process.env.SEED_ADMIN_EMAIL },
          branchRoles: { some: { roleId: superAdminRole.id } },
        },
        data: { isActive: false },
      });
      const seedAdmin = await prisma.user.findUnique({
        where: { email: process.env.SEED_ADMIN_EMAIL },
      });
      if (seedAdmin) {
        const seedAdminBranchRole = await prisma.userBranchRole.findFirst({
          where: { userId: seedAdmin.id },
          orderBy: { createdAt: "asc" },
        });
        if (seedAdminBranchRole && seedAdminBranchRole.roleId !== superAdminRole.id) {
          await prisma.userBranchRole.update({
            where: { id: seedAdminBranchRole.id },
            data: { roleId: superAdminRole.id },
          });
        }
      }
    }
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    const agentRole = await prisma.role.findUnique({ where: { name: "Agent" } });
    if (agentRole) {
      // Story 100 — restore the seed's own default Agent grant, not an
      // empty set: this suite's own "dynamic Agent" test above
      // deliberately full-replaces the shared Agent role's permissions
      // mid-run (see that test's doc comment); previously restoring to
      // `[]` matched the pre-Story-100 seed default, but now silently
      // wiping Agent back to zero permissions here would incorrectly
      // starve every OTHER e2e spec file that runs after this one in the
      // same `--no-file-parallelism` sweep and expects Agent's real,
      // seeded permission set (`apps/api/prisma/seed.ts`'s `ROLE_GRANTS.Agent`,
      // duplicated here as literal keys — the same "spell out the exact
      // permission keys inline" convention every other test in this file
      // already uses for `setRolePermissions` calls).
      const restoredKeys = [
        "ticket:create",
        "ticket:read",
        "ticket:update",
        "customer:create",
        "customer:read",
        "customer:update",
        "branch:read",
        "user:read",
        "kb:read",
        "quick-reply:read",
        "ticket-category:read",
        "notification:read",
        "sla:read",
      ];
      const restoredPermissions = await prisma.permission.findMany({
        where: { key: { in: restoredKeys } },
      });
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: agentRole.id } }),
        prisma.rolePermission.createMany({
          data: restoredPermissions.map((permission) => ({
            roleId: agentRole.id,
            permissionId: permission.id,
          })),
        }),
      ]);
    }
    const superAdminRole = await prisma.role.findUnique({ where: { name: "SuperAdmin" } });
    if (superAdminRole) {
      await prisma.user.updateMany({
        where: {
          email: { not: process.env.SEED_ADMIN_EMAIL },
          branchRoles: { some: { roleId: superAdminRole.id } },
        },
        data: { isActive: false },
      });
      const seedAdmin = await prisma.user.findUnique({
        where: { email: process.env.SEED_ADMIN_EMAIL },
      });
      if (seedAdmin) {
        const seedAdminBranchRole = await prisma.userBranchRole.findFirst({
          where: { userId: seedAdmin.id },
          orderBy: { createdAt: "asc" },
        });
        if (seedAdminBranchRole && seedAdminBranchRole.roleId !== superAdminRole.id) {
          await prisma.userBranchRole.update({
            where: { id: seedAdminBranchRole.id },
            data: { roleId: superAdminRole.id },
          });
        }
      }
    }
    if (adminBranchId) {
      const existingMainBranch = await prisma.branch.findFirst({
        where: { name: "Main Branch" },
      });
      if (!existingMainBranch || existingMainBranch.id === adminBranchId) {
        await prisma.branch.update({
          where: { id: adminBranchId },
          data: { name: "Main Branch", isActive: true },
        });
      }
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

  // Story 119 — locale preference. Uses a dedicated, freshly created user
  // (not the shared seeded admin) so this never persistently mutates a
  // row every other e2e spec file also logs in as.
  describe("locale preference (Story 119)", () => {
    it("PATCH auth/locale persists a valid locale, reflected by a subsequent GET auth/me", async () => {
      const roles = await request(app.getHttpServer())
        .get("/api/v1/identity/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
      const email = `locale-pref-${randomUUID()}@example.com`;
      const password = "locale-pref-test-password-123";
      await request(app.getHttpServer())
        .post("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          email,
          password,
          fullName: "Locale Preference Test User",
          branchId: adminBranchId,
          roleId: agentRole.id,
        })
        .expect(201);
      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password })
        .expect(200);
      const accessToken = login.body.accessToken as string;

      const before = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(before.body.preferredLocale).toBeNull();

      await request(app.getHttpServer())
        .patch("/api/v1/auth/locale")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ locale: "ar" })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(after.body.preferredLocale).toBe("ar");
    });

    it("rejects a locale outside en/ar with 400", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/auth/locale")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ locale: "fr" })
        .expect(400);
    });

    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/auth/locale")
        .send({ locale: "ar" })
        .expect(401);
    });
  });

  // Story 122 — Account Lockout. Uses a dedicated, freshly created user
  // (never the shared seeded admin) so driving 5 consecutive failures here
  // can never accumulate into a persistent lock on a row every other e2e
  // spec file also logs in as — mirrors "locale preference (Story 119)"'s
  // own precedent immediately above.
  describe("account lockout (Story 122)", () => {
    async function createDisposableUser(): Promise<{ email: string; password: string }> {
      const roles = await request(app.getHttpServer())
        .get("/api/v1/identity/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
      const email = `lockout-${randomUUID()}@example.com`;
      const password = "lockout-test-password-123";
      await request(app.getHttpServer())
        .post("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          email,
          password,
          fullName: "Account Lockout Test User",
          branchId: adminBranchId,
          roleId: agentRole.id,
        })
        .expect(201);
      return { email, password };
    }

    // Consolidated into one test (rather than one test each for
    // "below threshold" / "resets on success" / "locks at threshold" /
    // "identical message while locked") to keep this suite's total
    // `/auth/login` call count comfortably within `AUTH_THROTTLE`'s
    // per-IP budget (`identity.controller.ts`) — see that constant's own
    // doc comment, updated by this story to account for the extra volume
    // a real, end-to-end lockout test necessarily adds.
    it("does not lock below the threshold, resets the counter on a successful login, then genuinely locks at the threshold with an identical generic message while locked", async () => {
      const { email, password } = await createDisposableUser();

      // 4 wrong attempts — below the 5-attempt threshold.
      for (let attempt = 0; attempt < 4; attempt++) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({ email, password: "definitely-the-wrong-password" })
          .expect(401);
      }
      // A 5th, correct-password login succeeds (not locked) and resets
      // the counter to 0.
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password })
        .expect(200);

      // 4 more wrong attempts — if the counter had NOT actually reset,
      // this branch alone (4 + 4 = 8 total) would already be locked.
      for (let attempt = 0; attempt < 4; attempt++) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({ email, password: "definitely-the-wrong-password" })
          .expect(401);
      }
      // Still unlocked — proves the reset above was real, not merely delayed.
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password })
        .expect(200);

      // One 5th-in-a-row wrong attempt now genuinely locks the account.
      for (let attempt = 0; attempt < 5; attempt++) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({ email, password: "definitely-the-wrong-password" })
          .expect(401);
      }
      // Even the CORRECT password is now rejected, with the exact same
      // generic message as a plain wrong password — a locked account
      // must never be distinguishable from any other login failure.
      const lockedResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password })
        .expect(401);
      expect(lockedResponse.body.message).toBe("Invalid email or password");
    });

    it("an admin can manually unlock a locked account immediately via POST identity/users/:id/unlock", async () => {
      const { email, password } = await createDisposableUser();
      const usersBefore = await request(app.getHttpServer())
        .get("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const userId = usersBefore.body.find((user: { email: string }) => user.email === email).id;

      for (let attempt = 0; attempt < 5; attempt++) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({ email, password: "definitely-the-wrong-password" })
          .expect(401);
      }

      const usersLocked = await request(app.getHttpServer())
        .get("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const lockedUser = usersLocked.body.find((user: { email: string }) => user.email === email);
      expect(lockedUser.isLocked).toBe(true);
      expect(lockedUser.lockedUntil).toBeTypeOf("string");

      await request(app.getHttpServer())
        .post(`/api/v1/identity/users/${userId}/unlock`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);

      const usersAfterUnlock = await request(app.getHttpServer())
        .get("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const unlockedUser = usersAfterUnlock.body.find((user: { email: string }) => user.email === email);
      expect(unlockedUser.isLocked).toBe(false);
      expect(unlockedUser.lockedUntil).toBeNull();

      // Immediately usable again — no need to wait for the 15-minute auto-expiry.
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password })
        .expect(200);
    });

    it("rejects an Agent-role user (lacking user:update) from unlocking another user (403)", async () => {
      const { email } = await createDisposableUser();
      const usersBefore = await request(app.getHttpServer())
        .get("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const targetUserId = usersBefore.body.find((user: { email: string }) => user.email === email).id;

      // A second, freshly created disposable Agent — NOT the suite's
      // `secondAgentEmail`/`secondAgentPassword` outer-scope user, which
      // this describe block runs before it exists (that user is created
      // later in the file, in the Story 45 section below).
      const { email: agentEmail, password: agentPassword } = await createDisposableUser();
      const agentLogin = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: agentEmail, password: agentPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/identity/users/${targetUserId}/unlock`)
        .set("Authorization", `Bearer ${agentLogin.body.accessToken}`)
        .expect(403);
    });

    it("returns 404 for an unknown user id on unlock", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/identity/users/${randomUUID()}/unlock`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("rejects an unauthenticated unlock request", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/identity/users/${randomUUID()}/unlock`)
        .expect(401);
    });
  });

  // Story 124 — Session/Device Management. Uses a dedicated, freshly
  // created user (never the shared seeded admin) for the same reason as
  // "account lockout (Story 122)" above: exercising session revoke here
  // must never touch a row every other e2e spec file also logs in as.
  describe("session/device management (Story 124)", () => {
    let foreignSessionId: string;

    async function createDisposableAgentUser(): Promise<{ email: string; password: string }> {
      const roles = await request(app.getHttpServer())
        .get("/api/v1/identity/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
      const email = `session-mgmt-${randomUUID()}@example.com`;
      const password = "session-mgmt-test-password-123";
      await request(app.getHttpServer())
        .post("/api/v1/identity/users")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          email,
          password,
          fullName: "Session Management Test User",
          branchId: adminBranchId,
          roleId: agentRole.id,
        })
        .expect(201);
      return { email, password };
    }

    it("captures a distinct session per login (device A vs. device B), lists both with the presented device flagged current, then revoking device B's session blocks only its own refresh — device A's session survives untouched", async () => {
      const { email, password } = await createDisposableAgentUser();

      const loginA = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("User-Agent", "Mozilla/5.0 (Device A)")
        .send({ email, password })
        .expect(200);
      const accessTokenA = loginA.body.accessToken as string;
      const cookieHeaderA = loginA.headers["set-cookie"] as unknown as string[];
      const refreshCookieA = cookieHeaderA.find((cookie) => cookie.startsWith("refreshToken="))!;

      const loginB = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("User-Agent", "Mozilla/5.0 (Device B)")
        .send({ email, password })
        .expect(200);
      const cookieHeaderB = loginB.headers["set-cookie"] as unknown as string[];
      const refreshCookieB = cookieHeaderB.find((cookie) => cookie.startsWith("refreshToken="))!;

      // GET auth/sessions, presenting device A's own refresh cookie —
      // ordinary AuthGuard only, no permission grant needed (Agent role,
      // zero permissions by default).
      const sessionsResponse = await request(app.getHttpServer())
        .get("/api/v1/auth/sessions")
        .set("Authorization", `Bearer ${accessTokenA}`)
        .set("Cookie", refreshCookieA)
        .expect(200);
      expect(sessionsResponse.body).toHaveLength(2);
      const sessionA = sessionsResponse.body.find(
        (session: { userAgent: string }) => session.userAgent === "Mozilla/5.0 (Device A)",
      );
      const sessionB = sessionsResponse.body.find(
        (session: { userAgent: string }) => session.userAgent === "Mozilla/5.0 (Device B)",
      );
      expect(sessionA.isCurrent).toBe(true);
      expect(sessionB.isCurrent).toBe(false);
      foreignSessionId = sessionA.sessionId; // reused by the 404 test below

      // Revoking device B's session, authenticated as device A.
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/sessions/${sessionB.sessionId}`)
        .set("Authorization", `Bearer ${accessTokenA}`)
        .expect(204);

      // Device B's refresh cookie is now dead...
      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", refreshCookieB)
        .expect(401);

      // ...while device A's own session is completely unaffected.
      await request(app.getHttpServer())
        .post("/api/v1/auth/refresh")
        .set("Cookie", refreshCookieA)
        .expect(200);
    });

    it("returns 404 revoking a sessionId that exists but never belonged to the caller (never operates on another user's session)", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/sessions/${foreignSessionId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("rejects unauthenticated requests to both session endpoints (401)", async () => {
      await request(app.getHttpServer()).get("/api/v1/auth/sessions").expect(401);
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/sessions/${randomUUID()}`)
        .expect(401);
    });
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

  // Story 100 — Agent's default seed grant now includes `branch:read`
  // (previously `[]`), so both routes below are now reachable by a
  // freshly seeded Agent-role user; this proves that, rather than a 403.
  it("allows an Agent-role user with the default branch:read grant to list branches/departments (Story 100)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);
    const agentAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .get("/api/v1/identity/branches")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/v1/identity/departments")
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .expect(200);
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

  // Story 107 — Branch creation.
  describe("createBranch", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/identity/branches")
        .send({ name: "Should Not Be Created", timezone: "UTC" })
        .expect(401);
    });

    it("rejects the Agent user (no branch:create permission) with 403", async () => {
      const loginResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: secondAgentEmail, password: secondAgentPassword })
        .expect(200);
      const agentAccessToken = loginResponse.body.accessToken as string;

      await request(app.getHttpServer())
        .post("/api/v1/identity/branches")
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .send({ name: "Should Not Be Created", timezone: "UTC" })
        .expect(403);
    });

    it("creates a branch as the admin under the caller's own organization", async () => {
      const branchName = `Second Branch ${randomUUID()}`;
      const response = await request(app.getHttpServer())
        .post("/api/v1/identity/branches")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ name: branchName, timezone: "Africa/Cairo" })
        .expect(201);

      createdBranchId = response.body.id;
      expect(createdBranchId).toBeTypeOf("string");

      // `listBranches` intentionally stays scoped to the caller's own
      // branch only (Story 35's design, unchanged here), so the created
      // row is verified via a direct Prisma read instead.
      const prisma = app.get(PrismaService);
      const adminOwnBranch = await prisma.branch.findUniqueOrThrow({
        where: { id: adminBranchId },
        select: { organizationId: true },
      });
      const createdBranch = await prisma.branch.findUniqueOrThrow({
        where: { id: createdBranchId },
      });
      expect(createdBranch).toMatchObject({
        name: branchName,
        timezone: "Africa/Cairo",
        isActive: true,
        organizationId: adminOwnBranch.organizationId,
      });
    });

    it("rejects a duplicate branch name within the same organization with 409", async () => {
      const prisma = app.get(PrismaService);
      const created = await prisma.branch.findUniqueOrThrow({ where: { id: createdBranchId } });

      await request(app.getHttpServer())
        .post("/api/v1/identity/branches")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ name: created.name, timezone: "UTC" })
        .expect(409);
    });
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

    // Story 100 — the Agent role's default seed grant no longer excludes
    // `notification:read` (it now includes it, among others), so this
    // proof is rebuilt on `role:read` (`GET /identity/roles`) instead — a
    // permission Agent still does not hold by default. The permission
    // chosen here is otherwise incidental to what this test actually
    // proves (dynamic, uncached permission resolution).
    // The Agent role does not (yet) grant role:read.
    await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${dynamicAgentAccessToken}`)
      .expect(403);

    // As the admin, grant Agent the role:read permission.
    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${agentRoleId}/permissions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ permissionKeys: ["role:read"] })
      .expect(200);

    // With NO token refresh/re-login step, the very next request using the
    // SAME already-issued access token now succeeds — proving permission
    // resolution is fully dynamic (re-checked fresh from the DB on every
    // guarded request), never cached and never dependent on token reissue.
    await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
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

    let secondSuperAdminUserId: string | null = null;
    try {
      const secondSuperAdminEmail = `super-admin-2-${randomUUID()}@example.com`;
      const createResponse = await request(app.getHttpServer())
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
      secondSuperAdminUserId = createResponse.body.id as string;

      // Now that a second active SuperAdmin exists, reassigning the FIRST
      // admin away from SuperAdmin succeeds.
      await request(app.getHttpServer())
        .patch(`/api/v1/identity/users/${seededAdminId}/assignment`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ roleId: agentRoleId })
        .expect(200);
    } finally {
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
        .send({ roleId: superAdminRole.id });

      // Deactivate the second SuperAdmin so subsequent tests/runs aren't affected.
      if (secondSuperAdminUserId) {
        await request(app.getHttpServer())
          .patch(`/api/v1/identity/users/${secondSuperAdminUserId}`)
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .send({ isActive: false });
      }
    }
  });

  // ---------------------------------------------------------------------
  // Story 48 — User Profile Correction: Email Change & Admin-Driven
  // Password Reset
  //
  // `secondAgentEmail`/`secondAgentPassword` (created in the Story 45
  // section, above) is reused for every 403 check below: the Story 46
  // section's "dynamic Agent" test replaced the Agent role's permission set
  // with exactly `["role:read"]` (a full-replace, not additive — see
  // `setRolePermissions`), so by this point in the suite Agent holds
  // neither `user:update` nor `user:reset-password` — true regardless of
  // whether `ROLE_GRANTS`'s own default (Story 100: a real permission set,
  // not `[]`) ever included either of those two, since the full-replace
  // above already discarded it.
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

  // Story 123 — Password Complexity.
  it("rejects creating a user with a password that is long enough but not complex enough (400)", async () => {
    // 8+ characters, but only 1 character class (all lowercase) — fails the
    // "at least 3 of: lowercase, uppercase, digit, symbol" rule.
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: `not-complex-enough-${randomUUID()}@example.com`,
        password: "onlylowercaseletters",
        fullName: "Not Complex Enough",
        branchId: adminBranchId,
        roleId: agentRoleId,
      })
      .expect(400);
  });

  it("rejects an admin password reset with a password that is long enough but not complex enough (400)", async () => {
    const complexityAgentEmail = `agent-complexity-${randomUUID()}@example.com`;
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: complexityAgentEmail,
        password: "initial-password-123",
        fullName: "Password Complexity Agent",
        branchId: adminBranchId,
        roleId: agentRoleId,
      })
      .expect(201);
    const complexityAgentUserId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/users/${complexityAgentUserId}/password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: "onlylowercaseletters" })
      .expect(400);
  });
});

/**
 * Story 84 — Explicit Audit Logging: Auth Events & Permission Diffs.
 *
 * Bootstraps its own `AppModule` instance (mirrors
 * `audit-logs-read.e2e-spec.ts`) so these assertions don't depend on the
 * ordering/state of the large describe block above. Requires the same
 * seeded `DATABASE_URL`/`REDIS_URL` as the rest of this file.
 */
describe("Identity & Access — explicit audit logging (e2e)", () => {
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

  async function waitForAuditLogRow(
    predicate: (log: { action: string; actorId: string | null; entityId: string | null; diff: unknown }) => boolean,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<{ action: string; actorId: string | null; entityId: string | null; diff: unknown }> {
    const deadline = Date.now() + timeoutMs;
    do {
      const response = await request(app.getHttpServer())
        .get("/api/v1/audit-logs")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const match = response.body.find(predicate);
      if (match) {
        return match;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    throw new Error("Timed out waiting for a matching audit log row");
  }

  it("records auth.login_failed with actorId null for an unknown email", async () => {
    const unknownEmail = `no-such-user-${randomUUID()}@example.com`;

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: unknownEmail, password: "whatever-password" })
      .expect(401);

    const failedLoginRow = await waitForAuditLogRow(
      (log) => log.action === "auth.login_failed" && log.entityId === unknownEmail,
    );
    expect(failedLoginRow.actorId).toBeNull();
  });

  it("records auth.login_failed with actorId null (and the real user id as entityId) for a wrong password, then auth.login/auth.logout with the real actorId for a real login/logout pair", async () => {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;

    const preLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    const preMe = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${preLogin.body.accessToken}`)
      .expect(200);
    const adminUserId = preMe.body.id as string;

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "definitely-the-wrong-password" })
      .expect(401);

    const failedLoginRow = await waitForAuditLogRow(
      (log) => log.action === "auth.login_failed" && log.entityId === adminUserId,
    );
    expect(failedLoginRow.actorId).toBeNull();

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    const setCookieHeader = loginResponse.headers["set-cookie"] as unknown as string[];
    const rawRefreshCookie = setCookieHeader?.find((cookie) => cookie.startsWith("refreshToken="));
    const refreshCookie = rawRefreshCookie!.split(";")[0]!;

    const loginRow = await waitForAuditLogRow(
      (log) => log.action === "auth.login" && log.entityId === adminUserId,
    );
    expect(loginRow.actorId).toBe(adminUserId);

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Cookie", refreshCookie)
      .expect(204);

    const logoutRow = await waitForAuditLogRow(
      (log) => log.action === "auth.logout" && log.entityId === adminUserId,
    );
    expect(logoutRow.actorId).toBe(adminUserId);
  });

  it("records role.permissions_updated with a diff.after matching the submitted permission keys", async () => {
    const roleName = `Audit Diff Role ${randomUUID()}`;
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: roleName })
      .expect(201);
    const roleId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/identity/roles/${roleId}/permissions`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ permissionKeys: ["ticket:read", "customer:read"] })
      .expect(200);

    const row = await waitForAuditLogRow(
      (log) => log.action === "role.permissions_updated" && log.entityId === roleId,
    );
    expect(row.diff).toMatchObject({
      before: [],
      after: ["customer:read", "ticket:read"],
    });
  });
});
