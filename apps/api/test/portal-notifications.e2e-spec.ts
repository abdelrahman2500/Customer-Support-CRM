import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Integration suite for Story 88 — `GET /portal/notifications`.
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, exactly
 * like `portal-tickets.e2e-spec.ts` (Story 53) and
 * `notifications-read.e2e-spec.ts` (Story 36). Drives real HTTP calls (a
 * ticket update, an agent reply) rather than emitting events directly, so
 * this exercises `PortalNotificationLogListener` end-to-end, not just
 * `NotificationsService`'s read query.
 */
describe("Customer Portal — Notification History (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAccessToken: string;
  let customerId: string;
  let contactId: string;
  let ticketId: string;
  const contactEmail = `portal-notif-contact-${randomUUID()}@example.com`;
  const portalPassword = "a-strong-portal-password";

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

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Portal Notifications Fixture Customer ${randomUUID()}` })
      .expect(201);
    customerId = customer.body.id;

    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Notifications Test Contact", email: contactEmail })
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

  async function waitForNotificationLogRows(
    customerIdToMatch: string,
    minCount: number,
    { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
  ) {
    const deadline = Date.now() + timeoutMs;
    do {
      const rows = await prisma.notificationLog.findMany({
        where: { customerId: customerIdToMatch },
      });
      if (rows.length >= minCount) {
        return rows;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (Date.now() < deadline);
    throw new Error("Timed out waiting for the customer-scoped NotificationLog rows to be persisted");
  }

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/api/v1/portal/notifications").expect(401);
  });

  it("rejects an agent-audience token", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/portal/notifications")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(401);
  });

  it("returns [] for a customer with no notification history yet", async () => {
    const token = await loginAsPortalContact(contactEmail);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/notifications")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it("persists and surfaces ticket.updated and agent-reply notifications, and keeps GET /notifications unaffected", async () => {
    const token = await loginAsPortalContact(contactEmail);

    const ticket = await request(app.getHttpServer())
      .post("/api/v1/portal/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Notification history e2e ticket" })
      .expect(201);
    ticketId = ticket.body.id;

    // Triggers ticket.updated → PortalNotificationLogListener persists a
    // customer-scoped row.
    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ priority: "URGENT" })
      .expect(200);

    // Triggers channel.message.created with senderUserId set (an agent
    // reply) → PortalNotificationLogListener persists a second row.
    await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ body: "We're looking into this." })
      .expect(201);

    await waitForNotificationLogRows(customerId, 2);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/notifications")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const eventTypes = response.body.map((n: { eventType: string; ticketId: string }) => ({
      eventType: n.eventType,
      ticketId: n.ticketId,
    }));
    expect(eventTypes).toContainEqual({ eventType: "ticket.updated", ticketId });
    expect(eventTypes).toContainEqual({ eventType: "channel.message.created", ticketId });

    // Newest first.
    const loggedAts = response.body.map((n: { loggedAt: string }) => new Date(n.loggedAt).getTime());
    expect(loggedAts).toEqual([...loggedAts].sort((a, b) => b - a));

    // The agent-facing endpoint's result set must be unaffected by this
    // story — neither new row is customer-scoped-and-branch-visible the
    // way ticket.escalated/sla.at_risk rows are.
    const agentResponse = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentMatch = agentResponse.body.find(
      (n: { ticketId: string }) => n.ticketId === ticketId,
    );
    expect(agentMatch).toBeUndefined();
  });

  it("does not surface another customer's notification history", async () => {
    const otherCustomer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Portal Notifications Fixture Other Customer ${randomUUID()}` })
      .expect(201);

    const otherContactEmail = `portal-notif-other-contact-${randomUUID()}@example.com`;
    const otherContact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${otherCustomer.body.id}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Notifications Other Contact", email: otherContactEmail })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${otherCustomer.body.id}/contacts/${otherContact.body.id}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: portalPassword })
      .expect(200);

    const otherToken = await loginAsPortalContact(otherContactEmail);

    const response = await request(app.getHttpServer())
      .get("/api/v1/portal/notifications")
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(200);
    expect(response.body).toEqual([]);
  });
});
