import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

// Imported after the mock so the mocked module is what the processor sees.
import * as Sentry from "@sentry/node";
import { HEALTH_CHECK_QUEUE, HealthProcessor } from "./health.processor";

describe("HealthProcessor", () => {
  let processor: HealthProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new HealthProcessor();
  });

  describe("process", () => {
    it("returns a pongedAt timestamp", async () => {
      const job = { name: "ping", data: { pingedAt: "2026-01-01T00:00:00.000Z" } } as Job<{
        pingedAt: string;
      }>;

      const result = await processor.process(job);

      expect(result.pongedAt).toBeTypeOf("string");
    });
  });

  // Story 113 — Error tracking.
  describe("onFailed", () => {
    it("reports a failed job's error to Sentry, tagged with the queue and job id", () => {
      const error = new Error("boom");
      const job = { id: "job-1" } as Job;

      processor.onFailed(job, error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { queue: HEALTH_CHECK_QUEUE, jobId: "job-1" },
      });
    });

    it("tolerates an undefined job (BullMQ's own documented stalled-job case)", () => {
      const error = new Error("stalled");

      processor.onFailed(undefined, error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { queue: HEALTH_CHECK_QUEUE, jobId: undefined },
      });
    });
  });
});
