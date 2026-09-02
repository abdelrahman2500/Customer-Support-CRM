import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for the `portal/*` HTTP surface — Story 52 (Customer
 * Portal — Contact Authentication Foundation).
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `identity.e2e-spec.ts`/`customers.e2e-spec.ts`. Logs in as the seed's
 * bootstrap admin, creates its own Customer/Contact fixture through the real
 * API, and sets that Contact's portal password through the real, new
 * `PATCH .../portal-password` route — never a direct DB write.
 *
 * The key regression proof this suite exists for: an `agent`-audience token
 * is rejected on the new `customer`-only portal routes, and a
 * `customer`-audience token is rejected on the pre-existing agent-only
 * surface — proving `AudienceGuard` actually separates the two, not just in
 * isolated unit tests.
 */
/** Extracts the `crm_portal_refresh_token=...` cookie (name+value only, no
 * attributes) from a login/refresh response's `Set-Cookie` header. */
function extractPortalRefreshCookie(response: { headers: Record<string, unknown> }): string {
  const setCookieHeader = response.headers["set-cookie"] as string[] | undefined;
  const rawCookie = setCookieHeader?.find((cookie) =>
    cookie.startsWith("crm_portal_refresh_token="),
  );
  if (!rawCookie) {
    throw new Error("Expected a crm_portal_refresh_token cookie in the response");
  }
  return rawCookie.split(";")[0] ?? rawCookie;
}

describe("Customer Portal (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let customerId: string;
  let contactId: string;
  const contactEmail = `portal-contact-${randomUUID()}@example.com`;
  const portalPassword = "a-strong-portal-password";

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

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Portal Fixture Customer ${randomUUID()}` })
      .expect(201);
    customerId = customer.body.id;

    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Test Contact", email: contactEmail })
      .expect(201);
    contactId = contact.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects a login attempt before any portal password has been set", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(401);
  });

  it("sets the contact's portal password via the real agent-facing route", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: portalPassword })
      .expect(200);
  });

  it("rejects a login with the wrong password", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: "totally-wrong-password" })
      .expect(401);
  });

  it("rejects a portal-password update with fewer than 8 characters", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: "short" })
      .expect(400);
  });

  it("logs in with the correct credentials and reflects the contact via /portal/auth/me", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(200);
    const portalAccessToken = loginResponse.body.accessToken as string;
    expect(portalAccessToken).toBeTruthy();

    expect(extractPortalRefreshCookie(loginResponse)).toBeTruthy();

    const me = await request(app.getHttpServer())
      .get("/api/v1/portal/auth/me")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({
      id: contactId,
      email: contactEmail,
      fullName: "Portal Test Contact",
      customerId,
    });
  });

  // Story 119 — locale preference.
  it("persists a locale preference and reflects it on a subsequent /portal/auth/me", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(200);
    const portalAccessToken = loginResponse.body.accessToken as string;

    const before = await request(app.getHttpServer())
      .get("/api/v1/portal/auth/me")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);
    expect(before.body.preferredLocale).toBeNull();

    await request(app.getHttpServer())
      .patch("/api/v1/portal/auth/locale")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .send({ locale: "ar" })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get("/api/v1/portal/auth/me")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(200);
    expect(after.body.preferredLocale).toBe("ar");
  });

  it("rejects a locale outside en/ar with 400", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(200);
    const portalAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .patch("/api/v1/portal/auth/locale")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .send({ locale: "fr" })
      .expect(400);
  });

  it("rejects an agent-audience token on the portal-only /portal/auth/locale route", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/portal/auth/locale")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ locale: "ar" })
      .expect(401);
  });

  it("rotates the refresh token and revokes the old one", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(200);
    const rawRefreshCookie = extractPortalRefreshCookie(loginResponse);

    const refreshResponse = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/refresh")
      .set("Cookie", rawRefreshCookie)
      .expect(200);
    expect(refreshResponse.body.accessToken).toBeTruthy();

    // The rotated-away token is now rejected.
    await request(app.getHttpServer())
      .post("/api/v1/portal/auth/refresh")
      .set("Cookie", rawRefreshCookie)
      .expect(401);
  });

  it("logs out, revoking the refresh token", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(200);
    const rawRefreshCookie = extractPortalRefreshCookie(loginResponse);

    await request(app.getHttpServer())
      .post("/api/v1/portal/auth/logout")
      .set("Cookie", rawRefreshCookie)
      .expect(204);

    await request(app.getHttpServer())
      .post("/api/v1/portal/auth/refresh")
      .set("Cookie", rawRefreshCookie)
      .expect(401);
  });

  it("resetting the portal password revokes every existing refresh token", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: portalPassword })
      .expect(200);
    const rawRefreshCookie = extractPortalRefreshCookie(loginResponse);

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: "yet-another-strong-password" })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/portal/auth/refresh")
      .set("Cookie", rawRefreshCookie)
      .expect(401);
  });

  it("rejects an agent-audience token on the portal-only /portal/auth/me route (401)", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/portal/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(401);
  });

  it("rejects a customer-audience token on the pre-existing, agent-only surface (401)", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: "yet-another-strong-password" })
      .expect(200);
    const portalAccessToken = loginResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${portalAccessToken}`)
      .expect(401);
  });

  // Story 100 — Agent's default seed grant now includes `customer:update`
  // (previously `[]`), so this is now reachable by a freshly seeded
  // Agent-role user; this proves that, rather than a 403.
  it("allows an Agent-role user with the default customer:update grant to set a contact's portal password (Story 100)", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const agentEmail = `agent-portal-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Portal",
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
      .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
      .set("Authorization", `Bearer ${agentAccessToken}`)
      .send({ newPassword: "agent-set-password-123" })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email: contactEmail, password: "agent-set-password-123" })
      .expect(200);
  });

  // ---------------------------------------------------------------------
  // Story 100 — portal-contact access revocation
  // ---------------------------------------------------------------------
  describe("portal access revocation (Story 100)", () => {
    it("ContactSummary reflects hasPortalAccess before and after revocation", async () => {
      const before = await request(app.getHttpServer())
        .get(`/api/v1/customers/${customerId}/contacts`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(
        before.body.find((c: { id: string }) => c.id === contactId),
      ).toMatchObject({ hasPortalAccess: true });

      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-access/revoke`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const after = await request(app.getHttpServer())
        .get(`/api/v1/customers/${customerId}/contacts`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(
        after.body.find((c: { id: string }) => c.id === contactId),
      ).toMatchObject({ hasPortalAccess: false });
    });

    it("a subsequent login with the now-revoked password fails", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/portal/auth/login")
        .send({ email: contactEmail, password: "agent-set-password-123" })
        .expect(401);
    });

    it("returns 404 for an unknown contact id", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${customerId}/contacts/${randomUUID()}/portal-access/revoke`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("restoring a password and revoking again also cuts off a live refresh token", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ newPassword: "restored-password-123" })
        .expect(200);

      const loginResponse = await request(app.getHttpServer())
        .post("/api/v1/portal/auth/login")
        .send({ email: contactEmail, password: "restored-password-123" })
        .expect(200);
      const rawRefreshCookie = extractPortalRefreshCookie(loginResponse);

      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-access/revoke`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post("/api/v1/portal/auth/refresh")
        .set("Cookie", rawRefreshCookie)
        .expect(401);
    });
  });

  // ---------------------------------------------------------------------
  // Story 100 — Customer.isActive enforcement on portal login/refresh
  // ---------------------------------------------------------------------
  describe("Customer.isActive enforcement (Story 100)", () => {
    let inactiveCustomerId: string;
    let inactiveContactId: string;
    const inactiveContactEmail = `portal-inactive-${randomUUID()}@example.com`;
    const inactivePassword = "inactive-customer-password-123";

    beforeAll(async () => {
      const customer = await request(app.getHttpServer())
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ displayName: `Inactive Portal Fixture Customer ${randomUUID()}` })
        .expect(201);
      inactiveCustomerId = customer.body.id;

      const contact = await request(app.getHttpServer())
        .post(`/api/v1/customers/${inactiveCustomerId}/contacts`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ fullName: "Inactive Portal Contact", email: inactiveContactEmail })
        .expect(201);
      inactiveContactId = contact.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${inactiveCustomerId}/contacts/${inactiveContactId}/portal-password`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ newPassword: inactivePassword })
        .expect(200);
    });

    it("rejects a login for a contact whose Customer has been deactivated", async () => {
      const loginResponse = await request(app.getHttpServer())
        .post("/api/v1/portal/auth/login")
        .send({ email: inactiveContactEmail, password: inactivePassword })
        .expect(200);
      const rawRefreshCookie = extractPortalRefreshCookie(loginResponse);

      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${inactiveCustomerId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ isActive: false })
        .expect(200);

      await request(app.getHttpServer())
        .post("/api/v1/portal/auth/login")
        .send({ email: inactiveContactEmail, password: inactivePassword })
        .expect(401);

      // A refresh token issued before deactivation is also rejected —
      // deactivation is enforced on every rotation, not only at login.
      await request(app.getHttpServer())
        .post("/api/v1/portal/auth/refresh")
        .set("Cookie", rawRefreshCookie)
        .expect(401);
    });
  });
});
