import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookDispatchJobPayload } from "./webhook-dispatch.processor";
import type { PrismaService } from "../prisma/prisma.service";
import type { Job } from "bullmq";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

// Imported after the mock so the mocked module is what the processor sees.
import * as Sentry from "@sentry/node";
import { WebhookDispatchProcessor, WEBHOOK_DISPATCH_QUEUE } from "./webhook-dispatch.processor";

function buildPrismaMock() {
  return {
    webhookSubscription: {
      findUnique: vi.fn(),
    },
    webhookDeliveryAttempt: {
      create: vi.fn(),
    },
  };
}

function createProcessor(prismaMock: ReturnType<typeof buildPrismaMock>): WebhookDispatchProcessor {
  return new WebhookDispatchProcessor(prismaMock as unknown as PrismaService);
}

function buildJob(data: WebhookDispatchJobPayload): Job<WebhookDispatchJobPayload> {
  return { data } as Job<WebhookDispatchJobPayload>;
}

const SUBSCRIPTION = {
  id: "subscription-1",
  branchId: "branch-1",
  targetUrl: "https://example.test/hook",
  secret: "shh-secret",
  subscribedEventTypes: ["ticket.updated"],
  isActive: true,
  createdByUserId: "user-1",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

const PAYLOAD: WebhookDispatchJobPayload = {
  subscriptionId: "subscription-1",
  eventType: "ticket.updated",
  ticketId: "ticket-1",
};

describe("WebhookDispatchProcessor", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let processor: WebhookDispatchProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    prisma = buildPrismaMock();
    processor = createProcessor(prisma);
  });

  describe("process", () => {
    it("skips the dispatch and never touches webhookDeliveryAttempt when the subscription no longer exists", async () => {
      prisma.webhookSubscription.findUnique.mockResolvedValue(null);

      await processor.process(buildJob(PAYLOAD));

      expect(fetch).not.toHaveBeenCalled();
      expect(prisma.webhookDeliveryAttempt.create).not.toHaveBeenCalled();
    });

    it("skips the dispatch when the subscription has been deactivated since the job was enqueued", async () => {
      prisma.webhookSubscription.findUnique.mockResolvedValue({ ...SUBSCRIPTION, isActive: false });

      await processor.process(buildJob(PAYLOAD));

      expect(fetch).not.toHaveBeenCalled();
      expect(prisma.webhookDeliveryAttempt.create).not.toHaveBeenCalled();
    });

    it("POSTs a signed JSON body to the subscription's current targetUrl", async () => {
      prisma.webhookSubscription.findUnique.mockResolvedValue(SUBSCRIPTION);
      vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response);
      prisma.webhookDeliveryAttempt.create.mockResolvedValue({});

      await processor.process(buildJob(PAYLOAD));

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(url).toBe("https://example.test/hook");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });

      const body = JSON.parse(init?.body as string);
      expect(body).toMatchObject({ eventType: "ticket.updated", ticketId: "ticket-1" });
      expect(typeof body.occurredAt).toBe("string");

      const expectedSignature = createHmac("sha256", SUBSCRIPTION.secret)
        .update(init?.body as string)
        .digest("hex");
      expect((init?.headers as Record<string, string>)["X-Webhook-Signature"]).toBe(
        `sha256=${expectedSignature}`,
      );
    });

    it("records a succeeded WebhookDeliveryAttempt row on a 2xx response and does not throw", async () => {
      prisma.webhookSubscription.findUnique.mockResolvedValue(SUBSCRIPTION);
      vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as Response);
      prisma.webhookDeliveryAttempt.create.mockResolvedValue({});

      await expect(processor.process(buildJob(PAYLOAD))).resolves.toBeUndefined();

      expect(prisma.webhookDeliveryAttempt.create).toHaveBeenCalledWith({
        data: {
          subscriptionId: "subscription-1",
          eventType: "ticket.updated",
          succeeded: true,
          responseStatus: 204,
          errorMessage: null,
        },
      });
    });

    it("records a failed WebhookDeliveryAttempt row on a non-2xx response, then rethrows so BullMQ retries", async () => {
      prisma.webhookSubscription.findUnique.mockResolvedValue(SUBSCRIPTION);
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
      prisma.webhookDeliveryAttempt.create.mockResolvedValue({});

      await expect(processor.process(buildJob(PAYLOAD))).rejects.toThrow("500");

      expect(prisma.webhookDeliveryAttempt.create).toHaveBeenCalledWith({
        data: {
          subscriptionId: "subscription-1",
          eventType: "ticket.updated",
          succeeded: false,
          responseStatus: 500,
          errorMessage: "Target responded with 500",
        },
      });
    });

    it("records a failed WebhookDeliveryAttempt row (null responseStatus) when the request itself throws, then rethrows", async () => {
      prisma.webhookSubscription.findUnique.mockResolvedValue(SUBSCRIPTION);
      vi.mocked(fetch).mockRejectedValue(new Error("connect ECONNREFUSED"));
      prisma.webhookDeliveryAttempt.create.mockResolvedValue({});

      await expect(processor.process(buildJob(PAYLOAD))).rejects.toThrow("connect ECONNREFUSED");

      expect(prisma.webhookDeliveryAttempt.create).toHaveBeenCalledWith({
        data: {
          subscriptionId: "subscription-1",
          eventType: "ticket.updated",
          succeeded: false,
          responseStatus: null,
          errorMessage: "connect ECONNREFUSED",
        },
      });
    });
  });

  describe("onFailed", () => {
    it("always reports the error to Sentry, tagged with the queue and job id", () => {
      const error = new Error("500");
      const job = { id: "job-1", data: PAYLOAD } as Job<WebhookDispatchJobPayload>;

      processor.onFailed(job, error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { queue: WEBHOOK_DISPATCH_QUEUE, jobId: "job-1" },
      });
    });

    it("tolerates an undefined job (BullMQ's own documented stalled-job case)", () => {
      const error = new Error("stalled");

      processor.onFailed(undefined, error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { queue: WEBHOOK_DISPATCH_QUEUE, jobId: undefined },
      });
    });
  });
});
