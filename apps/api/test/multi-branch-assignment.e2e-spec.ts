import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Integration suite for Story 118 — Identity & Access: multi-branch user
 * assignment + branch switching. Bootstraps the REAL `AppModule` against a
 * REAL Postgres, exactly like `identity.e2e-spec.ts`.
 *
 * Covers the actual correctness bar this story exists to clear: a switched
 * branch must survive a SUBSEQUENT silent `/auth/refresh` call (Story 41),
 * not just the immediate access token `POST auth/switch-branch` returns.
 */
describe("Identity & Access — Multi-branch assignment + branch switching (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAccessToken: string;
  let adminBranchId: string;
  let secondBranchId: string;
  let agentRoleId: string;

  function extractRefreshCookie(response: request.Response): string {
    const setCookieHeader = response.headers["set-cookie"] as unknown as string[];
    const rawCookie = setCookieHeader?.find((cookie) => cookie.startsWith("refreshToken="));
    if (!rawCookie) {
      throw new Error("Response did not set a refreshToken cookie");
    }
    return rawCookie.split(";")[0]!;
  }

  async function waitForAuditLogRow(
    predicate: (log: { action: string; entityId: string | null; branchId: string | null }) => boolean,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<{ action: string; entityId: string | null; branchId: string | null }> {
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);

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

    const branchResponse = await request(app.getHttpServer())
      .post("/api/v1/identity/branches")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `Second Branch ${randomUUID()}`, timezone: "Africa/Cairo" })
      .expect(201);
    secondBranchId = branchResponse.body.id;

    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    agentRoleId = roles.body.find((role: { name: string }) => role.name === "Agent").id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects a non-SuperAdmin's attempt to grant a branch assignment", async () => {
    const plainAgentEmail = `plain-agent-${randomUUID()}@example.com`;
    const plainAgentPassword = "plain-agent-test-password-123";
    const plainAgent = await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: plainAgentEmail,
        password: plainAgentPassword,
        fullName: "Plain Agent",
        branchId: adminBranchId,
        roleId: agentRoleId,
      })
      .expect(201);
    const plainAgentLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: plainAgentEmail, password: plainAgentPassword })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/identity/users/${plainAgent.body.id}/branch-assignments`)
      .set("Authorization", `Bearer ${plainAgentLogin.body.accessToken}`)
      .send({ branchId: secondBranchId, roleId: agentRoleId })
      .expect(403);
  });

  it("grants a second branch membership, then switches to it — surviving a subsequent silent refresh", async () => {
    const email = `multi-branch-agent-${randomUUID()}@example.com`;
    const password = "multi-branch-test-password-123";
    const createdUser = await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email,
        password,
        fullName: "Multi Branch Agent",
        branchId: adminBranchId,
        roleId: agentRoleId,
      })
      .expect(201);
    const userId = createdUser.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/identity/users/${userId}/branch-assignments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ branchId: secondBranchId, roleId: agentRoleId })
      .expect(201);

    await waitForAuditLogRow(
      (log) => log.action === "user.branch_assignment_granted" && log.entityId === userId,
    );

    // A duplicate grant of the exact same tuple 409s.
    await request(app.getHttpServer())
      .post(`/api/v1/identity/users/${userId}/branch-assignments`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ branchId: secondBranchId, roleId: agentRoleId })
      .expect(409);

    const login1 = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    const refreshCookie1 = extractRefreshCookie(login1);

    // Default active context is still the FIRST membership (the branch
    // the user was originally created in) — the new grant alone doesn't
    // change what's active.
    const meBeforeSwitch = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login1.body.accessToken}`)
      .expect(200);
    expect(meBeforeSwitch.body.branchId).toBe(adminBranchId);

    const membershipsResponse = await request(app.getHttpServer())
      .get("/api/v1/auth/me/branches")
      .set("Authorization", `Bearer ${login1.body.accessToken}`)
      .expect(200);
    expect(membershipsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ branchId: adminBranchId, isActive: true }),
        expect.objectContaining({ branchId: secondBranchId, isActive: false }),
      ]),
    );

    // Switching to a membership never granted 404s.
    await request(app.getHttpServer())
      .post("/api/v1/auth/switch-branch")
      .set("Cookie", refreshCookie1)
      .send({ branchId: randomUUID() })
      .expect(404);

    const switchResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/switch-branch")
      .set("Cookie", refreshCookie1)
      .send({ branchId: secondBranchId })
      .expect(200);
    const refreshCookie2 = extractRefreshCookie(switchResponse);

    // `GET /audit-logs` can't verify this one: `auth.branch_switched` is
    // tagged with the SWITCHED-TO branch (secondBranchId), which the
    // admin — active in adminBranchId — cannot see through their own
    // branch-scoped audit view (by design; the same "cross-branch access
    // is explicit, audited, never a default" rule applies to reading
    // another branch's own audit trail). Verified directly instead.
    const branchSwitchedRow = await prisma.auditLog.findFirst({
      where: { action: "auth.branch_switched", entityId: userId },
      orderBy: { createdAt: "desc" },
    });
    expect(branchSwitchedRow?.branchId).toBe(secondBranchId);

    const meAfterSwitch = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${switchResponse.body.accessToken}`)
      .expect(200);
    expect(meAfterSwitch.body.branchId).toBe(secondBranchId);

    // The switch persisted (User.activeBranchId) survives a SUBSEQUENT,
    // ordinary silent refresh — not just the immediate access token
    // switch-branch itself returned. This is the actual correctness bar
    // this story exists to clear.
    const refreshResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie2)
      .expect(200);
    const meAfterRefresh = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${refreshResponse.body.accessToken}`)
      .expect(200);
    expect(meAfterRefresh.body.branchId).toBe(secondBranchId);

    // The original (pre-switch) refresh token was rotated/revoked by the
    // switch itself — reusing it now fails.
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie1)
      .expect(401);
  });
});
