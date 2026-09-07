import { createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Job } from "bullmq";
import { WorkerModule } from "../src/worker.module";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  WebhookDispatchProcessor,
  type WebhookDispatchJobPayload,
} from "../src/queues/webhook-dispatch.processor";

interface ReceivedRequest {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** A real local HTTP server standing in for an external webhook receiver —
 * "target a local test HTTP server, not an external service" per the
 * plan's own acceptance criteria. Mirrors `email-adapter.e2e-spec.ts`'s
 * "real infra, no mock" convention, just with a server this suite owns
 * instead of the shared Mailhog container. */
function startTestServer(
  respond: (req: ReceivedRequest) => { status: number },
): Promise<{ server: Server; url: string; received: () => ReceivedRequest[] }> {
  const received: ReceivedRequest[] = [];
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const record: ReceivedRequest = {
          headers: req.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        };
        received.push(record);
        const { status } = respond(record);
        res.writeHead(status);
        res.end();
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/hook`, received: () => received });
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * RM-20 — Webhook Subscriptions + Outbound Event Dispatch. Real
 * integration suite for `WebhookDispatchProcessor`, against a real local
 * HTTP server and real Postgres — mirrors `email-adapter.e2e-spec.ts`'s
 * own "direct Prisma fixture, no HTTP client, real receiving endpoint"
 * convention. `apps/api` is never booted here; the real event → enqueue
 * wiring is proven separately by `apps/api/test/integrations.e2e-spec.ts`.
 */
describe("WebhookDispatchProcessor (e2e, real local HTTP server)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let processor: WebhookDispatchProcessor;
  let branchId: string;
  let userId: string;
  let subscriptionId: string;
  let secret: string;
  let server: Server | undefined;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    processor = moduleRef.get(WebhookDispatchProcessor);

    const branch = await prisma.branch.findFirst();
    if (!branch) {
      throw new Error(
        "Expected a seeded branch to exist (run `pnpm --filter @crm/api prisma:seed` first)",
      );
    }
    branchId = branch.id;
    const user = await prisma.user.findFirstOrThrow();
    userId = user.id;
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    if (server) {
      await closeServer(server);
      server = undefined;
    }
    if (subscriptionId) {
      await prisma.webhookDeliveryAttempt.deleteMany({ where: { subscriptionId } });
      await prisma.webhookSubscription.delete({ where: { id: subscriptionId } });
    }
  });

  async function createSubscription(targetUrl: string): Promise<void> {
    secret = randomUUID();
    const subscription = await prisma.webhookSubscription.create({
      data: {
        branchId,
        targetUrl,
        secret,
        subscribedEventTypes: ["ticket.updated"],
        createdByUserId: userId,
      },
    });
    subscriptionId = subscription.id;
  }

  it("POSTs a correctly HMAC-signed payload the receiving server can verify, and records a succeeded attempt", async () => {
    const { server: testServer, url, received } = await startTestServer(() => ({ status: 200 }));
    server = testServer;
    await createSubscription(url);
    const ticketId = randomUUID();

    const payload: WebhookDispatchJobPayload = {
      subscriptionId,
      eventType: "ticket.updated",
      ticketId,
    };
    await processor.process({ data: payload } as Job<WebhookDispatchJobPayload>);

    const requests = received();
    expect(requests).toHaveLength(1);
    const [receivedRequest] = requests;
    const body = JSON.parse(receivedRequest!.body);
    expect(body).toMatchObject({ eventType: "ticket.updated", ticketId });

    const expectedSignature = createHmac("sha256", secret).update(receivedRequest!.body).digest("hex");
    expect(receivedRequest!.headers["x-webhook-signature"]).toBe(`sha256=${expectedSignature}`);

    const attempts = await prisma.webhookDeliveryAttempt.findMany({ where: { subscriptionId } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ succeeded: true, responseStatus: 200, errorMessage: null });
  });

  it("records a failed attempt and rethrows when the receiving server responds with a 5xx", async () => {
    const { server: testServer, url } = await startTestServer(() => ({ status: 500 }));
    server = testServer;
    await createSubscription(url);

    const payload: WebhookDispatchJobPayload = {
      subscriptionId,
      eventType: "ticket.updated",
      ticketId: randomUUID(),
    };

    await expect(
      processor.process({ data: payload } as Job<WebhookDispatchJobPayload>),
    ).rejects.toThrow();

    const attempts = await prisma.webhookDeliveryAttempt.findMany({ where: { subscriptionId } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ succeeded: false, responseStatus: 500 });
  });

  it("does not dispatch and writes no attempt row once the subscription has been deactivated", async () => {
    const { server: testServer, url, received } = await startTestServer(() => ({ status: 200 }));
    server = testServer;
    await createSubscription(url);
    await prisma.webhookSubscription.update({ where: { id: subscriptionId }, data: { isActive: false } });

    const payload: WebhookDispatchJobPayload = {
      subscriptionId,
      eventType: "ticket.updated",
      ticketId: randomUUID(),
    };
    await processor.process({ data: payload } as Job<WebhookDispatchJobPayload>);

    expect(received()).toHaveLength(0);
    const attempts = await prisma.webhookDeliveryAttempt.findMany({ where: { subscriptionId } });
    expect(attempts).toHaveLength(0);
  });
});
