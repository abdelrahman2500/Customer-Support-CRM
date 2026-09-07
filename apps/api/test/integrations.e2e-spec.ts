import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { WEBHOOK_DISPATCH_QUEUE } from "../src/queues/webhook-dispatch.producer";

/**
 * RM-20 — Webhook Subscriptions + Outbound Event Dispatch. Integration
 * suite for `integrations/webhook-subscriptions/*` CRUD, the
 * `integration:manage` permission gate, and the real
 * `ticket.updated` → `WebhookDispatchListener` → `webhook-dispatch` queue
 * wiring — mirrors `tickets.e2e-spec.ts`'s own RM-19 "enqueues a real
 * job" describe block exactly (`apps/worker` is never booted by this
 * suite, so the actual signed HTTP POST is proven separately by
 * `apps/worker/test/webhook-dispatch.e2e-spec.ts` against a real local
 * HTTP server).
 */
describe("Integrations — Webhook Subscriptions (e2e)", () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let customerId: string;

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
      throw new Error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must both be set for this suite to run");
    }
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    adminAccessToken = loginResponse.body.accessToken;

    const customer = await request(app.getHttpServer())
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ displayName: `RM-20 e2e customer ${randomUUID()}` })
      .expect(201);
    customerId = customer.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createSubscription(
    subscribedEventTypes: string[] = ["ticket.updated"],
  ): Promise<{ id: string; secret: string; targetUrl: string }> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/integrations/webhook-subscriptions")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ targetUrl: `https://example.test/hook/${randomUUID()}`, subscribedEventTypes })
      .expect(201);
    return response.body;
  }

  async function getAgentAccessToken(): Promise<string> {
    const agentEmail = `agent-webhooks-${randomUUID()}@example.com`;
    const agentPassword = "agent-test-password-123";
    const roles = await request(app.getHttpServer())
      .get("/api/v1/identity/roles")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const agentRole = roles.body.find((role: { name: string }) => role.name === "Agent");
    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/identity/users")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        email: agentEmail,
        password: agentPassword,
        fullName: "Test Agent Webhooks",
        branchId: me.body.branchId,
        departmentId: me.body.departmentId ?? undefined,
        roleId: agentRole.id,
      })
      .expect(201);

    const agentLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: agentEmail, password: agentPassword })
      .expect(200);
    return agentLogin.body.accessToken as string;
  }

  describe("permission gate", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/v1/integrations/webhook-subscriptions").expect(401);
    });

    it("rejects an Agent-role user, which has no integration:manage grant by default", async () => {
      const agentAccessToken = await getAgentAccessToken();

      await request(app.getHttpServer())
        .get("/api/v1/integrations/webhook-subscriptions")
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post("/api/v1/integrations/webhook-subscriptions")
        .set("Authorization", `Bearer ${agentAccessToken}`)
        .send({ targetUrl: "https://example.test/hook", subscribedEventTypes: ["ticket.updated"] })
        .expect(403);
    });
  });

  describe("CRUD", () => {
    it("rejects an unknown event type", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/integrations/webhook-subscriptions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ targetUrl: "https://example.test/hook", subscribedEventTypes: ["not.a.real.event"] })
        .expect(400);
    });

    it("creates a subscription, returning the signing secret exactly once", async () => {
      const created = await createSubscription();

      expect(created).toMatchObject({
        id: expect.any(String),
        subscribedEventTypes: ["ticket.updated"],
        isActive: true,
        secret: expect.any(String),
      });
      expect((created.secret as string).length).toBeGreaterThanOrEqual(32);
    });

    it("never returns the secret again from list/get", async () => {
      const created = await createSubscription();

      const listResponse = await request(app.getHttpServer())
        .get("/api/v1/integrations/webhook-subscriptions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const listed = listResponse.body.find((row: { id: string }) => row.id === created.id);
      expect(listed).not.toHaveProperty("secret");

      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/integrations/webhook-subscriptions/${created.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(getResponse.body).not.toHaveProperty("secret");
    });

    it("returns 404 for a subscription that doesn't exist", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/integrations/webhook-subscriptions/${randomUUID()}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("updates isActive/targetUrl/subscribedEventTypes via PATCH", async () => {
      const created = await createSubscription();

      const patched = await request(app.getHttpServer())
        .patch(`/api/v1/integrations/webhook-subscriptions/${created.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ isActive: false, subscribedEventTypes: ["sla.breached"] })
        .expect(200);

      expect(patched.body).toMatchObject({ isActive: false, subscribedEventTypes: ["sla.breached"] });
    });

    it("deletes a subscription, after which it 404s", async () => {
      const created = await createSubscription();

      await request(app.getHttpServer())
        .delete(`/api/v1/integrations/webhook-subscriptions/${created.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/integrations/webhook-subscriptions/${created.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it("lists an empty delivery-attempt log for a freshly created subscription", async () => {
      const created = await createSubscription();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/integrations/webhook-subscriptions/${created.id}/delivery-attempts`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ items: [], total: 0 });
    });
  });

  describe("real dispatch wiring (RM-20)", () => {
    async function waitForJob(
      queue: Queue<{ subscriptionId: string; eventType: string; ticketId: string }>,
      subscriptionId: string,
      { timeoutMs = 5000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
    ): Promise<Job<{ subscriptionId: string; eventType: string; ticketId: string }> | undefined> {
      const deadline = Date.now() + timeoutMs;
      do {
        const jobs = await queue.getJobs(["waiting", "active", "completed"]);
        const job = jobs.find((candidate) => candidate.data.subscriptionId === subscriptionId);
        if (job) {
          return job;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } while (Date.now() < deadline);
      return undefined;
    }

    it("enqueues a real webhook-dispatch job when a ticket update matches a subscribed, active subscription", async () => {
      const created = await createSubscription(["ticket.updated"]);
      const ticket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, subject: "RM-20 webhook dispatch fixture" })
        .expect(201);

      const queue: Queue<{ subscriptionId: string; eventType: string; ticketId: string }> = app.get(
        getQueueToken(WEBHOOK_DISPATCH_QUEUE),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${ticket.body.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ priority: "HIGH" })
        .expect(200);

      const job = await waitForJob(queue, created.id);
      expect(job).toBeDefined();
      expect(job?.data).toEqual({
        subscriptionId: created.id,
        eventType: "ticket.updated",
        ticketId: ticket.body.id,
      });

      await job?.remove();
    });

    it("does not enqueue a job for a subscription that isn't subscribed to that event type", async () => {
      const created = await createSubscription(["sla.breached"]);
      const ticket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, subject: "RM-20 non-matching event fixture" })
        .expect(201);

      const queue: Queue<{ subscriptionId: string; eventType: string; ticketId: string }> = app.get(
        getQueueToken(WEBHOOK_DISPATCH_QUEUE),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${ticket.body.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ priority: "HIGH" })
        .expect(200);

      const job = await waitForJob(queue, created.id, { timeoutMs: 1000 });
      expect(job).toBeUndefined();
    });

    it("does not enqueue a job for a deactivated subscription", async () => {
      const created = await createSubscription(["ticket.updated"]);
      await request(app.getHttpServer())
        .patch(`/api/v1/integrations/webhook-subscriptions/${created.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ isActive: false })
        .expect(200);
      const ticket = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ customerId, subject: "RM-20 deactivated subscription fixture" })
        .expect(201);

      const queue: Queue<{ subscriptionId: string; eventType: string; ticketId: string }> = app.get(
        getQueueToken(WEBHOOK_DISPATCH_QUEUE),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${ticket.body.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ priority: "HIGH" })
        .expect(200);

      const job = await waitForJob(queue, created.id, { timeoutMs: 1000 });
      expect(job).toBeUndefined();
    });
  });
});
