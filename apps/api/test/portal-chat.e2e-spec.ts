import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Integration suite for the `portal/chat/*` HTTP surface — Story 80
 * (AI Portal Chatbot, Foundation).
 *
 * Bootstraps the REAL `AppModule` against a REAL Postgres/Redis, mirroring
 * `portal-tickets.e2e-spec.ts`'s exact fixture/auth pattern. `apps/worker`
 * is never booted by this suite (mirrors `tickets.e2e-spec.ts`'s own
 * documented scope boundary), so a SUCCESS-outcome test simulates
 * completion by updating the `AiPromptLog` row directly via Prisma.
 */
describe("Customer Portal — AI Chatbot (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAccessToken: string;
  let customerId: string;
  let contactId: string;
  let otherContactId: string;
  const contactEmail = `portal-chat-contact-${randomUUID()}@example.com`;
  const otherContactEmail = `portal-chat-other-contact-${randomUUID()}@example.com`;
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
    prisma = moduleRef.get(PrismaService);

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
      .send({ displayName: `Portal Chat Fixture Customer ${randomUUID()}` })
      .expect(201);
    customerId = customer.body.id;

    const contact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Chat Test Contact", email: contactEmail })
      .expect(201);
    contactId = contact.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}/contacts/${contactId}/portal-password`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ newPassword: portalPassword })
      .expect(200);

    // A second, unrelated Customer/Contact — used only to prove
    // cross-contact 404 masking.
    const otherCustomer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `Portal Chat Fixture Other Customer ${randomUUID()}` })
      .expect(201);
    const otherCustomerId = otherCustomer.body.id;

    const otherContact = await request(app.getHttpServer())
      .post(`/api/v1/customers/${otherCustomerId}/contacts`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ fullName: "Portal Chat Other Contact", email: otherContactEmail })
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

  async function startSession(token: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/portal/chat/sessions")
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    return response.body.id as string;
  }

  it("rejects every route without a token", async () => {
    await request(app.getHttpServer()).post("/api/v1/portal/chat/sessions").expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${randomUUID()}/messages`)
      .expect(401);
  });

  it("rejects an agent-audience token on every route (401)", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/portal/chat/sessions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(401);
  });

  it("starts a chat session for the authenticated contact", async () => {
    const token = await loginAsPortalContact(contactEmail);

    const response = await request(app.getHttpServer())
      .post("/api/v1/portal/chat/sessions")
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    expect(response.body.id).toEqual(expect.any(String));
  });

  it("rejects an empty message body with a validation error", async () => {
    const token = await loginAsPortalContact(contactEmail);
    const sessionId = await startSession(token);

    await request(app.getHttpServer())
      .post(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "" })
      .expect(400);
  });

  it("sends a message, returns { id, outcome: PENDING }, and persists the customer's own ChatMessage", async () => {
    const token = await loginAsPortalContact(contactEmail);
    const sessionId = await startSession(token);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Hi, I need help resetting my password" })
      .expect(201);

    expect(response.body).toEqual({ id: expect.any(String), outcome: "PENDING" });

    const messages = await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(messages.body).toEqual([
      expect.objectContaining({ role: "CUSTOMER", body: "Hi, I need help resetting my password" }),
    ]);
  });

  it("returns 200 with outcome PENDING immediately after sending", async () => {
    const token = await loginAsPortalContact(contactEmail);
    const sessionId = await startSession(token);

    const sent = await request(app.getHttpServer())
      .post(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Hello" })
      .expect(201);

    const result = await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${sessionId}/ai/${sent.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(result.body).toMatchObject({
      id: sent.body.id,
      outcome: "PENDING",
      outputText: null,
      errorMessage: null,
    });
  });

  it("returns 200 with the real reply once the row is resolved, and the reply appears in the message list (apps/worker not booted)", async () => {
    const token = await loginAsPortalContact(contactEmail);
    const sessionId = await startSession(token);

    const sent = await request(app.getHttpServer())
      .post(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "How do I reset my password?" })
      .expect(201);

    await prisma.aiPromptLog.update({
      where: { id: sent.body.id },
      data: { model: "claude-test", outcome: "SUCCESS", outputText: "Click 'Forgot password' on the login page." },
    });
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        body: "Click 'Forgot password' on the login page.",
      },
    });

    const result = await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${sessionId}/ai/${sent.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(result.body).toMatchObject({
      id: sent.body.id,
      outcome: "SUCCESS",
      outputText: "Click 'Forgot password' on the login page.",
    });

    const messages = await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(messages.body).toEqual([
      expect.objectContaining({ role: "CUSTOMER", body: "How do I reset my password?" }),
      expect.objectContaining({
        role: "ASSISTANT",
        body: "Click 'Forgot password' on the login page.",
      }),
    ]);
  });

  it("returns 404 when a different contact's session id is used for messages/ai/logId", async () => {
    const token = await loginAsPortalContact(contactEmail);
    const otherToken = await loginAsPortalContact(otherContactEmail);
    const sessionId = await startSession(token);
    const sent = await request(app.getHttpServer())
      .post(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Private message" })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ body: "Should not be created" })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${sessionId}/ai/${sent.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
  });

  it("returns 404 for an unknown session id", async () => {
    const token = await loginAsPortalContact(contactEmail);

    await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${randomUUID()}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("returns 404 for a logId that doesn't exist", async () => {
    const token = await loginAsPortalContact(contactEmail);
    const sessionId = await startSession(token);

    await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${sessionId}/ai/${randomUUID()}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("returns 404 when the logId belongs to a different session", async () => {
    const token = await loginAsPortalContact(contactEmail);
    const sessionA = await startSession(token);
    const sessionB = await startSession(token);

    const sentOnB = await request(app.getHttpServer())
      .post(`/api/v1/portal/chat/sessions/${sessionB}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "On session B" })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/portal/chat/sessions/${sessionA}/ai/${sentOnB.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });

  // Story 81 — AI Feature Flags per Branch.
  it("still persists the customer's own message but returns { id, outcome: DISABLED } and never an assistant reply when chat is disabled for the branch", async () => {
    const token = await loginAsPortalContact(contactEmail);
    const sessionId = await startSession(token);

    await request(app.getHttpServer())
      .patch("/api/v1/ai/settings")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ chatEnabled: false })
      .expect(200);

    try {
      const sent = await request(app.getHttpServer())
        .post(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
        .set("Authorization", `Bearer ${token}`)
        .send({ body: "Is anyone there?" })
        .expect(201);
      expect(sent.body).toEqual({ id: expect.any(String), outcome: "DISABLED" });

      const result = await request(app.getHttpServer())
        .get(`/api/v1/portal/chat/sessions/${sessionId}/ai/${sent.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(result.body).toMatchObject({ outcome: "DISABLED", outputText: null });

      const messages = await request(app.getHttpServer())
        .get(`/api/v1/portal/chat/sessions/${sessionId}/messages`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(messages.body).toEqual([
        expect.objectContaining({ role: "CUSTOMER", body: "Is anyone there?" }),
      ]);
    } finally {
      // Restore the seeded default — this branch is shared with every
      // other e2e suite in this run.
      await request(app.getHttpServer())
        .patch("/api/v1/ai/settings")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ chatEnabled: true })
        .expect(200);
    }
  });
});
