import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { WebhookVerifierRegistry } from "../src/modules/integrations/webhook-verifier";
import type { WebhookVerifier } from "../src/modules/integrations/webhook-verifier";
import { PrismaService } from "../src/prisma/prisma.service";

/** A minimal HMAC-SHA256 verifier — exactly the shape a real provider
 * adapter would eventually register, registered here only for this suite
 * (`overrideProvider`), proving the framework end to end without any real
 * external provider — per the plan's own acceptance criteria. */
const TEST_SECRET = "e2e-test-secret";
const testVerifier: WebhookVerifier = {
  verify(rawBody, headers) {
    const signature = headers["x-test-signature"];
    if (typeof signature !== "string") {
      return { verified: false, rejectReason: "Missing x-test-signature header" };
    }
    const expected = createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");
    return signature === expected
      ? { verified: true }
      : { verified: false, rejectReason: "Signature mismatch" };
  },
};

/**
 * RM-21 — Inbound Webhook Receiver + Signature Verification Framework.
 * A separate app bootstrap from `integrations.e2e-spec.ts` (RM-20's own
 * suite): this route needs `rawBody: true` (main.ts's own real
 * configuration, mirrored here) and a `WebhookVerifierRegistry` override
 * registering a test-only verifier — no real provider exists yet.
 */
describe("Integrations — Inbound Webhook Receiver (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminAccessToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WebhookVerifierRegistry)
      .useValue(new WebhookVerifierRegistry([["test-provider", testVerifier]]))
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });

    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must both be set for this suite to run");
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

  function sign(body: string): string {
    return createHmac("sha256", TEST_SECRET).update(body).digest("hex");
  }

  describe("POST /integrations/webhooks/:providerKey", () => {
    it("accepts and logs a correctly signed payload for a recognized provider", async () => {
      const body = JSON.stringify({ event: "test.event", id: "payload-1" });

      const response = await request(app.getHttpServer())
        .post("/api/v1/integrations/webhooks/test-provider")
        .set("Content-Type", "application/json")
        .set("x-test-signature", sign(body))
        .send(body)
        .expect(200);

      expect(response.body).toEqual({ received: true });

      const logs = await prisma.webhookInboundLog.findMany({
        where: { providerKey: "test-provider" },
        orderBy: { receivedAt: "desc" },
        take: 1,
      });
      expect(logs[0]).toMatchObject({ verified: true, rejectReason: null, body });
    });

    it("rejects and logs an incorrectly signed payload for a recognized provider", async () => {
      const body = JSON.stringify({ event: "test.event", id: "payload-2" });

      await request(app.getHttpServer())
        .post("/api/v1/integrations/webhooks/test-provider")
        .set("Content-Type", "application/json")
        .set("x-test-signature", "sha256=not-the-real-signature")
        .send(body)
        .expect(401);

      const logs = await prisma.webhookInboundLog.findMany({
        where: { providerKey: "test-provider" },
        orderBy: { receivedAt: "desc" },
        take: 1,
      });
      expect(logs[0]).toMatchObject({ verified: false, rejectReason: "Signature mismatch", body });
    });

    it("rejects and logs a payload for an unrecognized providerKey", async () => {
      const body = JSON.stringify({ event: "test.event" });

      await request(app.getHttpServer())
        .post("/api/v1/integrations/webhooks/no-such-provider")
        .set("Content-Type", "application/json")
        .send(body)
        .expect(401);

      const logs = await prisma.webhookInboundLog.findMany({
        where: { providerKey: "no-such-provider" },
        orderBy: { receivedAt: "desc" },
        take: 1,
      });
      expect(logs[0]).toMatchObject({ verified: false, body });
      expect(logs[0]?.rejectReason).toContain("No verifier registered");
    });

    it("requires no Authorization header at all — a genuinely public route", async () => {
      const body = JSON.stringify({ event: "test.event" });

      await request(app.getHttpServer())
        .post("/api/v1/integrations/webhooks/test-provider")
        .set("Content-Type", "application/json")
        .set("x-test-signature", sign(body))
        .send(body)
        .expect(200);
    });
  });

  describe("GET /integrations/webhook-inbound-logs", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/integrations/webhook-inbound-logs").expect(401);
    });

    it("lists received payloads for an authenticated admin", async () => {
      const body = JSON.stringify({ event: "test.event", id: "payload-listed" });
      await request(app.getHttpServer())
        .post("/api/v1/integrations/webhooks/test-provider")
        .set("Content-Type", "application/json")
        .set("x-test-signature", sign(body))
        .send(body)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/api/v1/integrations/webhook-inbound-logs")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.items.some((log: { body: string }) => log.body === body)).toBe(true);
    });
  });

  // Placed last: every prior test in this file makes 6 calls to this route
  // combined, comfortably under this route's own tighter @Throttle
  // (20/60s) — mirrors `channels-web-form.e2e-spec.ts`'s own precedent for
  // why this test runs last and sequentially.
  it("rate-limits this route tighter than the global default", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const body = JSON.stringify({ event: "test.event", i });
      const response = await request(app.getHttpServer())
        .post("/api/v1/integrations/webhooks/test-provider")
        .set("Content-Type", "application/json")
        .set("x-test-signature", sign(body))
        .send(body);
      statuses.push(response.status);
      if (response.status === 429) {
        break;
      }
    }

    expect(statuses).toContain(429);
  });
});
