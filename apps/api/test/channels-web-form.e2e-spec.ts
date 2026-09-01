import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Integration suite for `POST /channels/web-form` — Story 87
 * (Communication/Channels: Public Web-Form Ticket Intake).
 *
 * Bootstraps the REAL `AppModule` (same guards/interceptors/pipes as
 * `src/main.ts`), exactly like `customers.e2e-spec.ts`. Logs in as the
 * seed's bootstrap admin only to read the seeded branch id via
 * `GET /identity/branches` and to verify created tickets/messages as an
 * agent — every actual `POST /channels/web-form` call in this suite is
 * unauthenticated, matching the route's real-world caller.
 *
 * Known scope limit (same as `customers.e2e-spec.ts`): `prisma/seed.ts`
 * creates exactly one Branch, so true cross-branch isolation is covered by
 * `customers.service.spec.ts`'s mocked-Prisma tests, not here.
 */
describe("Channels — Public Web-Form Ticket Intake (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let branchId: string;

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

    const branchesResponse = await request(app.getHttpServer())
      .get("/api/v1/identity/branches")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    branchId = branchesResponse.body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      branchId,
      fullName: "Web Form Submitter",
      email: `web-form-${randomUUID()}@example.com`,
      phone: "555-0100",
      subject: "Cannot access my account",
      category: "account",
      message: "I keep getting an invalid password error when I try to log in.",
      ...overrides,
    };
  }

  it("requires no authentication at all", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/channels/web-form")
      .send(validPayload())
      .expect(201);
  });

  it("rejects a request missing required fields with a validation error", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/channels/web-form")
      .send({ branchId, fullName: "No Email Or Subject" })
      .expect(400);
  });

  it("rejects an invalid email", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/channels/web-form")
      .send(validPayload({ email: "not-an-email" }))
      .expect(400);
  });

  it("rejects a client-controlled field the DTO doesn't declare", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/channels/web-form")
      .send(validPayload({ customerId: randomUUID(), priority: "URGENT" }))
      .expect(400);
  });

  it("rejects an unknown branch id", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/channels/web-form")
      .send(validPayload({ branchId: randomUUID() }))
      .expect(404);
  });

  it("creates a ticket and a WEB_FORM channel message for a brand-new email, visible to an agent", async () => {
    const payload = validPayload();

    const response = await request(app.getHttpServer())
      .post("/api/v1/channels/web-form")
      .send(payload)
      .expect(201);

    expect(response.body).toMatchObject({
      subject: payload.subject,
      category: payload.category,
      status: "OPEN",
    });
    expect(response.body.id).toBeDefined();
    expect(response.body.customerId).toBeDefined();
    expect(response.body.contactId).toBeDefined();
    const ticketId = response.body.id as string;

    const ticketResponse = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(ticketResponse.body.id).toBe(ticketId);

    const messagesResponse = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(messagesResponse.body).toHaveLength(1);
    expect(messagesResponse.body[0]).toMatchObject({
      ticketId,
      channelType: "WEB_FORM",
      direction: "INBOUND",
      senderContactId: response.body.contactId,
      senderUserId: null,
      body: payload.message,
    });
  });

  it("reuses the same Customer/Contact for a second submission with the same email, while still creating a separate ticket", async () => {
    const email = `web-form-repeat-${randomUUID()}@example.com`;

    const first = await request(app.getHttpServer())
      .post("/api/v1/channels/web-form")
      .send(validPayload({ email, subject: "First request" }))
      .expect(201);

    const second = await request(app.getHttpServer())
      .post("/api/v1/channels/web-form")
      .send(validPayload({ email, subject: "Second, unrelated request" }))
      .expect(201);

    expect(second.body.id).not.toBe(first.body.id);
    expect(second.body.customerId).toBe(first.body.customerId);
    expect(second.body.contactId).toBe(first.body.contactId);
  });

  // Placed last: every prior test in this file makes 8 calls to this route
  // combined, comfortably under this route's own tighter @Throttle
  // (20/60s, still far tighter than the global default's 100/60s). Firing
  // subsequent requests sequentially reliably pushes the window's total past 20
  // without triggering concurrent socket reset (ECONNRESET) on closed throttled connections.
  it("enforces its own tighter rate limit than the global default", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) {
      const response = await request(app.getHttpServer())
        .post("/api/v1/channels/web-form")
        .send(validPayload());
      statuses.push(response.status);
      if (response.status === 429) {
        break;
      }
    }

    expect(statuses).toContain(429);
  });
});
