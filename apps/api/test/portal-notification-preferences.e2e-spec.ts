import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for Story 90 — `GET/PATCH /portal/notification-preferences`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `notification-preferences.e2e-spec.ts` (Story 58) and
 * `portal-notifications.e2e-spec.ts` (Story 88). Self-scoped, so — like
 * Story 58's own suite — no permission/role-creation dance is needed; this
 * suite instead proves cross-contact isolation using a second portal
 * contact, and cross-audience rejection using the seeded admin's
 * agent-audience token.
 */
describe("Customer Portal — Notification Preferences (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let customerId: string;
  let contactId: string;
  const contactEmail = `portal-notif-prefs-contact-${randomUUID()}@example.com`;
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
      .send({ displayName: `Portal Notif Prefs Fixture Customer ${randomUUID()}` })
      .expect(201);
    customerId = customer.body.id;

    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Notif Prefs Test Contact", email: contactEmail })
      .expect(201);
    contactId = contact.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: portalPassword })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAsPortalContact(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/portal/auth/login")
      .send({ email, password: portalPassword })
      .expect(200);
    return response.body.accessToken as string;
  }

  async function createPortalContact(): Promise<string> {
    const email = `portal-notif-prefs-other-${randomUUID()}@example.com`;
    const otherCustomer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Portal Notif Prefs Other Customer ${randomUUID()}` })
      .expect(201);
    const otherContact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${otherCustomer.body.id}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Notif Prefs Other Contact", email })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${otherCustomer.body.id}/contacts/${otherContact.body.id}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: portalPassword })
      .expect(200);
    return email;
  }

  it("rejects an unauthenticated request on both routes", async () => {
    await request(app.getHttpServer()).get("/api/v1/portal/notification-preferences").expect(401);
    await request(app.getHttpServer())
      .patch("/api/v1/portal/notification-preferences")
      .send({ eventType: "ticket.updated", inAppEnabled: false })
      .expect(401);
  });

  it("rejects an agent-audience token on both routes", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/portal/notification-preferences")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .patch("/api/v1/portal/notification-preferences")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ eventType: "ticket.updated", inAppEnabled: false })
      .expect(401);
  });

  it("rejects an unrecognized eventType with a validation error", async () => {
    const token = await loginAsPortalContact(contactEmail);
    await request(app.getHttpServer())
      .patch("/api/v1/portal/notification-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ eventType: "sla.at_risk", inAppEnabled: false })
      .expect(400);
  });

  it("defaults every event type to enabled for a brand-new contact", async () => {
    const token = await loginAsPortalContact(contactEmail);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/notification-preferences")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual([
      { eventType: "ticket.updated", inAppEnabled: true },
      { eventType: "channel.message.created", inAppEnabled: true },
    ]);
  });

  it("persists a real PATCH, reflected on the next GET", async () => {
    const token = await loginAsPortalContact(contactEmail);

    await request(app.getHttpServer())
      .patch("/api/v1/portal/notification-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ eventType: "channel.message.created", inAppEnabled: false })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/notification-preferences")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const newReply = response.body.find(
      (row: { eventType: string }) => row.eventType === "channel.message.created",
    );
    expect(newReply.inAppEnabled).toBe(false);

    // Restore, so this test is safe to re-run against the same seeded
    // contact without leaving a permanent side effect for any other test
    // in this file.
    await request(app.getHttpServer())
      .patch("/api/v1/portal/notification-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ eventType: "channel.message.created", inAppEnabled: true })
      .expect(200);
  });

  it("never leaks one contact's preference to another's", async () => {
    const otherEmail = await createPortalContact();
    const otherToken = await loginAsPortalContact(otherEmail);

    await request(app.getHttpServer())
      .patch("/api/v1/portal/notification-preferences")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ eventType: "ticket.updated", inAppEnabled: false })
      .expect(200);

    const token = await loginAsPortalContact(contactEmail);
    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/notification-preferences")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const ticketUpdated = response.body.find(
      (row: { eventType: string }) => row.eventType === "ticket.updated",
    );
    expect(ticketUpdated.inAppEnabled).toBe(true);
  });
});
