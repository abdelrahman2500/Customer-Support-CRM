import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

/**
 * Story 147 — Self-Service Password Management.
 *
 * Covers both audiences' new routes (`PATCH /auth/me/password` and
 * `PATCH /portal/auth/me/password`) in one suite, because they are one
 * feature with one shared set of rules.
 *
 * Deliberately a NEW spec file rather than additions to
 * `identity.e2e-spec.ts`/`portal.e2e-spec.ts`: this suite creates and then
 * only ever mutates its OWN disposable user and its OWN disposable contact,
 * so it cannot contribute to the test-isolation pollution CLAUDE.md §5
 * documents for `identity.e2e-spec.ts`. It changes no shared role, no
 * shared permission, and never touches the seeded admin's password.
 */
function extractRefreshCookie(
  response: { headers: Record<string, unknown> },
  name: string,
): string {
  const setCookieHeader = response.headers["set-cookie"] as string[] | undefined;
  const rawCookie = setCookieHeader?.find((cookie) => cookie.startsWith(`${name}=`));
  if (!rawCookie) {
    throw new Error(`Expected a ${name} cookie in the response`);
  }
  return rawCookie.split(";")[0] ?? rawCookie;
}

describe("Self-service password management (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminAccessToken: string;

  // Agent-side fixture.
  const agentEmail = `self-service-pw-${randomUUID()}@example.com`;
  const agentOriginalPassword = "a-strong-agent-password-1";
  const agentNewPassword = "a-different-agent-password-2";

  // Portal-side fixture.
  const contactEmail = `self-service-pw-contact-${randomUUID()}@example.com`;
  const contactOriginalPassword = "a-strong-portal-password-1";
  const contactNewPassword = "a-different-portal-password-2";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    app.use(cookieParser());
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    prisma = new PrismaClient();

    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must be set for this suite to run");
    }
    const adminLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    adminAccessToken = adminLogin.body.accessToken;

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentRole = await prisma.role.findFirst({ where: { name: "Agent" } });
    if (!agentRole) {
      throw new Error("Expected the seeded Agent role to exist");
    }

    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentOriginalPassword,
        fullName: "Self-Service Password Test User",
        branchId: me.body.branchId,
        roleId: agentRole.id,
      })
      .expect(201);

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Self-Service Password Fixture ${randomUUID()}` })
      .expect(201);

    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customer.body.id}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Self-Service Password Test Contact", email: contactEmail })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customer.body.id}/contacts/${contact.body.id}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: contactOriginalPassword })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe("PATCH /auth/me/password (agent)", () => {
    async function loginAsAgent(password: string) {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: agentEmail, password })
        .expect(200);
      return {
        accessToken: response.body.accessToken as string,
        refreshCookie: extractRefreshCookie(response, "refreshToken"),
      };
    }

    it("requires authentication", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/auth/me/password")
        .send({ currentPassword: agentOriginalPassword, newPassword: agentNewPassword })
        .expect(401);
    });

    it("rejects a wrong current password with 400, not 401", async () => {
      // A 401 would make both web clients' apiFetch treat this as a dead
      // session and sign the user out over a typo — see
      // IdentityService.changeOwnPassword.
      const { accessToken } = await loginAsAgent(agentOriginalPassword);
      await request(app.getHttpServer())
        .patch("/api/v1/auth/me/password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: "not-the-current-password-1", newPassword: agentNewPassword })
        .expect(400);

      // The password is genuinely unchanged.
      await loginAsAgent(agentOriginalPassword);
    });

    it("rejects a new password that fails the shared complexity rules", async () => {
      const { accessToken } = await loginAsAgent(agentOriginalPassword);
      await request(app.getHttpServer())
        .patch("/api/v1/auth/me/password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: agentOriginalPassword, newPassword: "short" })
        .expect(400);
    });

    it("rejects an unknown field, so a caller cannot smuggle in another user id", async () => {
      const { accessToken } = await loginAsAgent(agentOriginalPassword);
      await request(app.getHttpServer())
        .patch("/api/v1/auth/me/password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: agentOriginalPassword,
          newPassword: agentNewPassword,
          userId: randomUUID(),
        })
        .expect(400);
    });

    it("changes the password, revokes every session, and writes an audit log", async () => {
      const { accessToken, refreshCookie } = await loginAsAgent(agentOriginalPassword);
      // A second, independent session for the same user — it must die too.
      const other = await loginAsAgent(agentOriginalPassword);

      await request(app.getHttpServer())
        .patch("/api/v1/auth/me/password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: agentOriginalPassword, newPassword: agentNewPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: agentEmail, password: agentOriginalPassword })
        .expect(401);

      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: agentEmail, password: agentNewPassword })
        .expect(200);

      for (const cookie of [refreshCookie, other.refreshCookie]) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/refresh")
          .set("Cookie", cookie)
          .expect(401);
      }

      const user = await prisma.user.findFirst({ where: { email: agentEmail } });
      const auditLog = await prisma.auditLog.findFirst({
        where: { action: "user.password_changed", entityId: user?.id },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actorId).toBe(user?.id);
    });
  });

  describe("PATCH /portal/auth/me/password (portal)", () => {
    async function loginAsContact(password: string) {
      const response = await request(app.getHttpServer())
        .post("/api/v1/portal/auth/login")
        .send({ email: contactEmail, password })
        .expect(200);
      return {
        accessToken: response.body.accessToken as string,
        refreshCookie: extractRefreshCookie(response, "crm_portal_refresh_token"),
      };
    }

    it("requires authentication", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/portal/auth/me/password")
        .send({ currentPassword: contactOriginalPassword, newPassword: contactNewPassword })
        .expect(401);
    });

    it("rejects an agent-audience token", async () => {
      // 401, matching how AudienceGuard already rejects an agent token on
      // every other portal route (see portal.e2e-spec.ts) — this route is
      // not a special case and must not become one.
      await request(app.getHttpServer())
        .patch("/api/v1/portal/auth/me/password")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ currentPassword: contactOriginalPassword, newPassword: contactNewPassword })
        .expect(401);
    });

    it("rejects a wrong current password with 400, not 401", async () => {
      const { accessToken } = await loginAsContact(contactOriginalPassword);
      await request(app.getHttpServer())
        .patch("/api/v1/portal/auth/me/password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: "not-the-current-password-1", newPassword: contactNewPassword })
        .expect(400);

      await loginAsContact(contactOriginalPassword);
    });

    it("rejects a new password that fails the shared complexity rules", async () => {
      const { accessToken } = await loginAsContact(contactOriginalPassword);
      await request(app.getHttpServer())
        .patch("/api/v1/portal/auth/me/password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: contactOriginalPassword, newPassword: "short" })
        .expect(400);
    });

    it("changes the password and revokes every portal session", async () => {
      const { accessToken, refreshCookie } = await loginAsContact(contactOriginalPassword);

      await request(app.getHttpServer())
        .patch("/api/v1/portal/auth/me/password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: contactOriginalPassword, newPassword: contactNewPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post("/api/v1/portal/auth/login")
        .send({ email: contactEmail, password: contactOriginalPassword })
        .expect(401);

      await request(app.getHttpServer())
        .post("/api/v1/portal/auth/login")
        .send({ email: contactEmail, password: contactNewPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post("/api/v1/portal/auth/refresh")
        .set("Cookie", refreshCookie)
        .expect(401);
    });
  });
});
