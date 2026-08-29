import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for the `portal/tickets/*` HTTP surface — Story 53
 * (Customer Portal — Submit & Track Own Tickets).
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `portal.e2e-spec.ts` (Story 52). Builds its own Customer/Contact
 * fixture (with portal access) plus a *second*, unrelated Customer/Contact
 * used only to prove cross-customer 404 masking — never a direct DB write.
 */
describe("Customer Portal — Tickets (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let customerId: string;
  let contactId: string;
  let otherContactId: string;
  let ticketId: string;
  const contactEmail = `portal-ticket-contact-${randomUUID()}@example.com`;
  const otherContactEmail = `portal-ticket-other-contact-${randomUUID()}@example.com`;
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
      .send({ displayName: `Portal Tickets Fixture Customer ${randomUUID()}` })
      .expect(201);
    customerId = customer.body.id;

    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Tickets Test Contact", email: contactEmail })
      .expect(201);
    contactId = contact.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: portalPassword })
      .expect(200);

    // A second, unrelated Customer/Contact — used only to prove cross-customer 404 masking.
    const otherCustomer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Portal Tickets Fixture Other Customer ${randomUUID()}` })
      .expect(201);
    const otherCustomerId = otherCustomer.body.id;

    const otherContact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${otherCustomerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Tickets Other Contact", email: otherContactEmail })
      .expect(201);
    otherContactId = otherContact.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${otherCustomerId}/contacts/${otherContactId}/portal-password`)
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

  it("rejects every route without a token", async () => {
    await request(app.getHttpServer()).get("/api/v1/portal/tickets").expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/portal/tickets")
      .send({ subject: "Should not be created" })
      .expect(401);
  });

  it("rejects an agent-audience token on every route (401)", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ subject: "Should not be created" })
      .expect(401);
  });

  it("rejects an empty subject with a validation error", async () => {
    const token = await loginAsPortalContact(contactEmail);

    await request(app.getHttpServer())
      .post("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "" })
      .expect(400);
  });

  it("returns [] for a customer with no tickets yet", async () => {
    const token = await loginAsPortalContact(contactEmail);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it("submits a ticket scoped to the contact's own customer, with no client-controlled scope fields accepted", async () => {
    const token = await loginAsPortalContact(contactEmail);

    const response = await request(app.getHttpServer())
      .post("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Cannot log in", category: "account" })
      .expect(201);

    expect(response.body.customerId).toBe(customerId);
    expect(response.body.contactId).toBe(contactId);
    expect(response.body.status).toBe("OPEN");
    expect(response.body.category).toBe("account");
    ticketId = response.body.id;
  });

  it("lists the submitted ticket for the same customer's contact", async () => {
    const token = await loginAsPortalContact(contactEmail);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const ids = response.body.map((ticket: { id: string }) => ticket.id);
    expect(ids).toContain(ticketId);
  });

  it("gets the ticket's detail", async () => {
    const token = await loginAsPortalContact(contactEmail);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/portal/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body.id).toBe(ticketId);
  });

  it("shows the ticket.created history entry with actorUserId null", async () => {
    const token = await loginAsPortalContact(contactEmail);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/portal/tickets/${ticketId}/history`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].eventType).toBe("ticket.created");
    expect(response.body[0].actorUserId).toBeNull();
  });

  it("returns 404 for the ticket when viewed by a contact from a different customer", async () => {
    const otherToken = await loginAsPortalContact(otherContactEmail);

    await request(app.getHttpServer())
      .get(`/api/v1/portal/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/portal/tickets/${ticketId}/history`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
  });

  it("does not include the ticket in the other customer's list", async () => {
    const otherToken = await loginAsPortalContact(otherContactEmail);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it("returns 404 for an unknown ticket id", async () => {
    const token = await loginAsPortalContact(contactEmail);

    await request(app.getHttpServer())
      .get(`/api/v1/portal/tickets/${randomUUID()}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  // Story 55 — Customer Portal — Ticket CSAT / Feedback.
  describe("CSAT / feedback", () => {
    it("returns 204 (not an error) before any feedback has been submitted", async () => {
      const token = await loginAsPortalContact(contactEmail);

      await request(app.getHttpServer())
        .get(`/api/v1/portal/tickets/${ticketId}/csat`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);
    });

    it("rejects feedback while the ticket is still OPEN", async () => {
      const token = await loginAsPortalContact(contactEmail);

      await request(app.getHttpServer())
        .post(`/api/v1/portal/tickets/${ticketId}/csat`)
        .set("Authorization", `Bearer ${token}`)
        .send({ rating: 5 })
        .expect(400);
    });

    it("rejects an out-of-range rating", async () => {
      const token = await loginAsPortalContact(contactEmail);

      await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${ticketId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "RESOLVED" })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/portal/tickets/${ticketId}/csat`)
        .set("Authorization", `Bearer ${token}`)
        .send({ rating: 6 })
        .expect(400);
    });

    it("submits feedback once the ticket is resolved, then blocks a second submission", async () => {
      const token = await loginAsPortalContact(contactEmail);

      const submitResponse = await request(app.getHttpServer())
        .post(`/api/v1/portal/tickets/${ticketId}/csat`)
        .set("Authorization", `Bearer ${token}`)
        .send({ rating: 4, comment: "Resolved quickly" })
        .expect(201);
      expect(submitResponse.body.id).toBeDefined();

      await request(app.getHttpServer())
        .post(`/api/v1/portal/tickets/${ticketId}/csat`)
        .set("Authorization", `Bearer ${token}`)
        .send({ rating: 5 })
        .expect(409);
    });

    it("returns the submitted feedback to the customer", async () => {
      const token = await loginAsPortalContact(contactEmail);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/portal/tickets/${ticketId}/csat`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(response.body.rating).toBe(4);
      expect(response.body.comment).toBe("Resolved quickly");
    });

    it("is visible to an agent via GET /tickets/:id/csat", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/csat`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(response.body.rating).toBe(4);
    });

    it("returns 404 for a contact from a different customer", async () => {
      const otherToken = await loginAsPortalContact(otherContactEmail);

      await request(app.getHttpServer())
        .get(`/api/v1/portal/tickets/${ticketId}/csat`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/v1/portal/tickets/${ticketId}/csat`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ rating: 3 })
        .expect(404);
    });
  });
});
